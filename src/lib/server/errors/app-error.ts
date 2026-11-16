/**
 * Hierarquia centralizada de erros da aplicação (Server & Client-safe).
 * Garante que erros técnicos de infraestrutura não vazem detalhes sensíveis
 * (tokens, credenciais, stack traces) para o navegador.
 */

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DATABASE_ERROR"
  | "INTERNAL_SERVER_ERROR";

const SENSITIVE_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g,
  /sb_(publishable|secret)_[A-Za-z0-9_-]+/gi,
  /postgres(?:ql)?:\/\/[^\s"']+/gi,
  /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s"']+/gi,
];

/**
 * Remove eventuais tokens, chaves ou strings de conexão de uma mensagem de erro.
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return "Ocorreu um erro inesperado.";
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }
  return sanitized;
}

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(params: {
    message: string;
    code: AppErrorCode;
    statusCode: number;
    details?: Record<string, unknown>;
    isOperational?: boolean;
  }) {
    super(sanitizeErrorMessage(params.message));
    this.name = new.target.name;
    this.code = params.code;
    this.statusCode = params.statusCode;
    this.details = params.details;
    this.isOperational = params.isOperational ?? true;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      statusCode: this.statusCode,
      message: this.message,
      details: this.details,
    };
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      code: "VALIDATION_ERROR",
      statusCode: 400,
      details,
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Sessão inválida ou expirada. Faça login novamente.") {
    super({
      message,
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Você não possui permissão para executar esta operação.") {
    super({
      message,
      code: "FORBIDDEN",
      statusCode: 403,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Registro não encontrado.") {
    super({
      message,
      code: "NOT_FOUND",
      statusCode: 404,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflito de dados: o registro já existe ou está em uso.") {
    super({
      message,
      code: "CONFLICT",
      statusCode: 409,
    });
  }
}

export class DatabaseError extends AppError {
  constructor(
    message = "Não foi possível concluir a operação no banco de dados.",
    details?: Record<string, unknown>,
  ) {
    super({
      message,
      code: "DATABASE_ERROR",
      statusCode: 500,
      details,
    });
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Erro interno no servidor. Tente novamente em instantes.") {
    super({
      message,
      code: "INTERNAL_SERVER_ERROR",
      statusCode: 500,
      isOperational: false,
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  if (error instanceof AppError) return true;
  if (!error || typeof error !== "object") return false;
  const candidate = error as Partial<AppError>;
  return (
    typeof candidate.code === "string" &&
    typeof candidate.statusCode === "number" &&
    typeof candidate.message === "string" &&
    typeof candidate.isOperational === "boolean"
  );
}
