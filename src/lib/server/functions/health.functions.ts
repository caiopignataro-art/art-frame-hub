import { createServerFn } from "@tanstack/react-start";
import {
  createRequestSupabaseClient,
  isSupabaseAdminConfigured,
} from "@/lib/server/adapters/supabase/supabase-client.server";
import { isAuthRequired } from "@/lib/server/auth/auth.context";
import { resolveServerExecutionContext } from "@/lib/server/auth/auth.middleware";
import { getConfiguredDatabaseProvider } from "@/lib/server/database/database.provider";

export interface ArchitectureHealthStatus {
  timestamp: string;
  databaseProvider: string;
  authRequired: boolean;
  adminApiConfigured: boolean;
  supabaseReachable: boolean;
  rbacTablesMigrated: boolean;
  rolesCount: number;
  permissionsCount: number;
  hasActiveAdmin: boolean;
  authenticatedUserEmail: string | null;
}

/**
 * Teste controlado e somente leitura (Read-Only) da cadeia completa:
 * Frontend → Service → Server Function → Auth Middleware → Database Provider → Repository → Supabase.
 * Não modifica nenhum dado de produção.
 */
export const checkSystemArchitectureHealthServerFn = createServerFn({
  method: "GET",
  strict: false,
}).handler(async (): Promise<ArchitectureHealthStatus> => {
  const ctx = await resolveServerExecutionContext({ allowAnonymous: true });
  const provider = getConfiguredDatabaseProvider();

  let supabaseReachable = false;
  try {
    const client = createRequestSupabaseClient(ctx.accessToken);
    const { error } = await client.from("configuracoes_sistema").select("chave").limit(1);
    supabaseReachable = !error;
  } catch {
    supabaseReachable = false;
  }

  const [roles, permissions, hasActiveAdmin] = await Promise.all([
    ctx.repos.roles.list(),
    ctx.repos.permissions.list(),
    ctx.repos.auth.hasAnyActiveAdmin(),
  ]);

  const rbacTablesMigrated = roles.length > 0 && !roles[0]!.id.startsWith("seed-role-");

  return {
    timestamp: new Date().toISOString(),
    databaseProvider: provider,
    authRequired: isAuthRequired(),
    adminApiConfigured: isSupabaseAdminConfigured(),
    supabaseReachable,
    rbacTablesMigrated,
    rolesCount: roles.length,
    permissionsCount: permissions.length,
    hasActiveAdmin,
    authenticatedUserEmail: ctx.auth.email,
  };
});
