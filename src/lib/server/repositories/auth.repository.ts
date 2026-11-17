import type {
  AppUserWithDetails,
  AuthAuditLog,
  AuthIdentityRecord,
  CreateAuthAuditLogInput,
} from "@/types/auth";

export interface BootstrapFirstAdminParams {
  name: string;
  email: string;
  provider: string;
  providerSubject: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface AuthRepository {
  /**
   * Localiza o usuário interno (`app_users`) vinculado a uma identidade de provedor
   * (ex.: `provider = 'supabase'`, `providerSubject = sub do JWT`) ou por e-mail.
   */
  findUserByIdentityOrEmail(params: {
    provider: string;
    providerSubject: string;
    email?: string | null;
  }): Promise<AppUserWithDetails | null>;

  /**
   * Registra ou atualiza o vínculo em `auth_identities` e o `last_login_at` do usuário.
   * Quando `selfService = true`, executa via RPC controlada `link_and_touch_current_identity`.
   */
  linkAndTouchIdentity(params: {
    appUserId: string;
    provider: string;
    providerSubject: string;
    selfService?: boolean;
  }): Promise<AuthIdentityRecord>;

  /**
   * Executa o provisionamento atômico e protegido contra concorrência do primeiro
   * administrador no banco (`public.bootstrap_first_admin`).
   */
  bootstrapFirstAdmin(params: BootstrapFirstAdminParams): Promise<AppUserWithDetails>;

  /**
   * Registra evento de auditoria de segurança / acesso em `auth_audit_log`.
   */
  writeAuditLog(input: CreateAuthAuditLogInput): Promise<void>;

  /**
   * Lista eventos de auditoria de segurança (`auth_audit_log`).
   */
  listAuditLogs(opts?: {
    userId?: string;
    eventType?: string;
    limit?: number;
  }): Promise<AuthAuditLog[]>;

  /**
   * Verifica se já existe ao menos um usuário administrador ativo no sistema.
   */
  hasAnyActiveAdmin(): Promise<boolean>;
}
