import type { AppUser } from "@/types/auth";
import type { CreateRoleInput, RoleWithDetails, UpdateRoleInput } from "@/types/permissions";

export interface RolesRepository {
  list(): Promise<RoleWithDetails[]>;
  getById(id: string): Promise<RoleWithDetails | null>;
  getByCode(code: string): Promise<RoleWithDetails | null>;
  create(input: CreateRoleInput): Promise<RoleWithDetails>;
  update(id: string, input: UpdateRoleInput): Promise<RoleWithDetails>;
  delete(id: string): Promise<void>;
  setPermissions(roleId: string, permissionIds: string[]): Promise<RoleWithDetails>;
  listUsersByRole(roleId: string): Promise<AppUser[]>;
}
