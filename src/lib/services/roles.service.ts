/**
 * Serviço Client-Safe de Gestão de Perfis (Roles) e Permissões Granulares.
 * Comunica-se exclusivamente com as Server Functions (`roles.functions.ts` e `permissions.functions.ts`).
 */
import {
  listPermissionsServerFn,
  setRolePermissionsServerFn,
} from "@/lib/server/functions/permissions.functions";
import {
  createRoleServerFn,
  deleteRoleServerFn,
  getRoleByIdServerFn,
  listRolesServerFn,
  listUsersByRoleServerFn,
  updateRoleServerFn,
} from "@/lib/server/functions/roles.functions";
import type { AppUser } from "@/types/auth";
import type {
  CreateRoleInput,
  Permission,
  PermissionModule,
  RoleWithDetails,
  UpdateRoleInput,
} from "@/types/permissions";

export const rolesKeys = {
  all: ["admin", "roles"] as const,
  detail: (id: string) => ["admin", "roles", id] as const,
  usersByRole: (roleId: string) => ["admin", "roles", roleId, "users"] as const,
  permissions: (module?: PermissionModule) => ["admin", "permissions", module ?? "all"] as const,
};

export const rolesService = {
  async list(): Promise<RoleWithDetails[]> {
    return listRolesServerFn();
  },

  async getById(id: string): Promise<RoleWithDetails> {
    return getRoleByIdServerFn({ data: { id } });
  },

  async create(input: CreateRoleInput): Promise<RoleWithDetails> {
    return createRoleServerFn({ data: input });
  },

  async update(id: string, input: UpdateRoleInput): Promise<RoleWithDetails> {
    return updateRoleServerFn({ data: { id, ...input } });
  },

  async remove(id: string): Promise<void> {
    await deleteRoleServerFn({ data: { id } });
  },

  async listUsersByRole(roleId: string): Promise<AppUser[]> {
    return listUsersByRoleServerFn({ data: { id: roleId } });
  },

  async listPermissions(module?: PermissionModule): Promise<Permission[]> {
    return listPermissionsServerFn({ data: module ? { module } : undefined });
  },

  async setRolePermissions(roleId: string, permissionIds: string[]): Promise<RoleWithDetails> {
    return setRolePermissionsServerFn({ data: { roleId, permissionIds } });
  },
};
