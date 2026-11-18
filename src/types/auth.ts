/**
 * Tipos de Autenticação, Usuários Internos e Auditoria de Acessos.
 * Desacoplados estruturalmente do Supabase Auth para permitir futura migração ao PostgreSQL local.
 */
import type { JsonValue } from "./erp";
import type { Permission, Role } from "./permissions";

export type AppUserStatus = "active" | "inactive" | "invited" | "suspended";

export const APP_USER_STATUS_LABEL: Record<AppUserStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  invited: "Convidado",
  suspended: "Suspenso",
};

export type AuthProviderType = "supabase" | "local";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  status: AppUserStatus;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  deactivated_at: string | null;
}

export interface AuthIdentityRecord {
  id: string;
  app_user_id: string;
  provider: AuthProviderType | string;
  provider_subject: string;
  created_at: string;
  last_authenticated_at: string | null;
}

export interface UserRoleAssignment {
  id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  assigned_by: string | null;
}

export interface AppUserWithDetails extends AppUser {
  roles: Role[];
  permissions: string[];
  identities: AuthIdentityRecord[];
}

export interface CreateUserInput {
  name: string;
  email: string;
  password?: string;
  status?: AppUserStatus;
  avatar_url?: string | null;
  roleIds: string[];
  sendInvite?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  email?: string;
  status?: AppUserStatus;
  avatar_url?: string | null;
  roleIds?: string[];
}

// ---------- Eventos de Auditoria de Segurança e Acessos ----------
export type AuthAuditEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "PASSWORD_RESET_REQUESTED"
  | "SESSION_REFRESHED"
  | "USER_CREATED"
  | "USER_UPDATED"
  | "USER_ACTIVATED"
  | "USER_DEACTIVATED"
  | "USER_ROLES_UPDATED"
  | "ROLE_CREATED"
  | "ROLE_UPDATED"
  | "ROLE_DELETED"
  | "ROLE_PERMISSIONS_UPDATED"
  | "UNAUTHORIZED_ACCESS"
  | "FIRST_ADMIN_PROVISIONED";

export const AUTH_AUDIT_EVENT_LABELS: Record<AuthAuditEventType, string> = {
  LOGIN_SUCCESS: "Login bem-sucedido",
  LOGIN_FAILED: "Tentativa de login malsucedida",
  LOGOUT: "Logout realizado",
  PASSWORD_RESET_REQUESTED: "Recuperação de senha solicitada",
  SESSION_REFRESHED: "Sessão renovada",
  USER_CREATED: "Usuário criado",
  USER_UPDATED: "Usuário atualizado",
  USER_ACTIVATED: "Usuário reativado",
  USER_DEACTIVATED: "Usuário desativado",
  USER_ROLES_UPDATED: "Perfis do usuário alterados",
  ROLE_CREATED: "Perfil de acesso criado",
  ROLE_UPDATED: "Perfil de acesso atualizado",
  ROLE_DELETED: "Perfil de acesso excluído",
  ROLE_PERMISSIONS_UPDATED: "Permissões de perfil alteradas",
  UNAUTHORIZED_ACCESS: "Tentativa de acesso não autorizado",
  FIRST_ADMIN_PROVISIONED: "Primeiro administrador provisionado",
};

export interface AuthAuditLog {
  id: string;
  user_id: string | null;
  actor_user_id: string | null;
  event_type: AuthAuditEventType | string;
  description: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: JsonValue;
  created_at: string;
  user?: Pick<AppUser, "id" | "name" | "email"> | null;
  actor?: Pick<AppUser, "id" | "name" | "email"> | null;
}

export interface CreateAuthAuditLogInput {
  user_id?: string | null;
  actor_user_id?: string | null;
  event_type: AuthAuditEventType | string;
  description: string;
  ip_address?: string | null;
  user_agent?: string | null;
  metadata?: JsonValue;
}

// ---------- Contratos de Sessão e Contexto ----------
export interface SignInInput {
  email: string;
  password: string;
}

export interface AuthIdentity {
  provider: AuthProviderType | string;
  providerSubject: string;
  email: string;
  name?: string | null;
  emailVerified?: boolean;
}

export interface AuthSession {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: number | null;
  identity: AuthIdentity;
  user: AppUserWithDetails | null;
}

export interface AuthContext {
  /** ID do usuário interno em `app_users` (UUID). */
  userId: string | null;
  /** Sujeito no provedor externo (ex.: `sub` do JWT no Supabase Auth). */
  providerSubject: string | null;
  email: string | null;
  name: string | null;
  status: AppUserStatus | null;
  isAuthenticated: boolean;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  ipAddress: string | null;
  userAgent: string | null;
}

export interface AuthProviderContract {
  signIn(input: SignInInput): Promise<AuthSession>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  getCurrentUser(): Promise<AuthIdentity | null>;
  refreshSession(): Promise<AuthSession | null>;
  requestPasswordReset(email: string): Promise<void>;
}

export interface UserPermissionsSummary {
  user: AppUser;
  roles: Role[];
  permissions: Permission[];
  permissionCodes: string[];
}
