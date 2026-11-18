import { UnauthorizedError, ValidationError } from "@/lib/server/errors/app-error";
import { mapSupabaseError } from "@/lib/server/errors/supabase-error.mapper";
import type { AuthIdentity, SignInInput } from "@/types/auth";
import {
  createAdminSupabaseClient,
  createRequestSupabaseClient,
  isSupabaseAdminConfigured,
} from "./supabase-client.server";

export interface RawProviderSession {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number | null;
  identity: AuthIdentity;
}

export interface ProvisionExternalUserResult {
  provisioned: boolean;
  providerSubject: string | null;
  notice?: string;
}

/**
 * Adapter Server-Side de Autenticação usando Supabase Auth.
 * Isolado na camada de infraestrutura para futura substituição por LocalAuthAdapter (PostgreSQL).
 */
export class SupabaseServerAuthAdapter {
  readonly providerName = "supabase" as const;

  async verifyAccessToken(accessToken: string): Promise<AuthIdentity> {
    const clean = accessToken.trim();
    if (!clean) {
      throw new UnauthorizedError("Token de autenticação não fornecido.");
    }

    const client = createRequestSupabaseClient(clean);
    const { data, error } = await client.auth.getUser(clean);

    if (error || !data?.user) {
      throw new UnauthorizedError("Sessão inválida ou expirada. Faça login novamente.");
    }

    const user = data.user;
    if (!user.id) {
      throw new UnauthorizedError("Identificador do usuário ausente no token.");
    }

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const rawName =
      (typeof meta.name === "string" && meta.name) ||
      (typeof meta.full_name === "string" && meta.full_name) ||
      null;

    return {
      provider: this.providerName,
      providerSubject: user.id,
      email: (user.email ?? "").toLowerCase(),
      name: rawName,
      emailVerified: Boolean(user.email_confirmed_at || user.confirmed_at),
    };
  }

  async signInWithPassword(input: SignInInput): Promise<RawProviderSession> {
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (!email || !password) {
      throw new ValidationError("Informe seu e-mail e sua senha.");
    }

    const client = createRequestSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session || !data.user) {
      throw mapSupabaseError(error, "E-mail ou senha inválidos.");
    }

    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const rawName =
      (typeof meta.name === "string" && meta.name) ||
      (typeof meta.full_name === "string" && meta.full_name) ||
      null;

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token ?? null,
      expiresAt: data.session.expires_at ?? null,
      identity: {
        provider: this.providerName,
        providerSubject: data.user.id,
        email: (data.user.email ?? email).toLowerCase(),
        name: rawName,
        emailVerified: Boolean(data.user.email_confirmed_at || data.user.confirmed_at),
      },
    };
  }

  async refreshSession(refreshToken: string): Promise<RawProviderSession> {
    const clean = refreshToken.trim();
    if (!clean) {
      throw new UnauthorizedError("Refresh token não informado.");
    }

    const client = createRequestSupabaseClient();
    const { data, error } = await client.auth.refreshSession({
      refresh_token: clean,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedError("Não foi possível renovar a sessão. Faça login novamente.");
    }

    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const rawName =
      (typeof meta.name === "string" && meta.name) ||
      (typeof meta.full_name === "string" && meta.full_name) ||
      null;

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token ?? null,
      expiresAt: data.session.expires_at ?? null,
      identity: {
        provider: this.providerName,
        providerSubject: data.user.id,
        email: (data.user.email ?? "").toLowerCase(),
        name: rawName,
        emailVerified: Boolean(data.user.email_confirmed_at || data.user.confirmed_at),
      },
    };
  }

  async signOut(accessToken?: string | null): Promise<void> {
    if (!accessToken) return;
    const client = createRequestSupabaseClient(accessToken);
    await client.auth.signOut();
  }

  async requestPasswordReset(email: string, redirectTo?: string): Promise<void> {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new ValidationError("Informe um endereço de e-mail válido para recuperação de senha.");
    }

    const client = createRequestSupabaseClient();
    const { error } = await client.auth.resetPasswordForEmail(
      normalized,
      redirectTo ? { redirectTo } : undefined,
    );

    if (error) {
      throw mapSupabaseError(error, "Não foi possível enviar o e-mail de recuperação de senha.");
    }
  }

  /**
   * Provisiona ou convida o usuário no Supabase Auth via Admin API, exclusivamente no servidor.
   * Nunca expõe `SUPABASE_SERVICE_ROLE_KEY` ao cliente nem faz fallback para cadastro público.
   */
  async provisionExternalIdentity(params: {
    email: string;
    name: string;
    password?: string;
    sendInvite?: boolean;
  }): Promise<ProvisionExternalUserResult> {
    if (!isSupabaseAdminConfigured()) {
      return {
        provisioned: false,
        providerSubject: null,
        notice:
          "Cadastro interno concluído em app_users. O provisionamento/convite automático no Supabase Auth requer a variável SUPABASE_SERVICE_ROLE_KEY configurada no servidor (caso o usuário já possua credencial no Supabase Auth, o vínculo ocorrerá automaticamente no primeiro login).",
      };
    }

    const adminClient = createAdminSupabaseClient();
    const email = params.email.trim().toLowerCase();

    if (params.password && params.password.trim().length >= 6) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password: params.password,
        email_confirm: true,
        user_metadata: { name: params.name.trim() },
      });

      if (error) {
        throw mapSupabaseError(
          error,
          "Falha ao provisionar credencial do usuário no provedor de autenticação.",
        );
      }

      return {
        provisioned: true,
        providerSubject: data.user?.id ?? null,
      };
    }

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { name: params.name.trim() },
    });

    if (error) {
      throw mapSupabaseError(
        error,
        "Falha ao enviar convite de acesso pelo provedor de autenticação.",
      );
    }

    return {
      provisioned: true,
      providerSubject: data.user?.id ?? null,
    };
  }
}

export const supabaseServerAuthAdapter = new SupabaseServerAuthAdapter();
