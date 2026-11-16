import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseServerAuthAdapter } from "@/lib/server/adapters/supabase/auth.adapter";
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
import { getRequest } from "@tanstack/react-start/server";

const signInSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(1, "Informe sua senha."),
});

const refreshSchema = z.object({
  refreshToken: z.string().optional().nullable(),
});

const passwordResetSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  redirectTo: z.string().optional(),
});

const provisionFirstAdminSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome completo (mínimo 2 caracteres)."),
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

export const signInServerFn = createServerFn({ method: "POST", strict: false })
  .validator((data: unknown) => signInSchema.parse(data))
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
        await repos.auth.linkAndTouchIdentity({
          appUserId: internalUser.id,
          provider: rawSession.identity.provider,
          providerSubject: rawSession.identity.providerSubject,
        });
        internalUser = (await repos.users.getById(internalUser.id)) ?? internalUser;
      } catch {
        // Continua se tabela ainda não migrada
      }
    }

    const hasActiveAdmin = await repos.auth.hasAnyActiveAdmin();
    const needsFirstAdminSetup = !internalUser && !hasActiveAdmin;

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
        refreshToken: rawSession.refreshToken,
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

    // Se não há accessToken válido mas há refreshToken no cookie, tenta renovar silenciosamente
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
          const hasActiveAdmin = await repos.auth.hasAnyActiveAdmin();
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

    const hasActiveAdmin = await ctx.repos.auth.hasAnyActiveAdmin();

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
  .validator((data: unknown) => refreshSchema.parse(data ?? {}))
  .handler(async ({ data }): Promise<SignInResponse> => {
    const request = getRequest();
    const { refreshToken: cookieRefresh, ipAddress, userAgent } = extractRequestTokens(request);
    const tokenToUse = data.refreshToken || cookieRefresh;

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

    const hasActiveAdmin = await repos.auth.hasAnyActiveAdmin();
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
        refreshToken: rawSession.refreshToken,
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
  .validator((data: unknown) => passwordResetSchema.parse(data))
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
 * Provisionamento seguro do primeiro administrador do sistema (Bootstrap Controlado).
 * Só pode ser executado se:
 * 1) O usuário já estiver autenticado com um token válido no provedor de autenticação; E
 * 2) Ainda NÃO existir nenhum administrador ativo cadastrado em `app_users`.
 */
export const provisionFirstAdminServerFn = createServerFn({ method: "POST", strict: false })
  .validator((data: unknown) => provisionFirstAdminSchema.parse(data))
  .handler(async ({ data }): Promise<AppUserWithDetails> => {
    const ctx = await resolveServerExecutionContext({ allowAnonymous: false });
    requireAuthenticatedUser(ctx.auth);

    const hasAdmin = await ctx.repos.auth.hasAnyActiveAdmin();
    if (hasAdmin) {
      throw new ForbiddenError(
        "Operação bloqueada: o sistema já possui um administrador ativo provisionado.",
      );
    }

    if (!ctx.auth.email || !ctx.auth.providerSubject) {
      throw new ValidationError(
        "A identidade autenticada não possui e-mail ou identificador válido para provisionamento.",
      );
    }

    const adminRole = await ctx.repos.roles.getByCode("admin");
    if (!adminRole || adminRole.id.startsWith("seed-role-")) {
      throw new ValidationError(
        "A estrutura de banco de dados da Fase A (tabelas roles/app_users) ainda não foi aplicada no Supabase. Aplique a migration SQL autorizada primeiro.",
      );
    }

    let user = await ctx.repos.users.getByEmail(ctx.auth.email);
    if (!user) {
      user = await ctx.repos.users.create(
        {
          name: data.name.trim(),
          email: ctx.auth.email,
          status: "active",
          roleIds: [adminRole.id],
        },
        null,
      );
    } else {
      const roleIds = Array.from(new Set([...user.roles.map((r) => r.id), adminRole.id]));
      user = await ctx.repos.users.update(
        user.id,
        {
          name: data.name.trim(),
          status: "active",
          roleIds,
        },
        user.id,
      );
    }

    await ctx.repos.auth.linkAndTouchIdentity({
      appUserId: user.id,
      provider: "supabase",
      providerSubject: ctx.auth.providerSubject,
    });

    await ctx.repos.auth.writeAuditLog({
      user_id: user.id,
      actor_user_id: user.id,
      event_type: "FIRST_ADMIN_PROVISIONED",
      description: `Primeiro administrador provisionado no sistema: "${user.name}" (${user.email}).`,
      ip_address: ctx.auth.ipAddress,
      user_agent: ctx.auth.userAgent,
      metadata: {
        email: user.email,
        role: "admin",
      },
    });

    return (await ctx.repos.users.getById(user.id)) ?? user;
  });
