import type { SupabaseClient } from "@supabase/supabase-js";
import { mapSupabaseError } from "@/lib/server/errors/supabase-error.mapper";
import type { PermissionsRepository } from "@/lib/server/repositories/permissions.repository";
import {
  SYSTEM_PERMISSIONS_CATALOG,
  type Permission,
  type PermissionModule,
} from "@/types/permissions";

export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = String((error as { code?: string }).code ?? "");
  const message = String((error as { message?: string }).message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("could not find the table")
  );
}

export function buildSeedPermissionsFallback(moduleFilter?: PermissionModule): Permission[] {
  const now = new Date(0).toISOString();
  const list = moduleFilter
    ? SYSTEM_PERMISSIONS_CATALOG.filter((p) => p.module === moduleFilter)
    : SYSTEM_PERMISSIONS_CATALOG;
  return list.map((p) => ({
    id: `seed-perm-${p.code}`,
    code: p.code,
    name: p.name,
    module: p.module,
    description: p.description,
    created_at: now,
  }));
}

export class SupabasePermissionsRepository implements PermissionsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(opts?: { module?: PermissionModule }): Promise<Permission[]> {
    let query = this.client
      .from("permissions")
      .select("id, code, name, module, description, created_at")
      .order("module", { ascending: true })
      .order("code", { ascending: true });

    if (opts?.module) {
      query = query.eq("module", opts.module);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        return buildSeedPermissionsFallback(opts?.module);
      }
      throw mapSupabaseError(error, "Erro ao listar permissões do sistema.");
    }

    return (data ?? []) as Permission[];
  }

  async listByRoleId(roleId: string): Promise<Permission[]> {
    const { data, error } = await this.client
      .from("role_permissions")
      .select("permission:permissions(id, code, name, module, description, created_at)")
      .eq("role_id", roleId);

    if (error) {
      if (isMissingTableError(error)) {
        return [];
      }
      throw mapSupabaseError(error, "Erro ao consultar permissões do perfil.");
    }

    const permissions: Permission[] = [];
    for (const row of data ?? []) {
      const perm = (row as { permission?: Permission | Permission[] | null }).permission;
      if (Array.isArray(perm)) {
        permissions.push(...perm);
      } else if (perm) {
        permissions.push(perm);
      }
    }

    return permissions.sort((a, b) => a.code.localeCompare(b.code));
  }

  async listByUserId(userId: string): Promise<Permission[]> {
    const { data: userRoles, error: urErr } = await this.client
      .from("user_roles")
      .select("role_id, role:roles(id, active)")
      .eq("user_id", userId);

    if (urErr) {
      if (isMissingTableError(urErr)) {
        return [];
      }
      throw mapSupabaseError(urErr, "Erro ao consultar perfis do usuário.");
    }

    const activeRoleIds = (userRoles ?? [])
      .filter((ur) => {
        const r = (ur as { role?: { active?: boolean } | { active?: boolean }[] | null }).role;
        const roleObj = Array.isArray(r) ? r[0] : r;
        return roleObj?.active !== false;
      })
      .map((ur) => String((ur as { role_id: string }).role_id));

    if (activeRoleIds.length === 0) {
      return [];
    }

    const { data: rpRows, error: rpErr } = await this.client
      .from("role_permissions")
      .select("permission:permissions(id, code, name, module, description, created_at)")
      .in("role_id", activeRoleIds);

    if (rpErr) {
      throw mapSupabaseError(rpErr, "Erro ao carregar permissões herdadas dos perfis.");
    }

    const uniqueMap = new Map<string, Permission>();
    for (const row of rpRows ?? []) {
      const perm = (row as { permission?: Permission | Permission[] | null }).permission;
      const items = Array.isArray(perm) ? perm : perm ? [perm] : [];
      for (const item of items) {
        uniqueMap.set(item.code, item);
      }
    }

    return Array.from(uniqueMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  }
}
