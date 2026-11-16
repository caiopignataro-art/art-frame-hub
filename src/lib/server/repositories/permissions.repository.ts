import type { Permission, PermissionModule } from "@/types/permissions";

export interface PermissionsRepository {
  list(opts?: { module?: PermissionModule }): Promise<Permission[]>;
  listByRoleId(roleId: string): Promise<Permission[]>;
  listByUserId(userId: string): Promise<Permission[]>;
}
