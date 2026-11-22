import crypto from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseServerAuthAdapter } from "@/lib/server/adapters/supabase/auth.adapter";
import {
  createAdminSupabaseClient,
  isSupabaseAdminConfigured,
} from "@/lib/server/adapters/supabase/supabase-client.server";
import {
  clearAuthSessionCookies,
  extractRequestTokens,
  isAuthRequired,
  setAuthSessionCookies,
} from "@/lib/server/auth/auth.context";
import { resolveServerExecutionContext } from "@/lib/server/auth/auth.middleware";
import { requireAuthenticatedUser } from "@/lib/server/auth/authorization";
import { getDatabaseRepositories } from "@/lib/server/database/database.provider";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/server/errors/app-error";
import type { AppUserWithDetails, AuthContext, AuthSession } from "@/types/auth";

const signInSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

const refreshSchema = z
  .object({
    refreshToken: z.string().optional().nullable(),
  })
  .optional();

const passwordResetSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  redirectTo: z.string().optional(),
});

const provisionFirstAdminSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo (mínimo 2 caracteres)."),
  bootstrapSecret: z
    .string()
    .trim()
    .min(1, "Informe a chave secreta de inicialização (bootstrap)."),
});

export interface SessionStatusResponse {
  auth: AuthContext;
  user: AppUserWithDetails | null;
  accessToken: string | null;
  expiresAt: number | null;
  authRequired: boolean;
  hasActiveAdmin: boolean;
}

export interface SignInResponse {
  session: AuthSession;
  auth: AuthContext;
  hasActiveAdmin: boolean;
  needsFirstAdminSetup: boolean;
}

function timingSafeCompare(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Executa comparação de tamanho fixo para evitar vazamento por timing
    crypto.timingSafeEqual(b, b);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

async function resolveHasActiveAdmin(
  repos: ReturnType<typeof getDatabaseRepositories>,
): Promise<boolean> {
  if (isSupabaseAdminConfigured()) {
    const { data: adminExists } = await createAdminSupabaseClient().rpc("has_any_active_admin");
    if (typeof adminExists === "boolean") {
      return adminExists;
    }
  }
  return repos.auth.hasAnyActiveAdmin();
}

async function linkVerifiedIdentityServerSide(
  repos: ReturnType<typeof getDatabaseRepositories>,
  identity: {
    provider: string;
    providerSubject: string;
    email: string;
    emailVerified?: boolean;
  },
  knownAppUserId?: string,
): Promise<void> {
  if (identity.emailVerified !== true) {
    return;
  }

  if (isSupabaseAdminConfigured()) {
    const adminClient = createAdminSupabaseClient();
    let targetUserId = knownAppUserId;

    if (!targetUserId && identity.email) {
      const { data: invitedUser } = await adminClient
        .from("app_users")
        .select("id, status")
        .ilike("email", identity.email)
        .eq("status", "invited")
        .maybeSingle();

      if (invitedUser?.id) {
        const { data: existingProviderLink } = await adminClient
          .from("auth_identities")
          .select("id")
          .eq("app_user_id", invitedUser.id)
          .eq("provider", identity.provider)
          .maybeSingle();

        if (!existingProviderLink) {
          targetUserId = invitedUser.id;
        }
      }
    }

    if (targetUserId) {
      const now = new Date().toISOString();
      await adminClient.from("auth_identities").upsert(
        {
          app_user_id: targetUserId,
          provider: identity.provider,
          provider_subject: identity.providerSubject,
          last_authenticated_at: now,
        },
        { onConflict: "provider,provider_subject" },
      );
      await adminClient
        .from("app_users")
        .update({ last_login_at: now, status: "active" })
        .eq("id", targetUserId)
        .eq("status", "invited");
      await adminClient
        .from("app_users")
        .update({ last_login_at: now })
        .eq("id", targetUserId)
        .eq("status", "active");
      return;
    }
  }

  await repos.auth.linkAndTouchIdentity({
    appUserId: knownAppUserId ?? "",
    provider: identity.provider,
    providerSubject: identity.providerSubject,
    selfService: true,
  });
}

export const signInServerFn = createServerFn({ method: "POST", strict: false })
  .inputValidator((data: unknown) => signInSchema.parse(data))
  .handler(async ({ data }): Promise<SignInResponse> => {
    const request = getRequest();
    const { ipAddress, userAgent } = extractRequestTokens(request);
    const anonRepos = getDatabaseRepositories({ accessToken: null });

    let rawSession;
    try {
      rawSession = await supabaseServerAuthAdapter.signInWithPassword({
        email: data.email,
        password: data.password,
      });
    } catch (err) {
      await anonRepos.auth.writeAuditLog({
        user_id: null,
        actor_user_id: null,
        event_type: "LOGIN_FAILED",
        description: `Tentativa de login malsucedida para o e-mail "${data.email.toLowerCase()}".`,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: { email: data.email.toLowerCase() },
      });
      throw err;
    }

    const repos = getDatabaseRepositories({ accessToken: rawSession.accessToken });
    let internalUser = await repos.auth.findUserByIdentityOrEmail({
      provider: rawSession.identity.provider,
      providerSubject: rawSession.identity.providerSubject,
      email: rawSession.identity.email,
    });

    if (!internalUser && rawSession.identity.emailVerified === true) {
      try {
        await linkVerifiedIdentityServerSide(repos, rawSession.identity);
        internalUser = await repos.auth.findUserByIdentityOrEmail({
          provider: rawSession.identity.provider,
          providerSubject: rawSession.identity.providerSubject,
          email: rawSession.identity.email,
        });
      } catch {
        // Identidade ainda não vinculada ou não elegível para auto-vínculo
      }
    }

    if (internalUser) {
      if (internalUser.status === "inactive" || internalUser.status === "suspended") {
        await repos.auth.writeAuditLog({
          user_id: internalUser.id,
          actor_user_id: internalUser.id,
          event_type: "LOGIN_FAILED",
          description: `Login bloqueado: usuário "${internalUser.email}" com status "${internalUser.status}".`,
          ip_address: ipAddress,
          user_agent: userAgent,
          metadata: { status: internalUser.status },
        });
        await supabaseServerAuthAdapter.signOut(rawSession.accessToken);
        clearAuthSessionCookies();
        throw new ForbiddenError(
          "Sua conta de usuário está desativada ou suspensa. Entre em contato com o administrador.",
        );
      }

      try {
        await linkVerifiedIdentityServerSide(repos, rawSession.identity, internalUser.id);
        internalUser = (await repos.users.getById(internalUser.id)) ?? internalUser;
      } catch {
        // Continua se tabela ainda não migrada
      }
    }

    const hasActiveAdmin = await resolveHasActiveAdmin(repos);
    const needsFirstAdminSetup = !internalUser && !hasActiveAdmin;

    // Refresh token permanece isolado exclusivamente nos cookies HttpOnly
    setAuthSessionCookies({
      accessToken: rawSession.accessToken,
      refreshToken: rawSession.refreshToken,
      expiresAt: rawSession.expiresAt,
    });

    await repos.auth.writeAuditLog({
      user_id: internalUser?.id ?? null,
      actor_user_id: internalUser?.id ?? null,
      event_type: "LOGIN_SUCCESS",
      description: `Login realizado com sucesso por "${rawSession.identity.email}".`,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        provider: rawSession.identity.provider,
        email: rawSession.identity.email,
        linked_app_user: Boolean(internalUser),
      },
    });

    const activeRoles = internalUser
      ? internalUser.roles.filter((r) => r.active !== false).map((r) => r.code)
      : [];

    const authContext: AuthContext = {
      userId: internalUser?.id ?? null,
      providerSubject: rawSession.identity.providerSubject,
      email: internalUser?.email ?? rawSession.identity.email,
      name: internalUser?.name ?? rawSession.identity.name ?? null,
      status: internalUser?.status ?? null,
      isAuthenticated: true,
      isActive: Boolean(internalUser && internalUser.status === "active"),
      roles: activeRoles,
      permissions: internalUser?.permissions ?? [],
      ipAddress,
      userAgent,
    };

    return {
      session: {
        accessToken: rawSession.accessToken,
        refreshToken: null,
        expiresAt: rawSession.expiresAt,
        identity: rawSession.identity,
        user: internalUser,
      },
      auth: authContext,
      hasActiveAdmin,
      needsFirstAdminSetup,
    };
  });

export const signOutServerFn = createServerFn({ method: "POST", strict: false }).handler(
  async (): Promise<{ success: true }> => {
    const ctx = await resolveServerExecutionContext({ allowAnonymous: true });

    if (ctx.auth.isAuthenticated) {
      await ctx.repos.auth.writeAuditLog({
        user_id: ctx.auth.userId,
        actor_user_id: ctx.auth.userId,
        event_type: "LOGOUT",
        description: `Logout realizado por "${ctx.auth.email ?? "usuário"}".`,
        ip_address: ctx.auth.ipAddress,
        user_agent: ctx.auth.userAgent,
      });
    }

    if (ctx.accessToken) {
      await supabaseServerAuthAdapter.signOut(ctx.accessToken);
    }

    clearAuthSessionCookies();
    return { success: true };
  },
);

export const getSessionServerFn = createServerFn({ method: "GET", strict: false }).handler(
  async (): Promise<SessionStatusResponse> => {
    const ctx = await resolveServerExecutionContext({ allowAnonymous: true });
    let expiresAt: number | null = null;

    // Se não há accessToken válido mas há refreshToken no cookie HttpOnly, renova no servidor
    if (!ctx.auth.isAuthenticated && ctx.refreshToken) {
      try {
        const refreshed = await supabaseServerAuthAdapter.refreshSession(ctx.refreshToken);
        setAuthSessionCookies({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
          expiresAt: refreshed.expiresAt,
        });
        expiresAt = refreshed.expiresAt;
        const repos = getDatabaseRepositories({ accessToken: refreshed.accessToken });
        const internalUser = await repos.auth.findUserByIdentityOrEmail({
          provider: refreshed.identity.provider,
          providerSubject: refreshed.identity.providerSubject,
          email: refreshed.identity.email,
        });

        if (
          internalUser &&
          internalUser.status !== "inactive" &&
          internalUser.status !== "suspended"
        ) {
          const activeRoles = internalUser.roles
            .filter((r) => r.active !== false)
            .map((r) => r.code);
          const hasActiveAdmin = await resolveHasActiveAdmin(repos);
          return {
            auth: {
              userId: internalUser.id,
              providerSubject: refreshed.identity.providerSubject,
              email: internalUser.email,
              name: internalUser.name,
              status: internalUser.status,
              isAuthenticated: true,
              isActive: true,
              roles: activeRoles,
              permissions: internalUser.permissions,
              ipAddress: ctx.auth.ipAddress,
              userAgent: ctx.auth.userAgent,
            },
            user: internalUser,
            accessToken: refreshed.accessToken,
            expiresAt,
            authRequired: isAuthRequired(),
            hasActiveAdmin,
          };
        }
      } catch {
        clearAuthSessionCookies();
      }
    }

    let user: AppUserWithDetails | null = null;
    if (ctx.auth.userId) {
      user = await ctx.repos.users.getById(ctx.auth.userId);
    }

    let hasActiveAdmin = true;
    if (isSupabaseAdminConfigured()) {
      const { data: adminExists } = await createAdminSupabaseClient().rpc("has_any_active_admin");
      if (typeof adminExists === "boolean") {
        hasActiveAdmin = adminExists;
      }
    } else if (ctx.auth.isAuthenticated) {
      hasActiveAdmin = await ctx.repos.auth.hasAnyActiveAdmin();
    }

    return {
      auth: ctx.auth,
      user,
      accessToken: ctx.accessToken,
      expiresAt,
      authRequired: isAuthRequired(),
      hasActiveAdmin,
    };
  },
);

export const refreshSessionServerFn = createServerFn({ method: "POST", strict: false })
  .inputValidator((data: unknown) => refreshSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<SignInResponse> => {
    const request = getRequest();
    const { refreshToken: cookieRefresh, ipAddress, userAgent } = extractRequestTokens(request);
    const tokenToUse = cookieRefresh || data?.refreshToken || null;

    if (!tokenToUse) {
      throw new UnauthorizedError("Token de renovação de sessão ausente.");
    }

    const rawSession = await supabaseServerAuthAdapter.refreshSession(tokenToUse);
    const repos = getDatabaseRepositories({ accessToken: rawSession.accessToken });

    const internalUser = await repos.auth.findUserByIdentityOrEmail({
      provider: rawSession.identity.provider,
      providerSubject: rawSession.identity.providerSubject,
      email: rawSession.identity.email,
    });

    if (
      internalUser &&
      (internalUser.status === "inactive" || internalUser.status === "suspended")
    ) {
      clearAuthSessionCookies();
      throw new ForbiddenError("Sua conta de usuário foi desativada ou suspensa.");
    }

    setAuthSessionCookies({
      accessToken: rawSession.accessToken,
      refreshToken: rawSession.refreshToken,
      expiresAt: rawSession.expiresAt,
    });

    const hasActiveAdmin = await resolveHasActiveAdmin(repos);
    const activeRoles = internalUser
      ? internalUser.roles.filter((r) => r.active !== false).map((r) => r.code)
      : [];

    const authContext: AuthContext = {
      userId: internalUser?.id ?? null,
      providerSubject: rawSession.identity.providerSubject,
      email: internalUser?.email ?? rawSession.identity.email,
      name: internalUser?.name ?? rawSession.identity.name ?? null,
      status: internalUser?.status ?? null,
      isAuthenticated: true,
      isActive: Boolean(internalUser && internalUser.status === "active"),
      roles: activeRoles,
      permissions: internalUser?.permissions ?? [],
      ipAddress,
      userAgent,
    };

    return {
      session: {
        accessToken: rawSession.accessToken,
        refreshToken: null,
        expiresAt: rawSession.expiresAt,
        identity: rawSession.identity,
        user: internalUser,
      },
      auth: authContext,
      hasActiveAdmin,
      needsFirstAdminSetup: !internalUser && !hasActiveAdmin,
    };
  });

export const requestPasswordResetServerFn = createServerFn({ method: "POST", strict: false })
  .inputValidator((data: unknown) => passwordResetSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: true }> => {
    const request = getRequest();
    const { ipAddress, userAgent } = extractRequestTokens(request);
    const repos = getDatabaseRepositories({ accessToken: null });

    await supabaseServerAuthAdapter.requestPasswordReset(data.email, data.redirectTo);

    await repos.auth.writeAuditLog({
      user_id: null,
      actor_user_id: null,
      event_type: "PASSWORD_RESET_REQUESTED",
      description: `Solicitação de recuperação de senha para "${data.email.toLowerCase()}".`,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { email: data.email.toLowerCase() },
    });

    return { success: true };
  });

/**
 * Provisionamento controlado e atômico do primeiro administrador do sistema (Bootstrap Seguro).
 * Requisitos obrigatórios no servidor:
 * 1) Identidade válida autenticada no provedor (`requireAuthenticatedUser`);
 * 2) Segredo de uso único `FIRST_ADMIN_BOOTSTRAP_SECRET` (>= 16 caracteres) configurado no
 *    ambiente do servidor e validado via `crypto.timingSafeEqual`;
 * 3) Se `FIRST_ADMIN_EMAIL` estiver configurado, o e-mail autenticado deve coincidir;
 * 4) Execução atômica no PostgreSQL via `public.bootstrap_first_admin` com advisory lock e
 *    lock exclusivo em `app_users`, impedindo corrida entre requisições simultâneas.
 */
export const provisionFirstAdminServerFn = createServerFn({ method: "POST", strict: false })
  .inputValidator((data: unknown) => provisionFirstAdminSchema.parse(data))
  .handler(async ({ data }): Promise<AppUserWithDetails> => {
    const ctx = await resolveServerExecutionContext({ allowAnonymous: false });
    requireAuthenticatedUser(ctx.auth);

    if (!ctx.auth.email || !ctx.auth.providerSubject) {
      throw new ValidationError(
        "A identidade autenticada não possui e-mail ou identificador válido para provisionamento.",
      );
    }

    const configuredSecret = (process.env.FIRST_ADMIN_BOOTSTRAP_SECRET ?? "").trim();
    if (configuredSecret.length < 16) {
      throw new ForbiddenError(
        "Provisionamento inicial bloqueado: configure FIRST_ADMIN_BOOTSTRAP_SECRET (mínimo 16 caracteres) no servidor ou execute `public.bootstrap_first_admin(...)` diretamente via SQL administrativo.",
      );
    }

    if (!timingSafeCompare(data.bootstrapSecret.trim(), configuredSecret)) {
      await ctx.repos.auth.writeAuditLog({
        user_id: null,
        actor_user_id: null,
        event_type: "UNAUTHORIZED_ACCESS",
        description: `Tentativa de bootstrap inicial rejeitada: chave secreta inválida para "${ctx.auth.email}".`,
        ip_address: ctx.auth.ipAddress,
        user_agent: ctx.auth.userAgent,
        metadata: {
          email: ctx.auth.email,
          reason: "invalid_bootstrap_secret",
        },
      });
      throw new ForbiddenError(
        "Chave secreta de inicialização (bootstrap) inválida. Operação negada.",
      );
    }

    const allowedEmail = (process.env.FIRST_ADMIN_EMAIL ?? "").trim().toLowerCase();
    if (allowedEmail && ctx.auth.email.toLowerCase() !== allowedEmail) {
      await ctx.repos.auth.writeAuditLog({
        user_id: null,
        actor_user_id: null,
        event_type: "UNAUTHORIZED_ACCESS",
        description: `Tentativa de bootstrap inicial bloqueada: e-mail "${ctx.auth.email}" não corresponde a FIRST_ADMIN_EMAIL.`,
        ip_address: ctx.auth.ipAddress,
        user_agent: ctx.auth.userAgent,
        metadata: {
          email: ctx.auth.email,
          reason: "bootstrap_email_mismatch",
        },
      });
      throw new ForbiddenError(
        "Este endereço de e-mail não está autorizado a executar o bootstrap inicial do sistema.",
      );
    }

    return ctx.repos.auth.bootstrapFirstAdmin({
      name: data.name.trim(),
      email: ctx.auth.email,
      provider: "supabase",
      providerSubject: ctx.auth.providerSubject,
      ipAddress: ctx.auth.ipAddress,
      userAgent: ctx.auth.userAgent,
    });
  });
