/**
 * Serviço de Autenticação Client-Safe (implementa `AuthProviderContract`).
 * Comunica-se exclusivamente com as Server Functions de autenticação (`auth.functions.ts`).
 * Nenhuma tela ou componente conhece detalhes do Supabase Auth.
 */
import { sessionTokenStore } from "@/lib/auth/session-token.store";
import {
  getSessionServerFn,
  provisionFirstAdminServerFn,
  refreshSessionServerFn,
  requestPasswordResetServerFn,
  signInServerFn,
  signOutServerFn,
  type SessionStatusResponse,
  type SignInResponse,
} from "@/lib/server/functions/auth.functions";
import {
  checkSystemArchitectureHealthServerFn,
  type ArchitectureHealthStatus,
} from "@/lib/server/functions/health.functions";
import type {
  AppUserWithDetails,
  AuthIdentity,
  AuthProviderContract,
  AuthSession,
  SignInInput,
} from "@/types/auth";

/**
 * Concessão temporária (Fases B–E):
 * Injeta o `accessToken` volátil (mantido apenas em RAM via `sessionTokenStore`)
 * no cliente Supabase legado do navegador sem gravar `access_token` nem `refresh_token`
 * em `localStorage` via `supabase.auth.setSession(...)`.
 *
 * Plano de remoção: eliminar esta função na Fase E, após migrar os 12 serviços
 * operacionais para Server Functions e remover o uso de `@/integrations/supabase/client`.
 */
async function syncLegacyBrowserClientSession(params: {
  accessToken: string | null;
}): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const mutableClient = supabase as unknown as {
      accessToken?: () => Promise<string | null>;
    };
    if (params.accessToken) {
      mutableClient.accessToken = async () => sessionTokenStore.getAccessToken();
    } else {
      mutableClient.accessToken = async () => null;
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch {
    // Falha silenciosa caso o ambiente não suporte operações locais no cliente legado
  }
}

export class ClientAuthProvider implements AuthProviderContract {
  async signIn(input: SignInInput): Promise<AuthSession> {
    const res = await this.signInWithContext(input);
    return res.session;
  }

  async signInWithContext(input: SignInInput): Promise<SignInResponse> {
    const response = await signInServerFn({ data: input });
    sessionTokenStore.set({
      accessToken: response.session.accessToken,
      expiresAt: response.session.expiresAt,
    });
    await syncLegacyBrowserClientSession({
      accessToken: response.session.accessToken,
    });
    return response;
  }

  async signOut(): Promise<void> {
    try {
      await signOutServerFn();
    } finally {
      sessionTokenStore.clear();
      await syncLegacyBrowserClientSession({ accessToken: null });
    }
  }

  async getSessionStatus(): Promise<SessionStatusResponse> {
    const status = await getSessionServerFn();
    if (status.accessToken && status.auth.isAuthenticated) {
      const existing = sessionTokenStore.get();
      sessionTokenStore.set({
        accessToken: status.accessToken,
        expiresAt: status.expiresAt ?? existing?.expiresAt ?? null,
      });
      await syncLegacyBrowserClientSession({ accessToken: status.accessToken });
    } else if (!status.auth.isAuthenticated) {
      sessionTokenStore.clear();
      await syncLegacyBrowserClientSession({ accessToken: null });
    }
    return status;
  }

  async getSession(): Promise<AuthSession | null> {
    const status = await this.getSessionStatus();
    if (!status.auth.isAuthenticated || !status.accessToken || !status.auth.providerSubject) {
      return null;
    }

    return {
      accessToken: status.accessToken,
      refreshToken: null,
      expiresAt: status.expiresAt,
      identity: {
        provider: "supabase",
        providerSubject: status.auth.providerSubject,
        email: status.auth.email ?? "",
        name: status.auth.name,
      },
      user: status.user,
    };
  }

  async getCurrentUser(): Promise<AuthIdentity | null> {
    const session = await this.getSession();
    return session?.identity ?? null;
  }

  async refreshSession(): Promise<AuthSession | null> {
    try {
      const response = await refreshSessionServerFn({
        data: {},
      });
      sessionTokenStore.set({
        accessToken: response.session.accessToken,
        expiresAt: response.session.expiresAt,
      });
      await syncLegacyBrowserClientSession({
        accessToken: response.session.accessToken,
      });
      return response.session;
    } catch {
      sessionTokenStore.clear();
      await syncLegacyBrowserClientSession({ accessToken: null });
      return null;
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
    await requestPasswordResetServerFn({
      data: { email, redirectTo },
    });
  }

  async provisionFirstAdmin(input: {
    name: string;
    bootstrapSecret: string;
  }): Promise<AppUserWithDetails> {
    return provisionFirstAdminServerFn({ data: input });
  }

  async checkArchitectureHealth(): Promise<ArchitectureHealthStatus> {
    return checkSystemArchitectureHealthServerFn();
  }
}

export const authService = new ClientAuthProvider();
export const authKeys = {
  session: ["auth", "session"] as const,
  health: ["auth", "architecture-health"] as const,
};
