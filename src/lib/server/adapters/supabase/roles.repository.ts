import type { SupabaseClient } from "@supabase/supabase-js";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/server/errors/app-error";
import { mapSupabaseError } from "@/lib/server/errors/supabase-error.mapper";
import type { RolesRepository } from "@/lib/server/repositories/roles.repository";
import type { AppUser } from "@/types/auth";
import {
  INITIAL_ROLES_SEED,
  type CreateRoleInput,
  type Permission,
  type Role,
  type RoleWithDetails,
  type UpdateRoleInput,
} from "@/types/permissions";
import { buildSeedPermissionsFallback, isMissingTableError } from "./permissions.repository";

const PROTECTED_ADMIN_PERMISSIONS = [
  "usuarios.view",
  "usuarios.create",
  "usuarios.update",
  "usuarios.deactivate",
  "perfis.view",
  "perfis.update",
  "roles.manage",
  "permissions.manage",
] as const;

function buildSeedRolesFallback(): RoleWithDetails[] {
  const allSeedPerms = buildSeedPermissionsFallback();
  const permByCode = new Map(allSeedPerms.map((p) => [p.code, p]));
  const now = new Date(0).toISOString();

  return INITIAL_ROLES_SEED.map((seed) => {
    const perms = seed.permissions
      .map((code) => permByCode.get(code))
      .filter((p): p is Permission => Boolean(p));

    return {
      id: `seed-role-${seed.code}`,
      code: seed.code,
      name: seed.name,
      description: seed.description,
      is_system: true,
      active: true,
      created_at: now,
      updated_at: now,
      permissions: perms,
      permission_codes: perms.map((p) => p.code),
      users_count: 0,
    };
  });
}

export class SupabaseRolesRepository implements RolesRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<RoleWithDetails[]> {
    const { data: rolesData, error: rolesError } = await this.client
      .from("roles")
      .select("id, code, name, description, is_system, active, created_at, updated_at")
      .order("is_system", { ascending: false })
      .order("name", { ascending: true });

    if (rolesError) {
      if (isMissingTableError(rolesError)) {
        return buildSeedRolesFallback();
      }
      throw mapSupabaseError(rolesError, "Erro ao listar perfis de acesso.");
    }

    const roles = (rolesData ?? []) as Role[];
    if (roles.length === 0) {
      return [];
    }

    const [rpRes, urRes] = await Promise.all([
      this.client
        .from("role_permissions")
        .select("role_id, permission:permissions(id, code, name, module, description, created_at)"),
      this.client.from("user_roles").select("role_id, user_id"),
    ]);

    if (rpRes.error && !isMissingTableError(rpRes.error)) {
      throw mapSupabaseError(rpRes.error, "Erro ao consultar permissões dos perfis.");
    }
    if (urRes.error && !isMissingTableError(urRes.error)) {
      throw mapSupabaseError(urRes.error, "Erro ao consultar contagem de usuários por perfil.");
    }

    const permsByRole = new Map<string, Permission[]>();
    for (const row of rpRes.data ?? []) {
      const rId = String((row as { role_id: string }).role_id);
      const perm = (row as { permission?: Permission | Permission[] | null }).permission;
      const list = permsByRole.get(rId) ?? [];
      if (Array.isArray(perm)) {
        list.push(...perm);
      } else if (perm) {
        list.push(perm);
      }
      permsByRole.set(rId, list);
    }

    const countByRole = new Map<string, number>();
    for (const row of urRes.data ?? []) {
      const rId = String((row as { role_id: string }).role_id);
      countByRole.set(rId, (countByRole.get(rId) ?? 0) + 1);
    }

    return roles.map((role) => {
      const permissions = (permsByRole.get(role.id) ?? []).sort((a, b) =>
        a.code.localeCompare(b.code),
      );
      return {
        ...role,
        permissions,
        permission_codes: permissions.map((p) => p.code),
        users_count: countByRole.get(role.id) ?? 0,
      };
    });
  }

  async getById(id: string): Promise<RoleWithDetails | null> {
    const all = await this.list();
    return all.find((r) => r.id === id) ?? null;
  }

  async getByCode(code: string): Promise<RoleWithDetails | null> {
    const normalized = code.trim().toLowerCase();
    const all = await this.list();
    return all.find((r) => r.code.toLowerCase() === normalized) ?? null;
  }

  async create(input: CreateRoleInput): Promise<RoleWithDetails> {
    const code = input.code
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");

    const name = input.name.trim();
    if (!code || code.length < 2) {
      throw new ValidationError("Informe um código válido para o perfil (mínimo 2 caracteres).");
    }
    if (!name || name.length < 2) {
      throw new ValidationError("Informe um nome válido para o perfil.");
    }

    const { data: created, error: createErr } = await this.client
      .from("roles")
      .insert({
        code,
        name,
        description: input.description?.trim() || null,
        is_system: false,
        active: input.active ?? true,
      })
      .select("id, code, name, description, is_system, active, created_at, updated_at")
      .single();

    if (createErr) {
      if (isMissingTableError(createErr)) {
        throw new ValidationError(
          "As tabelas de controle de acesso ainda não foram aplicadas no banco de dados. Aplique a migration da Fase A primeiro.",
        );
      }
      throw mapSupabaseError(createErr, "Não foi possível criar o perfil de acesso.");
    }

    const roleId = String((created as Role).id);

    let permissionIds = input.permissionIds ?? [];
    if (permissionIds.length === 0 && input.permissionCodes && input.permissionCodes.length > 0) {
      const { data: permsByCode, error: pErr } = await this.client
        .from("permissions")
        .select("id")
        .in("code", input.permissionCodes);
      if (pErr) throw mapSupabaseError(pErr);
      permissionIds = (permsByCode ?? []).map((p) => String((p as { id: string }).id));
    }

    if (permissionIds.length > 0) {
      await this.setPermissions(roleId, permissionIds);
    }

    const full = await this.getById(roleId);
    if (!full) {
      throw new NotFoundError("Perfil recém-criado não pôde ser recuperado.");
    }
    return full;
  }

  async update(id: string, input: UpdateRoleInput): Promise<RoleWithDetails> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError("Perfil de acesso não encontrado.");
    }

    if (existing.code === "admin" && input.active === false) {
      throw new ValidationError("O perfil Administrador do sistema não pode ser desativado.");
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (trimmed.length < 2) {
        throw new ValidationError("O nome do perfil deve ter pelo menos 2 caracteres.");
      }
      patch.name = trimmed;
    }
    if (input.description !== undefined) {
      patch.description = input.description?.trim() || null;
    }
    if (input.active !== undefined) {
      patch.active = input.active;
    }

    const { error } = await this.client.from("roles").update(patch).eq("id", id);
    if (error) {
      throw mapSupabaseError(error, "Não foi possível atualizar o perfil de acesso.");
    }

    const updated = await this.getById(id);
    if (!updated) {
      throw new NotFoundError("Perfil não encontrado após atualização.");
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError("Perfil de acesso não encontrado.");
    }

    if (existing.is_system) {
      throw new ValidationError("Perfis de sistema não podem ser excluídos.");
    }

    if (existing.users_count > 0) {
      throw new ConflictError(
        `Este perfil está atribuído a ${existing.users_count} usuário(s). Remova os vínculos ou desative o perfil em vez de excluí-lo.`,
      );
    }

    const { error } = await this.client.from("roles").delete().eq("id", id);
    if (error) {
      throw mapSupabaseError(error, "Não foi possível excluir o perfil de acesso.");
    }
  }

  async setPermissions(roleId: string, permissionIds: string[]): Promise<RoleWithDetails> {
    const existing = await this.getById(roleId);
    if (!existing) {
      throw new NotFoundError("Perfil de acesso não encontrado.");
    }

    const uniqueIds = Array.from(new Set(permissionIds.filter(Boolean)));

    if (existing.code === "admin") {
      const { data: selectedPerms, error: selErr } = await this.client
        .from("permissions")
        .select("id, code")
        .in("id", uniqueIds.length > 0 ? uniqueIds : ["00000000-0000-0000-0000-000000000000"]);
      if (selErr) {
        throw mapSupabaseError(selErr, "Erro ao validar permissões do perfil Administrador.");
      }
      const selectedCodes = new Set(
        (selectedPerms ?? []).map((p) => String((p as { code: string }).code)),
      );
      const missingCritical = PROTECTED_ADMIN_PERMISSIONS.filter((c) => !selectedCodes.has(c));
      if (missingCritical.length > 0) {
        throw new ValidationError(
          `Não é permitido remover permissões administrativas essenciais do perfil Administrador (${missingCritical.join(", ")}) para evitar bloqueio de acesso administrativo.`,
        );
      }
    }

    const { error: delErr } = await this.client
      .from("role_permissions")
      .delete()
      .eq("role_id", roleId);
    if (delErr) {
      throw mapSupabaseError(delErr, "Erro ao atualizar permissões do perfil.");
    }

    if (uniqueIds.length > 0) {
      const rows = uniqueIds.map((permissionId) => ({
        role_id: roleId,
        permission_id: permissionId,
      }));
      const { error: insErr } = await this.client.from("role_permissions").insert(rows);
      if (insErr) {
        throw mapSupabaseError(insErr, "Erro ao vincular novas permissões ao perfil.");
      }
    }

    const updated = await this.getById(roleId);
    if (!updated) {
      throw new NotFoundError("Perfil não encontrado após atualização de permissões.");
    }
    return updated;
  }

  async listUsersByRole(roleId: string): Promise<AppUser[]> {
    const { data, error } = await this.client
      .from("user_roles")
      .select(
        "user:app_users(id, name, email, status, avatar_url, created_at, updated_at, last_login_at, deactivated_at)",
      )
      .eq("role_id", roleId);

    if (error) {
      if (isMissingTableError(error)) {
        return [];
      }
      throw mapSupabaseError(error, "Erro ao listar usuários associados ao perfil.");
    }

    const users: AppUser[] = [];
    for (const row of data ?? []) {
      const u = (row as { user?: AppUser | AppUser[] | null }).user;
      if (Array.isArray(u)) {
        users.push(...u);
      } else if (u) {
        users.push(u);
      }
    }
    return users.sort((a, b) => a.name.localeCompare(b.name));
  }
}
