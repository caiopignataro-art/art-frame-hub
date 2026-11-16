import type {
  AppUserWithDetails,
  AuthAuditLog,
  AuthIdentityRecord,
  CreateAuthAuditLogInput,
} from "@/types/auth";

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
   */
  linkAndTouchIdentity(params: {
    appUserId: string;
    provider: string;
    providerSubject: string;
  }): Promise<AuthIdentityRecord>;

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
