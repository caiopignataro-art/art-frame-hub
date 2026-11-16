/**
 * Mapeador de erros do Supabase / PostgreSQL para erros padronizados da aplicação.
 * Preserva mensagens de negócio lançadas via `RAISE EXCEPTION` (código P0001) nas
 * funções e triggers PL/pgSQL, ocultando detalhes internos de infraestrutura.
 */
import {
  AppError,
  ConflictError,
  DatabaseError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  isAppError,
  sanitizeErrorMessage,
} from "./app-error";

interface RawSupabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
  name?: string;
}

export function mapSupabaseError(error: unknown, fallbackMessage?: string): AppError {
  if (isAppError(error)) {
    return error;
  }

  if (!error || typeof error !== "object") {
    return new InternalServerError(fallbackMessage ?? "Erro inesperado ao processar a operação.");
  }

  const raw = error as RawSupabaseError;
  const code = String(raw.code ?? "");
  const message = sanitizeErrorMessage(String(raw.message ?? ""));
  const status = typeof raw.status === "number" ? raw.status : undefined;

  // Erros de autenticação do Supabase Auth
  if (
    status === 400 &&
    (message.toLowerCase().includes("invalid login credentials") ||
      message.toLowerCase().includes("email not confirmed"))
  ) {
    if (message.toLowerCase().includes("email not confirmed")) {
      return new UnauthorizedError("E-mail ainda não confirmado. Verifique sua caixa de entrada.");
    }
    return new UnauthorizedError("E-mail ou senha inválidos.");
  }

  if (
    status === 401 ||
    code === "PGRST301" ||
    message.toLowerCase().includes("jwt expired") ||
    message.toLowerCase().includes("invalid jwt") ||
    message.toLowerCase().includes("invalid token")
  ) {
    return new UnauthorizedError("Sua sessão expirou ou é inválida. Faça login novamente.");
  }

  if (status === 403 || code === "42501") {
    return new ForbiddenError("Acesso negado pelas políticas de segurança do sistema.");
  }

  // Exceção explícita de regra de negócio no PostgreSQL (RAISE EXCEPTION em RPCs/Triggers)
  if (code === "P0001") {
    return new ValidationError(message || fallbackMessage || "Regra de negócio violada.");
  }

  // Registro não encontrado (.single() sem linhas)
  if (code === "PGRST116") {
    return new NotFoundError(fallbackMessage ?? "Registro solicitado não foi encontrado.");
  }

  // Violação de unicidade (UNIQUE constraint)
  if (code === "23505") {
    return new ConflictError(
      fallbackMessage ?? "Já existe um registro cadastrado com este identificador ou código.",
    );
  }

  // Violação de chave estrangeira (FOREIGN KEY constraint)
  if (code === "23503") {
    return new ConflictError(
      fallbackMessage ??
        "Este registro possui vínculos ativos e não pode ser removido ou alterado desta forma.",
    );
  }

  // Violação de CHECK constraint ou formato inválido (UUID inválido, NOT NULL, etc.)
  if (code === "23514" || code === "23502" || code === "22P02") {
    return new ValidationError(
      fallbackMessage ?? (message || "Os dados informados são inválidos ou estão incompletos."),
    );
  }

  // Se for um Error padrão com mensagem legível de negócio lançada em camadas superiores
  if (error instanceof Error && !code) {
    return new DatabaseError(sanitizeErrorMessage(error.message || fallbackMessage || ""));
  }

  return new DatabaseError(fallbackMessage ?? "Ocorreu um erro ao comunicar com o banco de dados.");
}
