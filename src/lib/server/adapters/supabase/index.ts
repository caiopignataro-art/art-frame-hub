import type {
  DatabaseExecutionContext,
  DatabaseRepositories,
} from "@/lib/server/database/database.types";
import { SupabaseAuthRepository } from "./auth.repository";
import { SupabasePermissionsRepository } from "./permissions.repository";
import { SupabaseRolesRepository } from "./roles.repository";
import { createRequestSupabaseClient } from "./supabase-client.server";
import { SupabaseUsersRepository } from "./users.repository";

/**
 * Instancia os repositórios do adapter Supabase para o contexto da requisição atual.
 * Garante isolamento total por requisição (nenhum JWT ou sessão é compartilhado entre chamadas).
 */
export function createSupabaseRepositories(ctx?: DatabaseExecutionContext): DatabaseRepositories {
  const client = createRequestSupabaseClient(ctx?.accessToken);

  return {
    provider: "supabase",
    auth: new SupabaseAuthRepository(client),
    users: new SupabaseUsersRepository(client),
    roles: new SupabaseRolesRepository(client),
    permissions: new SupabasePermissionsRepository(client),
  };
}
