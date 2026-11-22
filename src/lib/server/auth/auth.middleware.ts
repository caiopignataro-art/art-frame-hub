import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseServerAuthAdapter } from "@/lib/server/adapters/supabase/auth.adapter";
import { getDatabaseRepositories } from "@/lib/server/database/database.provider";
import { ForbiddenError } from "@/lib/server/errors/app-error";
import {
  createEmptyAuthContext,
  extractRequestTokens,
  type ServerExecutionContext,
} from "./auth.context";
import { requireActiveUser } from "./authorization";

/**
 * Resolve o contexto de autenticação e repositórios de forma isolada por requisição.
 * - Valida o token JWT no servidor via `supabaseServerAuthAdapter.verifyAccessToken`.
 * - Rejeita tokens inválidos ou expirados.
 * - Busca o usuário interno em `app_users`, perfis ativos e permissões atualizadas no banco
 *   (sem depender de cache obsoleto em caso de revogação de permissão ou desativação).
 * - Bloqueia usuários com status `inactive` ou `suspended`.
 */
export async function resolveServerExecutionContext(options?: {
  allowAnonymous?: boolean;
}): Promise<ServerExecutionContext> {
  const request = getRequest();
  const { accessToken, refreshToken, ipAddress, userAgent } = extractRequestTokens(request);

  if (!accessToken) {
    const emptyAuth = createEmptyAuthContext({ ipAddress, userAgent });
    const repos = getDatabaseRepositories({ accessToken: null, auth: emptyAuth });
    return {
      auth: emptyAuth,
      accessToken: null,
      refreshToken,
      repos,
    };
  }

  // Valida assinatura e expiração do token no servidor (lança UnauthorizedError se inválido)
  let identity;
  try {
    identity = await supabaseServerAuthAdapter.verifyAccessToken(accessToken);
  } catch (err) {
    if (options?.allowAnonymous) {
      const emptyAuth = createEmptyAuthContext({ ipAddress, userAgent });
      const repos = getDatabaseRepositories({ accessToken: null, auth: emptyAuth });
      return {
        auth: emptyAuth,
        accessToken: null,
        refreshToken,
        repos,
      };
    }
    throw err;
  }

  const repos = getDatabaseRepositories({ accessToken });

  const internalUser = await repos.auth.findUserByIdentityOrEmail({
    provider: identity.provider,
    providerSubject: identity.providerSubject,
    email: identity.email,
  });

  if (!internalUser) {
    // Identidade autenticada no provedor, mas ainda não vinculada em `app_users`
    // (ex.: durante o fluxo controlado de bootstrap do primeiro administrador)
    return {
      auth: {
        userId: null,
        providerSubject: identity.providerSubject,
        email: identity.email,
        name: identity.name ?? null,
        status: null,
        isAuthenticated: true,
        isActive: false,
        roles: [],
        permissions: [],
        ipAddress,
        userAgent,
      },
      accessToken,
      refreshToken,
      repos,
    };
  }

  if (internalUser.status === "inactive" || internalUser.status === "suspended") {
    await repos.auth.writeAuditLog({
      user_id: internalUser.id,
      actor_user_id: internalUser.id,
      event_type: "UNAUTHORIZED_ACCESS",
      description: `Acesso bloqueado: conta com status "${internalUser.status}".`,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
    throw new ForbiddenError(
      "Sua conta de usuário está desativada ou suspensa. Entre em contato com o administrador.",
    );
  }

  // Se o usuário estava 'invited' ou ainda não tinha a identidade vinculada em `auth_identities`, vincula somente com e-mail verificado
  const hasLinkedIdentity = internalUser.identities.some(
    (id) => id.provider === identity.provider && id.provider_subject === identity.providerSubject,
  );
    if (
      (!hasLinkedIdentity || internalUser.status === "invited") &&
      identity.emailVerified === true
    ) {
      try {
        await repos.auth.linkAndTouchIdentity({
          appUserId: internalUser.id,
          provider: identity.provider,
          providerSubject: identity.providerSubject,
          selfService: true,
        });
      } catch {
        // Caso a tabela ainda não tenha sido migrada ou RLS restrinja, segue leitura
      }
    }

    const activeRoles = internalUser.roles.filter((r) => r.active !== false).map((r) => r.code);

    return {
      auth: {
        userId: internalUser.id,
        providerSubject: identity.providerSubject,
        email: internalUser.email,
        name: internalUser.name,
        status: internalUser.status === "invited" ? "active" : internalUser.status,
        isAuthenticated: true,
        isActive: true,
        roles: activeRoles,
        permissions: internalUser.permissions,
        ipAddress,
        userAgent,
      },
      accessToken,
      refreshToken,
      repos,
    };
  }

  /**
   * Middleware Server-Side para Server Functions que resolve o contexto de autenticação
   * e disponibiliza `auth` e `repos` de forma isolada por requisição.
   */
  export const authContextMiddleware = createMiddleware({ type: "function" }).server(
    async ({ next }) => {
      const execCtx = await resolveServerExecutionContext({ allowAnonymous: true });
      return next({
        context: execCtx,
      });
    },
  );

  /**
   * Middleware Server-Side que exige usuário autenticado e ativo no ERP.
   */
  export const requireAuthMiddleware = createMiddleware({ type: "function" }).server(
    async ({ next }) => {
      const execCtx = await resolveServerExecutionContext({ allowAnonymous: false });
      requireActiveUser(execCtx.auth);
      return next({
        context: execCtx,
      });
    },
  );
