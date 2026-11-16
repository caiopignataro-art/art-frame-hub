/**
 * Serviço Client-Safe de Gestão de Usuários e Auditoria de Acessos.
 * Comunica-se exclusivamente com as Server Functions (`users.functions.ts`).
 */
import type { UsersListFilter } from "@/lib/server/repositories/users.repository";
import {
  createUserServerFn,
  getUserByIdServerFn,
  listAuthAuditLogsServerFn,
  listUsersServerFn,
  setUserStatusServerFn,
  updateUserServerFn,
  type CreateUserServerResponse,
} from "@/lib/server/functions/users.functions";
import type {
  AppUserStatus,
  AppUserWithDetails,
  AuthAuditLog,
  CreateUserInput,
  UpdateUserInput,
} from "@/types/auth";

export const usersKeys = {
  all: ["admin", "users"] as const,
  list: (filter?: UsersListFilter) => ["admin", "users", "list", filter ?? {}] as const,
  detail: (id: string) => ["admin", "users", "detail", id] as const,
  auditLogs: (opts?: { userId?: string; eventType?: string; limit?: number }) =>
    ["admin", "auth-audit-logs", opts ?? {}] as const,
};

export const usersService = {
  async list(filter?: UsersListFilter): Promise<AppUserWithDetails[]> {
    return listUsersServerFn({ data: filter });
  },

  async getById(id: string): Promise<AppUserWithDetails> {
    return getUserByIdServerFn({ data: { id } });
  },

  async create(input: CreateUserInput): Promise<CreateUserServerResponse> {
    return createUserServerFn({ data: input });
  },

  async update(id: string, input: UpdateUserInput): Promise<AppUserWithDetails> {
    return updateUserServerFn({ data: { id, ...input } });
  },

  async setStatus(id: string, status: AppUserStatus): Promise<AppUserWithDetails> {
    return setUserStatusServerFn({ data: { id, status } });
  },

  async listAuditLogs(opts?: {
    userId?: string;
    eventType?: string;
    limit?: number;
  }): Promise<AuthAuditLog[]> {
    return listAuthAuditLogsServerFn({ data: opts });
  },
};
