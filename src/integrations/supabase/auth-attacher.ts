import { createMiddleware } from "@tanstack/react-start";
import { sessionTokenStore } from "@/lib/auth/session-token.store";
import { supabase } from "./client";

// Registrado como `functionMiddleware` global em `src/start.ts`.
// Prioriza o token gerenciado pelo `AuthProvider` da aplicação (`sessionTokenStore`)
// em conjunto com os cookies HttpOnly, mantendo fallback para a sessão local do SDK
// enquanto os serviços comerciais aguardam migração nas Fases B–E.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token = sessionTokenStore.getAccessToken();

    if (!token && typeof window !== "undefined") {
      try {
        const { data } = await supabase.auth.getSession();
        token = data.session?.access_token ?? null;
      } catch {
        token = null;
      }
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
