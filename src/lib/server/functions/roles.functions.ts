import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { resolveServerExecutionContext } from "@/lib/server/auth/auth.middleware";
import { requireAnyPermission } from "@/lib/server/auth/authorization";
import { NotFoundError } from "@/lib/server/errors/app-error";
import type { AppUser } from "@/types/auth";
import type { RoleWithDetails } from "@/types/permissions";

const getRoleByIdSchema = z.object({
  id: z.string().min(1),
});

const createRoleSchema = z.object({
  code: z.string().trim().min(2, "Informe o código do perfil."),
  name: z.string().trim().min(2, "Informe o nome do perfil."),
  description: z.string().nullable().optional(),
  active: z.boolean().optional(),
  permissionIds: z.array(z.string()).optional(),
  permissionCodes: z.array(z.string()).optional(),
});

const updateRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).optional(),
  description: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

const deleteRoleSchema = z.object({
  id: z.string().min(1),
});

export const listRolesServerFn = createServerFn({ method: "GET", strict: false }).handler(
  async (): Promise<RoleWithDetails[]> => {
    const ctx = await resolveServerExecutionContext();
    await requireAnyPermission(
      ctx.auth,
      ["perfis.view", "roles.manage", "usuarios.view"],
      ctx.repos,
    );
    return ctx.repos.roles.list();
  },
);

export const getRoleByIdServerFn = createServerFn({ method: "GET", strict: false })
  .validator((data: unknown) => getRoleByIdSchema.parse(data))
  .handler(async ({ data }): Promise<RoleWithDetails> => {
    const ctx = await resolveServerExecutionContext();
    await requireAnyPermission(ctx.auth, ["perfis.view", "roles.manage"], ctx.repos);
    const role = await ctx.repos.roles.getById(data.id);
    if (!role) {
      throw new NotFoundError("Perfil de acesso não encontrado.");
    }
    return role;
  });

export const createRoleServerFn = createServerFn({ method: "POST", strict: false })
  .validator((data: unknown) => createRoleSchema.parse(data))
  .handler(async ({ data }): Promise<RoleWithDetails> => {
    const ctx = await resolveServerExecutionContext();
    await requireAnyPermission(ctx.auth, ["perfis.create", "roles.manage"], ctx.repos);

    const created = await ctx.repos.roles.create(data);

    await ctx.repos.auth.writeAuditLog({
      user_id: ctx.auth.userId,
      actor_user_id: ctx.auth.userId,
      event_type: "ROLE_CREATED",
      description: `Perfil personalizado "${created.name}" (${created.code}) criado.`,
      ip_address: ctx.auth.ipAddress,
      user_agent: ctx.auth.userAgent,
      metadata: {
        role_id: created.id,
        code: created.code,
        permissions_count: created.permissions.length,
      },
    });

    return created;
  });

export const updateRoleServerFn = createServerFn({ method: "POST", strict: false })
  .validator((data: unknown) => updateRoleSchema.parse(data))
  .handler(async ({ data }): Promise<RoleWithDetails> => {
    const ctx = await resolveServerExecutionContext();
    await requireAnyPermission(ctx.auth, ["perfis.update", "roles.manage"], ctx.repos);

    const updated = await ctx.repos.roles.update(data.id, {
      name: data.name,
      description: data.description,
      active: data.active,
    });

    await ctx.repos.auth.writeAuditLog({
      user_id: ctx.auth.userId,
      actor_user_id: ctx.auth.userId,
      event_type: "ROLE_UPDATED",
      description: `Perfil "${updated.name}" (${updated.code}) atualizado (ativo: ${updated.active ? "sim" : "não"}).`,
      ip_address: ctx.auth.ipAddress,
      user_agent: ctx.auth.userAgent,
      metadata: {
        role_id: updated.id,
        code: updated.code,
        active: updated.active,
      },
    });

    return updated;
  });

export const deleteRoleServerFn = createServerFn({ method: "POST", strict: false })
  .validator((data: unknown) => deleteRoleSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: true }> => {
    const ctx = await resolveServerExecutionContext();
    await requireAnyPermission(ctx.auth, ["perfis.delete", "roles.manage"], ctx.repos);

    const existing = await ctx.repos.roles.getById(data.id);
    await ctx.repos.roles.delete(data.id);

    if (existing) {
      await ctx.repos.auth.writeAuditLog({
        user_id: ctx.auth.userId,
        actor_user_id: ctx.auth.userId,
        event_type: "ROLE_DELETED",
        description: `Perfil personalizado "${existing.name}" (${existing.code}) excluído.`,
        ip_address: ctx.auth.ipAddress,
        user_agent: ctx.auth.userAgent,
        metadata: {
          role_id: existing.id,
          code: existing.code,
        },
      });
    }

    return { success: true };
  });

export const listUsersByRoleServerFn = createServerFn({ method: "GET", strict: false })
  .validator((data: unknown) => getRoleByIdSchema.parse(data))
  .handler(async ({ data }): Promise<AppUser[]> => {
    const ctx = await resolveServerExecutionContext();
    await requireAnyPermission(ctx.auth, ["perfis.view", "roles.manage"], ctx.repos);
    return ctx.repos.roles.listUsersByRole(data.id);
  });
