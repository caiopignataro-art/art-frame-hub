/**
 * Armazenamento VOLÁTIL (exclusivamente em memória RAM) do accessToken no navegador.
 *
 * ============================================================================
 * CONCESSÃO TEMPORÁRIA DE TRANSIÇÃO (FASES A–E) — DOCUMENTAÇÃO DE RISCO E REMOÇÃO
 * ============================================================================
 * 1. Motivo da concessão:
 *    - A fonte primária e autoritativa de autenticação são os cookies `HttpOnly`
 *      (`afh_access_token` e `afh_refresh_token`) validados no servidor.
 *    - Entretanto, os 12 serviços comerciais/operacionais legados ainda consomem
 *      o cliente Supabase diretamente no navegador durante as Fases B–E.
 *    - Para evitar quebra desses módulos até a conclusão da migração server-side,
 *      o `accessToken` de curta duração é mantido exclusivamente em memória RAM
 *      (sem persistência em `localStorage` ou `sessionStorage` e sem exposição do
 *      `refreshToken` ao JavaScript).
 *
 * 2. Risco residual documentado:
 *    - Enquanto `accessToken` existir em variável JS de memória (`memoryToken`),
 *      uma eventual vulnerabilidade XSS no frontend poderia ler o token de curta
 *      duração ativo na aba corrente.
 *    - Mitigações aplicadas na revisão da Fase A:
 *      a) `refreshToken` NUNCA é retornado no payload JSON nem mantido em JS
 *         (permanece isolado apenas em cookie `HttpOnly`).
 *      b) `sessionStorage` e `localStorage` NÃO são utilizados para armazenar
 *         credenciais da sessão (ao recarregar a página, o servidor reidrata o
 *         estado a partir dos cookies `HttpOnly`).
 *
 * 3. Plano de remoção definitiva (Fase E):
 *    - Quando os 12 serviços legados forem migrados para Server Functions:
 *      a) Remover `accessToken` dos retornos de `signInServerFn`, `getSessionServerFn`
 *         e `refreshSessionServerFn`.
 *      b) Remover `syncLegacyBrowserClientSession()` de `src/lib/services/auth.service.ts`.
 *      c) Remover o middleware client-side `attachSupabaseAuth` (passando a depender
 *         100% dos cookies `HttpOnly` enviados automaticamente pelo navegador).
 *      d) Excluir este arquivo (`src/lib/auth/session-token.store.ts`).
 * ============================================================================
 */

const LEGACY_STORAGE_KEY = "afh.auth.session.v1";

export interface StoredTokenData {
  accessToken: string;
  expiresAt: number | null;
}

let memoryToken: StoredTokenData | null = null;

function purgeLegacyBrowserStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Ignora indisponibilidade de sessionStorage
  }
}

export const sessionTokenStore = {
  get(): StoredTokenData | null {
    return memoryToken;
  },

  getAccessToken(): string | null {
    const current = memoryToken;
    if (!current) return null;
    if (current.expiresAt) {
      const nowSec = Math.floor(Date.now() / 1000);
      if (current.expiresAt <= nowSec) {
        memoryToken = null;
        return null;
      }
    }
    return current.accessToken;
  },

  set(data: StoredTokenData | null): void {
    memoryToken = data;
    purgeLegacyBrowserStorage();
  },

  clear(): void {
    memoryToken = null;
    purgeLegacyBrowserStorage();
  },
};
