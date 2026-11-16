import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseServerAuthAdapter } from "@/lib/server/adapters/supabase/auth.adapter";
import { isSupabaseAdminConfigured } from "@/lib/server/adapters/supabase/supabase-client.server";
import { resolveServerExecutionContext } from "@/lib/server/auth/auth.middleware";
import { requirePermission } from "@/lib/server/auth/authorization";
import { NotFoundError } from "@/lib/server/errors/app-error";
import type { AppUserWithDetails, AuthAuditLog } from "@/types/auth";

const listUsersFilterSchema = z
  .object({
    search: z.string().optional(),
    roleCode: z.string().optional(),
    status: z.enum(["active", "inactive", "invited", "suspended", "todos"]).optional(),
  })
  .optional();

const getUserByIdSchema = z.object({
  id: z.string().uuid("ID de usuário inválido."),
});

const createUserSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do usuário."),
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().optional(),
  status: z.enum(["active", "inactive", "invited", "suspended"]).optional(),
  avatar_url: z.string().nullable().optional(),
  roleIds: z.array(z.string()).min(1, "Selecione pelo menos um perfil de acesso."),
  sendInvite: z.boolean().optional(),
});

const updateUserSchema = z.object({
  id: z.string().uuid("ID de usuário inválido."),
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email().optional(),
  status: z.enum(["active", "inactive", "invited", "suspended"]).optional(),
  avatar_url: z.string().nullable().optional(),
  roleIds: z.array(z.string()).optional(),
});

const setUserStatusSchema = z.object({
  id: z.string().uuid("ID de usuário inválido."),
  status: z.enum(["active", "inactive", "invited", "suspended"]),
});

const listAuditLogsSchema = z
  .object({
    userId: z.string().uuid().optional(),
    eventType: z.string().optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .optional();

export interface CreateUserServerResponse {
  user: AppUserWithDetails;
  externalIdentityProvisioned: boolean;
  provisioningNotice?: string;
}

export const listUsersServerFn = createServerFn({ method: "GET", strict: false })
  .validator((data: unknown) => listUsersFilterSchema.parse(data))
  .handler(async ({ data }): Promise<AppUserWithDetails[]> => {
    const ctx = await resolveServerExecutionContext();
    await requirePermission(ctx.auth, "usuarios.view", ctx.repos);
    return ctx.repos.users.list(data);
  });

export const getUserByIdServerFn = createServerFn({ method: "GET", strict: false })
  .validator((data: unknown) => getUserByIdSchema.parse(data))
  .handler(async ({ data }): Promise<AppUserWithDetails> => {
    const ctx = await resolveServerExecutionContext();
    await requirePermission(ctx.auth, "usuarios.view", ctx.repos);
    const user = await ctx.repos.users.getById(data.id);
    if (!user) {
      throw new NotFoundError("Usuário não encontrado.");
    }
    return user;
  });

export const createUserServerFn = createServerFn({ method: "POST", strict: false })
  .validator((data: unknown) => createUserSchema.parse(data))
  .handler(async ({ data }): Promise<CreateUserServerResponse> => {
    const ctx = await resolveServerExecutionContext();
    await requirePermission(ctx.auth, "usuarios.create", ctx.repos);

    const initialStatus = data.status ?? (isSupabaseAdminConfigured() ? "active" : "invited");

    let user = await ctx.repos.users.create(
      {
        name: data.name,
        email: data.email,
        status: initialStatus,
        avatar_url: data.avatar_url ?? null,
        roleIds: data.roleIds,
      },
      ctx.auth.userId,
    );

    const provisionResult = await supabaseServerAuthAdapter.provisionExternalIdentity({
      email: data.email,
      name: data.name,
      password: data.password,
      sendInvite: data.sendInvite,
    });

    if (provisionResult.provisioned && provisionResult.providerSubject) {
      await ctx.repos.auth.linkAndTouchIdentity({
        appUserId: user.id,
        provider: "supabase",
        providerSubject: provisionResult.providerSubject,
      });
      user = (await ctx.repos.users.getById(user.id)) ?? user;
    }

    await ctx.repos.auth.writeAuditLog({
      user_id: user.id,
      actor_user_id: ctx.auth.userId,
      event_type: "USER_CREATED",
      description: `Usuário "${user.name}" (${user.email}) criado com ${user.roles.length} perfil(is): ${user.roles.map((r) => r.name).join(", ")}.`,
      ip_address: ctx.auth.ipAddress,
      user_agent: ctx.auth.userAgent,
      metadata: {
        created_user_id: user.id,
        email: user.email,
        roles: user.roles.map((r) => r.code),
        external_provisioned: provisionResult.provisioned,
      },
    });

    return {
      user,
      externalIdentityProvisioned: provisionResult.provisioned,
      provisioningNotice: provisionResult.notice,
    };
  });

export const updateUserServerFn = createServerFn({ method: "POST", strict: false })
  .validator((data: unknown) => updateUserSchema.parse(data))
  .handler(async ({ data }): Promise<AppUserWithDetails> => {
    const ctx = await resolveServerExecutionContext();
    await requirePermission(ctx.auth, "usuarios.update", ctx.repos);

    const previous = await ctx.repos.users.getById(data.id);
    if (!previous) {
      throw new NotFoundError("Usuário não encontrado.");
    }

    const updated = await ctx.repos.users.update(
      data.id,
      {
        name: data.name,
        email: data.email,
        status: data.status,
        avatar_url: data.avatar_url,
        roleIds: data.roleIds,
      },
      ctx.auth.userId,
    );

    await ctx.repos.auth.writeAuditLog({
      user_id: updated.id,
      actor_user_id: ctx.auth.userId,
      event_type: data.roleIds !== undefined ? "USER_ROLES_UPDATED" : "USER_UPDATED",
      description: `Usuário "${updated.name}" (${updated.email}) atualizado. Perfis atuais: ${updated.roles.map((r) => r.name).join(", ") || "nenhum"}.`,
      ip_address: ctx.auth.ipAddress,
      user_agent: ctx.auth.userAgent,
      metadata: {
        previous_roles: previous.roles.map((r) => r.code),
        new_roles: updated.roles.map((r) => r.code),
        previous_status: previous.status,
        new_status: updated.status,
      },
    });

    return updated;
  });

export const setUserStatusServerFn = createServerFn({ method: "POST", strict: false })
  .validator((data: unknown) => setUserStatusSchema.parse(data))
  .handler(async ({ data }): Promise<AppUserWithDetails> => {
    const ctx = await resolveServerExecutionContext();
    await requirePermission(ctx.auth, "usuarios.deactivate", ctx.repos);

    const updated = await ctx.repos.users.setStatus(data.id, data.status, ctx.auth.userId);

    const isActivating = data.status === "active";
    await ctx.repos.auth.writeAuditLog({
      user_id: updated.id,
      actor_user_id: ctx.auth.userId,
      event_type: isActivating ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      description: `Status do usuário "${updated.name}" (${updated.email}) alterado para "${updated.status}".`,
      ip_address: ctx.auth.ipAddress,
      user_agent: ctx.auth.userAgent,
      metadata: {
        status: updated.status,
      },
    });

    return updated;
  });

export const listAuthAuditLogsServerFn = createServerFn({ method: "GET", strict: false })
  .validator((data: unknown) => listAuditLogsSchema.parse(data))
  .handler(async ({ data }): Promise<AuthAuditLog[]> => {
    const ctx = await resolveServerExecutionContext();
    await requirePermission(ctx.auth, "usuarios.view", ctx.repos);
    return ctx.repos.auth.listAuditLogs(data);
  });
