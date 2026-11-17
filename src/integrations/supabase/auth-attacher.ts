import { createMiddleware } from "@tanstack/react-start";
import { sessionTokenStore } from "@/lib/auth/session-token.store";

// Registrado como `functionMiddleware` global em `src/start.ts`.
// Concessão temporária (Fases A–E): encaminha o accessToken volátil em memória RAM
// quando disponível; os cookies `HttpOnly` (`afh_access_token` / `afh_refresh_token`)
// continuam sendo enviados automaticamente pelo navegador como fonte autoritativa.
// Será removido na Fase E após a migração integral dos 12 serviços legados.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = sessionTokenStore.getAccessToken();

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
