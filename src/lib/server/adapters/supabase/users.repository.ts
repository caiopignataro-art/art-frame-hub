import type { SupabaseClient } from "@supabase/supabase-js";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/server/errors/app-error";
import { mapSupabaseError } from "@/lib/server/errors/supabase-error.mapper";
import type { UsersListFilter, UsersRepository } from "@/lib/server/repositories/users.repository";
import type {
  AppUser,
  AppUserStatus,
  AppUserWithDetails,
  AuthIdentityRecord,
  CreateUserInput,
  UpdateUserInput,
} from "@/types/auth";
import type { Role } from "@/types/permissions";
import { isMissingTableError } from "./permissions.repository";

export class SupabaseUsersRepository implements UsersRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(filter?: UsersListFilter): Promise<AppUserWithDetails[]> {
    const { data: usersData, error: usersErr } = await this.client
      .from("app_users")
      .select(
        "id, name, email, status, avatar_url, created_at, updated_at, last_login_at, deactivated_at",
      )
      .order("name", { ascending: true });

    if (usersErr) {
      if (isMissingTableError(usersErr)) {
        return [];
      }
      throw mapSupabaseError(usersErr, "Erro ao listar usuários do sistema.");
    }

    const users = (usersData ?? []) as AppUser[];
    if (users.length === 0) {
      return [];
    }

    const [urRes, rpRes, idRes] = await Promise.all([
      this.client
        .from("user_roles")
        .select(
          "user_id, role_id, role:roles(id, code, name, description, is_system, active, created_at, updated_at)",
        ),
      this.client.from("role_permissions").select("role_id, permission:permissions(code)"),
      this.client
        .from("auth_identities")
        .select("id, app_user_id, provider, provider_subject, created_at, last_authenticated_at"),
    ]);

    if (urRes.error && !isMissingTableError(urRes.error)) {
      throw mapSupabaseError(urRes.error, "Erro ao carregar perfis dos usuários.");
    }
    if (rpRes.error && !isMissingTableError(rpRes.error)) {
      throw mapSupabaseError(rpRes.error, "Erro ao carregar permissões dos perfis.");
    }
    if (idRes.error && !isMissingTableError(idRes.error)) {
      throw mapSupabaseError(idRes.error, "Erro ao carregar identidades de autenticação.");
    }

    const permCodesByRoleId = new Map<string, Set<string>>();
    for (const row of rpRes.data ?? []) {
      const rId = String((row as { role_id: string }).role_id);
      const perm = (row as { permission?: { code: string } | { code: string }[] | null })
        .permission;
      const set = permCodesByRoleId.get(rId) ?? new Set<string>();
      if (Array.isArray(perm)) {
        for (const p of perm) if (p?.code) set.add(p.code);
      } else if (perm?.code) {
        set.add(perm.code);
      }
      permCodesByRoleId.set(rId, set);
    }

    const rolesByUserId = new Map<string, Role[]>();
    for (const row of urRes.data ?? []) {
      const uId = String((row as { user_id: string }).user_id);
      const r = (row as { role?: Role | Role[] | null }).role;
      const list = rolesByUserId.get(uId) ?? [];
      if (Array.isArray(r)) {
        list.push(...r);
      } else if (r) {
        list.push(r);
      }
      rolesByUserId.set(uId, list);
    }

    const identitiesByUserId = new Map<string, AuthIdentityRecord[]>();
    for (const row of idRes.data ?? []) {
      const rec = row as AuthIdentityRecord;
      const list = identitiesByUserId.get(rec.app_user_id) ?? [];
      list.push(rec);
      identitiesByUserId.set(rec.app_user_id, list);
    }

    let enriched: AppUserWithDetails[] = users.map((u) => {
      const userRoles = rolesByUserId.get(u.id) ?? [];
      const activeRoles = userRoles.filter((r) => r.active !== false);
      const permSet = new Set<string>();
      for (const r of activeRoles) {
        const codes = permCodesByRoleId.get(r.id);
        if (codes) {
          for (const c of codes) permSet.add(c);
        }
      }

      return {
        ...u,
        roles: userRoles,
        permissions: Array.from(permSet).sort(),
        identities: identitiesByUserId.get(u.id) ?? [],
      };
    });

    if (filter?.status && filter.status !== "todos") {
      enriched = enriched.filter((u) => u.status === filter.status);
    }

    if (filter?.roleCode && filter.roleCode !== "todos") {
      enriched = enriched.filter((u) => u.roles.some((r) => r.code === filter.roleCode));
    }

    if (filter?.search && filter.search.trim().length > 0) {
      const q = filter.search.trim().toLowerCase();
      enriched = enriched.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
      );
    }

    return enriched;
  }

  async getById(id: string): Promise<AppUserWithDetails | null> {
    const all = await this.list();
    return all.find((u) => u.id === id) ?? null;
  }

  async getByEmail(email: string): Promise<AppUserWithDetails | null> {
    const normalized = email.trim().toLowerCase();
    const all = await this.list();
    return all.find((u) => u.email.toLowerCase() === normalized) ?? null;
  }

  async countActiveAdmins(excludeUserId?: string): Promise<number> {
    const all = await this.list({ status: "active" });
    return all.filter(
      (u) =>
        u.id !== excludeUserId &&
        u.status === "active" &&
        u.roles.some((r) => r.code === "admin" && r.active !== false),
    ).length;
  }

  async create(input: CreateUserInput, actorUserId?: string | null): Promise<AppUserWithDetails> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();

    if (name.length < 2) {
      throw new ValidationError("O nome do usuário deve ter pelo menos 2 caracteres.");
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError("Informe um endereço de e-mail válido.");
    }

    const existing = await this.getByEmail(email);
    if (existing) {
      throw new ConflictError("Já existe um usuário cadastrado com este endereço de e-mail.");
    }

    const { data: created, error: createErr } = await this.client
      .from("app_users")
      .insert({
        name,
        email,
        status: input.status ?? "active",
        avatar_url: input.avatar_url ?? null,
      })
      .select("id")
      .single();

    if (createErr) {
      if (isMissingTableError(createErr)) {
        throw new ValidationError(
          "As tabelas de usuários ainda não foram aplicadas no banco. Aplique a migration da Fase A primeiro.",
        );
      }
      throw mapSupabaseError(createErr, "Não foi possível criar o usuário.");
    }

    const userId = String((created as { id: string }).id);

    if (input.roleIds && input.roleIds.length > 0) {
      const uniqueRoleIds = Array.from(new Set(input.roleIds.filter(Boolean)));
      const rows = uniqueRoleIds.map((roleId) => ({
        user_id: userId,
        role_id: roleId,
        assigned_by: actorUserId ?? null,
      }));
      const { error: urErr } = await this.client.from("user_roles").insert(rows);
      if (urErr) {
        throw mapSupabaseError(urErr, "Erro ao atribuir perfis ao usuário.");
      }
    }

    const full = await this.getById(userId);
    if (!full) {
      throw new NotFoundError("Usuário recém-criado não pôde ser recuperado.");
    }
    return full;
  }

  async update(
    id: string,
    input: UpdateUserInput,
    actorUserId?: string | null,
  ): Promise<AppUserWithDetails> {
    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError("Usuário não encontrado.");
    }

    const isCurrentlyAdmin = current.roles.some((r) => r.code === "admin" && r.active !== false);
    const willDeactivate = input.status !== undefined && input.status !== "active";

    // Se estiver alterando roles, verificar se continuará sendo admin
    let willKeepAdmin = isCurrentlyAdmin;
    if (input.roleIds !== undefined && isCurrentlyAdmin) {
      const { data: adminRole } = await this.client
        .from("roles")
        .select("id")
        .eq("code", "admin")
        .maybeSingle();
      const adminRoleId = (adminRole as { id?: string } | null)?.id;
      if (adminRoleId && !input.roleIds.includes(adminRoleId)) {
        willKeepAdmin = false;
      }
    }

    // Regra 1: Impedir auto-desativação ou remoção do próprio perfil admin
    if (actorUserId && actorUserId === id) {
      if (willDeactivate) {
        throw new ValidationError("Você não pode desativar ou suspender sua própria conta.");
      }
      if (isCurrentlyAdmin && !willKeepAdmin) {
        throw new ValidationError(
          "Você não pode remover o perfil de Administrador da sua própria conta.",
        );
      }
    }

    // Regra 2: Impedir remoção ou desativação do último administrador ativo
    if (isCurrentlyAdmin && current.status === "active" && (willDeactivate || !willKeepAdmin)) {
      const remainingAdmins = await this.countActiveAdmins(id);
      if (remainingAdmins === 0) {
        throw new ValidationError(
          "Operação bloqueada: não é permitido remover ou desativar o último administrador ativo do sistema.",
        );
      }
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const trimmed = input.name.trim();
      if (trimmed.length < 2) {
        throw new ValidationError("O nome do usuário deve ter pelo menos 2 caracteres.");
      }
      patch.name = trimmed;
    }
    if (input.email !== undefined) {
      const normalized = input.email.trim().toLowerCase();
      if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        throw new ValidationError("Informe um endereço de e-mail válido.");
      }
      if (normalized !== current.email.toLowerCase()) {
        const conflict = await this.getByEmail(normalized);
        if (conflict && conflict.id !== id) {
          throw new ConflictError("Já existe outro usuário cadastrado com este e-mail.");
        }
      }
      patch.email = normalized;
    }
    if (input.avatar_url !== undefined) {
      patch.avatar_url = input.avatar_url;
    }
    if (input.status !== undefined) {
      patch.status = input.status;
      patch.deactivated_at =
        input.status === "inactive" || input.status === "suspended"
          ? new Date().toISOString()
          : null;
    }

    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await this.client.from("app_users").update(patch).eq("id", id);
      if (upErr) {
        throw mapSupabaseError(upErr, "Não foi possível atualizar os dados do usuário.");
      }
    }

    if (input.roleIds !== undefined) {
      await this.assignRoles(id, input.roleIds, actorUserId);
    }

    const updated = await this.getById(id);
    if (!updated) {
      throw new NotFoundError("Usuário não encontrado após atualização.");
    }
    return updated;
  }

  async setStatus(
    id: string,
    status: AppUserStatus,
    actorUserId?: string | null,
  ): Promise<AppUserWithDetails> {
    return this.update(id, { status }, actorUserId);
  }

  async assignRoles(
    userId: string,
    roleIds: string[],
    actorUserId?: string | null,
  ): Promise<AppUserWithDetails> {
    const current = await this.getById(userId);
    if (!current) {
      throw new NotFoundError("Usuário não encontrado.");
    }

    const uniqueRoleIds = Array.from(new Set(roleIds.filter(Boolean)));
    const isCurrentlyAdmin = current.roles.some((r) => r.code === "admin" && r.active !== false);

    if (isCurrentlyAdmin) {
      const { data: adminRole } = await this.client
        .from("roles")
        .select("id")
        .eq("code", "admin")
        .maybeSingle();
      const adminRoleId = (adminRole as { id?: string } | null)?.id;
      const losingAdmin = adminRoleId ? !uniqueRoleIds.includes(adminRoleId) : false;

      if (losingAdmin) {
        if (actorUserId && actorUserId === userId) {
          throw new ValidationError(
            "Você não pode remover o perfil de Administrador da sua própria conta.",
          );
        }
        if (current.status === "active") {
          const remainingAdmins = await this.countActiveAdmins(userId);
          if (remainingAdmins === 0) {
            throw new ValidationError(
              "Operação bloqueada: não é permitido remover o perfil do último administrador ativo.",
            );
          }
        }
      }
    }

    const { error: delErr } = await this.client.from("user_roles").delete().eq("user_id", userId);
    if (delErr) {
      throw mapSupabaseError(delErr, "Erro ao atualizar perfis do usuário.");
    }

    if (uniqueRoleIds.length > 0) {
      const rows = uniqueRoleIds.map((roleId) => ({
        user_id: userId,
        role_id: roleId,
        assigned_by: actorUserId ?? null,
      }));
      const { error: insErr } = await this.client.from("user_roles").insert(rows);
      if (insErr) {
        throw mapSupabaseError(insErr, "Erro ao atribuir novos perfis ao usuário.");
      }
    }

    const updated = await this.getById(userId);
    if (!updated) {
      throw new NotFoundError("Usuário não encontrado após atribuição de perfis.");
    }
    return updated;
  }
}
