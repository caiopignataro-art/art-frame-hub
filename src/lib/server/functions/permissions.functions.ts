import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveServerExecutionContext } from "@/lib/server/auth/auth.middleware";
import { requireAnyPermission } from "@/lib/server/auth/authorization";
import {
  PERMISSION_MODULES,
  type Permission,
  type PermissionModule,
  type RoleWithDetails,
} from "@/types/permissions";

const listPermissionsSchema = z
  .object({
    module: z.enum(PERMISSION_MODULES).optional(),
  })
  .optional();

const setRolePermissionsSchema = z.object({
  roleId: z.string().min(1, "ID do perfil é obrigatório."),
  permissionIds: z.array(z.string()),
});

export const listPermissionsServerFn = createServerFn({ method: "GET", strict: false })
  .validator((data: unknown) => listPermissionsSchema.parse(data))
  .handler(async ({ data }): Promise<Permission[]> => {
    const ctx = await resolveServerExecutionContext();
    await requireAnyPermission(
      ctx.auth,
      ["perfis.view", "permissions.manage", "roles.manage"],
      ctx.repos,
    );
    return ctx.repos.permissions.list(
      data?.module ? { module: data.module as PermissionModule } : undefined,
    );
  });

export const setRolePermissionsServerFn = createServerFn({ method: "POST", strict: false })
  .validator((data: unknown) => setRolePermissionsSchema.parse(data))
  .handler(async ({ data }): Promise<RoleWithDetails> => {
    const ctx = await resolveServerExecutionContext();
    await requireAnyPermission(ctx.auth, ["permissions.manage", "roles.manage"], ctx.repos);

    const updated = await ctx.repos.roles.setPermissions(data.roleId, data.permissionIds);

    await ctx.repos.auth.writeAuditLog({
      user_id: ctx.auth.userId,
      actor_user_id: ctx.auth.userId,
      event_type: "ROLE_PERMISSIONS_UPDATED",
      description: `Permissões do perfil "${updated.name}" (${updated.code}) atualizadas (${updated.permissions.length} permissão(ões) ativa(s)).`,
      ip_address: ctx.auth.ipAddress,
      user_agent: ctx.auth.userAgent,
      metadata: {
        role_id: updated.id,
        role_code: updated.code,
        permission_codes: updated.permission_codes,
      },
    });

    return updated;
  });
