import type { SupabaseClient } from "@supabase/supabase-js";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/server/errors/app-error";
import { mapSupabaseError } from "@/lib/server/errors/supabase-error.mapper";
import type {
  AuthRepository,
  BootstrapFirstAdminParams,
} from "@/lib/server/repositories/auth.repository";
import type {
  AppUserWithDetails,
  AuthAuditLog,
  AuthIdentityRecord,
  CreateAuthAuditLogInput,
} from "@/types/auth";
import type { JsonValue } from "@/types/erp";
import { isMissingTableError } from "./permissions.repository";
import { createAdminSupabaseClient, isSupabaseAdminConfigured } from "./supabase-client.server";
import { SupabaseUsersRepository } from "./users.repository";

const FORBIDDEN_METADATA_KEYS = new Set([
  "password",
  "senha",
  "token",
  "access_token",
  "refresh_token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "bootstrapsecret",
  "bootstrap_secret",
  "service_role",
  "cookie",
  "authorization",
]);

function isMissingFunctionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = String((error as { code?: string }).code ?? "");
  const message = String((error as { message?: string }).message ?? "").toLowerCase();
  return (
    code === "42883" ||
    code === "PGRST202" ||
    message.includes("could not find the function") ||
    (message.includes("function") && message.includes("does not exist"))
  );
}

function sanitizeAuditMetadata(value: JsonValue | undefined): JsonValue {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditMetadata(item));
  }
  const clean: { [key: string]: JsonValue | undefined } = {};
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_METADATA_KEYS.has(k.toLowerCase())) {
      continue;
    }
    clean[k] = sanitizeAuditMetadata(v);
  }
  return clean;
}

export class SupabaseAuthRepository implements AuthRepository {
  private readonly usersRepo: SupabaseUsersRepository;

  constructor(private readonly client: SupabaseClient) {
    this.usersRepo = new SupabaseUsersRepository(client);
  }

  async findUserByIdentityOrEmail(params: {
    provider: string;
    providerSubject: string;
    email?: string | null;
  }): Promise<AppUserWithDetails | null> {
    const { data: identityRow, error: idErr } = await this.client
      .from("auth_identities")
      .select("app_user_id")
      .eq("provider", params.provider)
      .eq("provider_subject", params.providerSubject)
      .maybeSingle();

    if (idErr && !isMissingTableError(idErr)) {
      throw mapSupabaseError(idErr, "Erro ao consultar identidade de autenticação.");
    }

    if (identityRow && (identityRow as { app_user_id?: string }).app_user_id) {
      const user = await this.usersRepo.getById(
        String((identityRow as { app_user_id: string }).app_user_id),
      );
      if (user) return user;
    }

    if (params.email) {
      return this.usersRepo.getByEmail(params.email);
    }

    return null;
  }

  async linkAndTouchIdentity(params: {
    appUserId: string;
    provider: string;
    providerSubject: string;
    selfService?: boolean;
  }): Promise<AuthIdentityRecord> {
    if (params.selfService) {
      const { data: rpcData, error: rpcErr } = await this.client.rpc(
        "link_and_touch_current_identity",
        { p_provider: params.provider },
      );

      if (!rpcErr && rpcData) {
        return rpcData as AuthIdentityRecord;
      }

      if (rpcErr && !isMissingFunctionError(rpcErr)) {
        throw mapSupabaseError(rpcErr, "Erro ao vincular identidade do provedor de autenticação.");
      }

      if (!params.appUserId) {
        throw mapSupabaseError(rpcErr, "Identidade interna não encontrada para vínculo.");
      }
    }

    const now = new Date().toISOString();

    const { data: identityData, error: idErr } = await this.client
      .from("auth_identities")
      .upsert(
        {
          app_user_id: params.appUserId,
          provider: params.provider,
          provider_subject: params.providerSubject,
          last_authenticated_at: now,
        },
        { onConflict: "provider,provider_subject" },
      )
      .select("id, app_user_id, provider, provider_subject, created_at, last_authenticated_at")
      .single();

    if (idErr) {
      throw mapSupabaseError(idErr, "Erro ao vincular identidade do provedor de autenticação.");
    }

    if (params.selfService) {
      const current = await this.usersRepo.getById(params.appUserId);
      const nextStatus = current?.status === "invited" ? "active" : current?.status;

      await this.client
        .from("app_users")
        .update({
          last_login_at: now,
          ...(nextStatus ? { status: nextStatus } : {}),
        })
        .eq("id", params.appUserId);
    }

    return identityData as AuthIdentityRecord;
  }

  async bootstrapFirstAdmin(params: BootstrapFirstAdminParams): Promise<AppUserWithDetails> {
    if (!isSupabaseAdminConfigured()) {
      throw new ValidationError(
        "O provisionamento seguro via interface requer SUPABASE_SERVICE_ROLE_KEY configurada no servidor. Alternativamente, execute `SELECT public.bootstrap_first_admin(...)` diretamente no console SQL administrativo do banco.",
      );
    }

    const adminClient = createAdminSupabaseClient();

    const { data: userId, error } = await adminClient.rpc("bootstrap_first_admin", {
      p_name: params.name.trim(),
      p_email: params.email.trim().toLowerCase(),
      p_provider: params.provider.trim().toLowerCase(),
      p_provider_subject: params.providerSubject.trim(),
      p_ip_address: params.ipAddress ?? null,
      p_user_agent: params.userAgent ?? null,
    });

    if (error) {
      if (isMissingFunctionError(error) || isMissingTableError(error)) {
        throw new ValidationError(
          "A estrutura de banco de dados da Fase A ainda não foi aplicada no Supabase. Aplique a migration SQL autorizada primeiro.",
        );
      }

      const rawMsg = String((error as { message?: string }).message ?? "");
      if (
        rawMsg.includes("BOOTSTRAP_ALREADY_COMPLETED") ||
        String((error as { code?: string }).code ?? "") === "42501"
      ) {
        throw new ForbiddenError(
          "Operação bloqueada: o sistema já possui usuários ou administrador ativo provisionado.",
        );
      }

      throw mapSupabaseError(
        error,
        "Não foi possível concluir o bootstrap atômico do primeiro administrador.",
      );
    }

    const adminUsersRepo = new SupabaseUsersRepository(adminClient);
    const provisioned = await adminUsersRepo.getById(String(userId));
    if (!provisioned) {
      throw new NotFoundError("Administrador provisionado não pôde ser recuperado.");
    }

    return provisioned;
  }

  async writeAuditLog(input: CreateAuthAuditLogInput): Promise<void> {
    const safeMetadata = sanitizeAuditMetadata(input.metadata);
    const { error } = await this.client.from("auth_audit_log").insert({
      user_id: input.user_id ?? null,
      actor_user_id: input.actor_user_id ?? null,
      event_type: input.event_type,
      description: input.description,
      ip_address: input.ip_address ?? null,
      user_agent: input.user_agent ?? null,
      metadata: safeMetadata,
    });

    if (error && !isMissingTableError(error)) {
      console.error("[AuthAuditLog] Falha ao gravar log de auditoria:", error.message);
    }
  }

  async listAuditLogs(opts?: {
    userId?: string;
    eventType?: string;
    limit?: number;
  }): Promise<AuthAuditLog[]> {
    let query = this.client
      .from("auth_audit_log")
      .select(
        "id, user_id, actor_user_id, event_type, description, ip_address, user_agent, metadata, created_at, user:app_users!auth_audit_log_user_id_fkey(id, name, email), actor:app_users!auth_audit_log_actor_user_id_fkey(id, name, email)",
      )
      .order("created_at", { ascending: false })
      .limit(opts?.limit ?? 100);

    if (opts?.userId) {
      query = query.or(`user_id.eq.${opts.userId},actor_user_id.eq.${opts.userId}`);
    }
    if (opts?.eventType && opts.eventType !== "todos") {
      query = query.eq("event_type", opts.eventType);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        return [];
      }
      throw mapSupabaseError(error, "Erro ao consultar histórico de auditoria de acessos.");
    }

    return (data ?? []).map((row) => {
      const r = row as Record<string, unknown>;
      const userObj = Array.isArray(r.user) ? r.user[0] : r.user;
      const actorObj = Array.isArray(r.actor) ? r.actor[0] : r.actor;
      return {
        ...(r as unknown as AuthAuditLog),
        user: (userObj as AuthAuditLog["user"]) ?? null,
        actor: (actorObj as AuthAuditLog["actor"]) ?? null,
      };
    });
  }

  async hasAnyActiveAdmin(): Promise<boolean> {
    const { data, error } = await this.client.rpc("has_any_active_admin");
    if (!error && typeof data === "boolean") {
      return data;
    }

    if (error && isMissingFunctionError(error)) {
      const count = await this.usersRepo.countActiveAdmins();
      return count > 0;
    }

    return false;
  }
}
