import { createSupabaseRepositories } from "@/lib/server/adapters/supabase";
import { InternalServerError } from "@/lib/server/errors/app-error";
import type {
  DatabaseExecutionContext,
  DatabaseProviderName,
  DatabaseRepositories,
} from "./database.types";

/**
 * Obtém o nome do provedor de banco configurado no servidor.
 * Default seguro nesta etapa: "supabase".
 */
export function getConfiguredDatabaseProvider(): DatabaseProviderName {
  const raw = (process.env.DATABASE_PROVIDER || "supabase").trim().toLowerCase();

  if (raw === "supabase" || raw === "postgresql") {
    return raw;
  }

  throw new InternalServerError(
    `DATABASE_PROVIDER inválido ("${raw}"). Valores suportados: "supabase" | "postgresql".`,
  );
}

/**
 * Factory central de repositórios do servidor (Database Provider).
 * Seleciona o adapter ativo exclusivamente via configuração de ambiente no servidor.
 */
export function getDatabaseRepositories(ctx?: DatabaseExecutionContext): DatabaseRepositories {
  const provider = getConfiguredDatabaseProvider();

  switch (provider) {
    case "supabase":
      return createSupabaseRepositories(ctx);

    case "postgresql":
      throw new InternalServerError(
        "O adapter PostgreSQL local (DATABASE_PROVIDER=postgresql) está preparado nos contratos, mas sua conexão será implementada na etapa de migração do banco.",
      );

    default:
      throw new InternalServerError("Database provider não configurado.");
  }
}
