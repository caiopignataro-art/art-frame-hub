import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { InternalServerError, ValidationError } from "@/lib/server/errors/app-error";

export interface SupabaseEnvConfig {
  url: string;
  publishableKey: string;
  serviceRoleKey?: string;
}

export function getSupabaseEnvConfig(): SupabaseEnvConfig {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !publishableKey) {
    const missing = [
      ...(!url ? ["SUPABASE_URL"] : []),
      ...(!publishableKey ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new InternalServerError(
      `Configuração obrigatória do banco ausente no servidor: ${missing.join(", ")}.`,
    );
  }

  return {
    url,
    publishableKey,
    serviceRoleKey: serviceRoleKey && serviceRoleKey.trim().length > 0 ? serviceRoleKey : undefined,
  };
}

/**
 * Verifica se a chave administrativa (`SUPABASE_SERVICE_ROLE_KEY`) está configurada no servidor.
 */
export function isSupabaseAdminConfigured(): boolean {
  const cfg = getSupabaseEnvConfig();
  return Boolean(cfg.serviceRoleKey);
}

/**
 * Cria um cliente Supabase isolado por requisição.
 * - NUNCA armazena estado de sessão ou JWT globalmente.
 * - NUNCA compartilha cabeçalhos de autorização entre requisições diferentes.
 * - NUNCA faz fallback para `SUPABASE_SERVICE_ROLE_KEY`.
 */
export function createRequestSupabaseClient(accessToken?: string | null): SupabaseClient {
  const { url, publishableKey } = getSupabaseEnvConfig();
  const cleanToken = accessToken?.trim();

  return createClient(url, publishableKey, {
    global: {
      headers: cleanToken ? { Authorization: `Bearer ${cleanToken}` } : {},
    },
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Cria um cliente administrativo Supabase EXCLUSIVO para operações privilegiadas
 * de provisionamento na Admin API (`auth.admin.*`), protegido por validação explícita
 * de permissão (`usuarios.create` / `usuarios.deactivate`).
 *
 * Falha de forma explícita caso `SUPABASE_SERVICE_ROLE_KEY` não esteja definida.
 */
export function createAdminSupabaseClient(): SupabaseClient {
  const { url, serviceRoleKey } = getSupabaseEnvConfig();

  if (!serviceRoleKey) {
    throw new ValidationError(
      "A operação de provisionamento automático no provedor de autenticação requer a variável SUPABASE_SERVICE_ROLE_KEY configurada no servidor.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
