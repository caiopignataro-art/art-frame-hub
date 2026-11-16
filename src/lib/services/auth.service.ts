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
 * Sincroniza a sessão autenticada com o cliente legada do browser apenas para que
 * os módulos comerciais (que serão migrados nas Fases B–E) continuem enviando o JWT
 * do operador autenticado às RPCs e triggers de auditoria.
 */
async function syncLegacyBrowserClientSession(params: {
  accessToken: string | null;
  refreshToken?: string | null;
}): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    if (params.accessToken && params.refreshToken) {
      await supabase.auth.setSession({
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
      });
    } else if (!params.accessToken) {
      await supabase.auth.signOut();
    }
  } catch {
    // Falha silenciosa caso o ambiente não suporte storage local
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
      refreshToken: response.session.refreshToken ?? null,
      expiresAt: response.session.expiresAt,
    });
    await syncLegacyBrowserClientSession({
      accessToken: response.session.accessToken,
      refreshToken: response.session.refreshToken,
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
        refreshToken: existing?.refreshToken ?? null,
        expiresAt: status.expiresAt ?? existing?.expiresAt ?? null,
      });
    } else if (!status.auth.isAuthenticated) {
      sessionTokenStore.clear();
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
      refreshToken: sessionTokenStore.getRefreshToken(),
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
      const refreshToken = sessionTokenStore.getRefreshToken();
      const response = await refreshSessionServerFn({
        data: { refreshToken },
      });
      sessionTokenStore.set({
        accessToken: response.session.accessToken,
        refreshToken: response.session.refreshToken ?? null,
        expiresAt: response.session.expiresAt,
      });
      await syncLegacyBrowserClientSession({
        accessToken: response.session.accessToken,
        refreshToken: response.session.refreshToken,
      });
      return response.session;
    } catch {
      sessionTokenStore.clear();
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

  async provisionFirstAdmin(name: string): Promise<AppUserWithDetails> {
    return provisionFirstAdminServerFn({ data: { name } });
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
