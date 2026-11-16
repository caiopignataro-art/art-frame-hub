import type { DatabaseRepositories } from "@/lib/server/database/database.types";
import { ForbiddenError, UnauthorizedError } from "@/lib/server/errors/app-error";
import type { AuthContext } from "@/types/auth";
import type { PermissionCode } from "@/types/permissions";

/**
 * Verifica se a política de autenticação obrigatória está ativa.
 * Por padrão, `AUTH_REQUIRED` é `true` (exceto se explicitamente definido como `"false"`
 * em ambiente de desenvolvimento). Em produção (`NODE_ENV === "production"`), é sempre `true`.
 */
export function isAuthRequired(): boolean {
  if (process.env.NODE_ENV === "production") {
    return true;
  }
  const envVal = (process.env.AUTH_REQUIRED ?? "true").trim().toLowerCase();
  return envVal !== "false" && envVal !== "0";
}

/**
 * Garante que a requisição possui identidade autenticada válida.
 */
export function requireAuthenticatedUser(auth: AuthContext): AuthContext {
  if (!auth.isAuthenticated) {
    throw new UnauthorizedError("Autenticação obrigatória para executar esta operação.");
  }
  return auth;
}

/**
 * Garante que o usuário está autenticado e ativo no cadastro interno (`app_users`).
 */
export function requireActiveUser(auth: AuthContext): AuthContext {
  requireAuthenticatedUser(auth);

  if (auth.status === "inactive" || auth.status === "suspended") {
    throw new ForbiddenError(
      "Sua conta de usuário está desativada ou suspensa. Contate o administrador.",
    );
  }

  if (!auth.isActive) {
    throw new ForbiddenError(
      "Seu usuário ainda não está ativo ou vinculado no ERP. Solicite a ativação ao administrador.",
    );
  }

  return auth;
}

async function logUnauthorizedAttempt(
  auth: AuthContext,
  requiredPermissions: readonly string[],
  repos?: DatabaseRepositories,
): Promise<void> {
  if (!repos) return;
  try {
    await repos.auth.writeAuditLog({
      user_id: auth.userId,
      actor_user_id: auth.userId,
      event_type: "UNAUTHORIZED_ACCESS",
      description: `Tentativa de acesso negada. Permissões exigidas: ${requiredPermissions.join(", ")}.`,
      ip_address: auth.ipAddress,
      user_agent: auth.userAgent,
      metadata: {
        email: auth.email,
        roles: auth.roles,
        required_permissions: [...requiredPermissions],
      },
    });
  } catch {
    // Nunca interromper fluxo principal por falha secundária de log
  }
}

/**
 * Verifica se o contexto possui uma permissão específica.
 * Administradores ativos com código `admin` ou a permissão declarada são autorizados.
 */
export function hasPermission(auth: AuthContext, permission: PermissionCode): boolean {
  if (!auth.isAuthenticated || !auth.isActive) return false;
  if (auth.roles.includes("admin")) return true;
  return auth.permissions.includes(permission);
}

/**
 * Exige uma permissão granular específica antes de executar uma Server Function.
 */
export async function requirePermission(
  auth: AuthContext,
  permission: PermissionCode,
  repos?: DatabaseRepositories,
): Promise<AuthContext> {
  if (!isAuthRequired() && !auth.isAuthenticated) {
    return auth;
  }

  requireActiveUser(auth);

  if (!hasPermission(auth, permission)) {
    await logUnauthorizedAttempt(auth, [permission], repos);
    throw new ForbiddenError(
      `Acesso negado: você não possui a permissão necessária ("${permission}").`,
    );
  }

  return auth;
}

/**
 * Exige ao menos uma das permissões informadas.
 */
export async function requireAnyPermission(
  auth: AuthContext,
  permissions: readonly PermissionCode[],
  repos?: DatabaseRepositories,
): Promise<AuthContext> {
  if (!isAuthRequired() && !auth.isAuthenticated) {
    return auth;
  }

  requireActiveUser(auth);

  const allowed = permissions.some((p) => hasPermission(auth, p));
  if (!allowed) {
    await logUnauthorizedAttempt(auth, permissions, repos);
    throw new ForbiddenError(
      `Acesso negado: esta operação requer uma das seguintes permissões: ${permissions.join(", ")}.`,
    );
  }

  return auth;
}

/**
 * Exige todas as permissões informadas.
 */
export async function requireAllPermissions(
  auth: AuthContext,
  permissions: readonly PermissionCode[],
  repos?: DatabaseRepositories,
): Promise<AuthContext> {
  if (!isAuthRequired() && !auth.isAuthenticated) {
    return auth;
  }

  requireActiveUser(auth);

  const missing = permissions.filter((p) => !hasPermission(auth, p));
  if (missing.length > 0) {
    await logUnauthorizedAttempt(auth, missing, repos);
    throw new ForbiddenError(
      `Acesso negado: faltam as seguintes permissões: ${missing.join(", ")}.`,
    );
  }

  return auth;
}
