/**
 * Suíte Unitária e Estática/Estrutural da Fase A (Auth & RBAC).
 *
 * Classificação explícita:
 * 1. Testes Unitários — lógica pura e guardas em memória (zero simulação disfarçada de integração).
 * 2. Testes Estáticos / Estruturais — auditoria direta da migration SQL, catálogo RBAC e Server Functions.
 *
 * Para testes reais contra o Supabase remoto (somente leitura), veja:
 * `tests/fase-a-supabase-readonly.integration.test.ts`.
 */
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import {
  ConflictError,
  DatabaseError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  isAppError,
  sanitizeErrorMessage,
} from "@/lib/server/errors/app-error";
import { mapSupabaseError } from "@/lib/server/errors/supabase-error.mapper";
import {
  hasPermission,
  isAuthRequired,
  requireActiveUser,
  requireAllPermissions,
  requireAnyPermission,
  requireAuthenticatedUser,
  requirePermission,
} from "@/lib/server/auth/authorization";
import {
  ROUTE_REQUIRED_PERMISSIONS,
  canAccessModule,
  canAccessPathname,
  canExecute,
  canExecuteAny,
} from "@/lib/auth/permission.guard";
import { sessionTokenStore } from "@/lib/auth/session-token.store";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  createEmptyAuthContext,
  extractRequestTokens,
  parseCookies,
} from "@/lib/server/auth/auth.context";
import {
  INITIAL_ROLES_SEED,
  PERMISSION_CODES,
  PERMISSION_MODULES,
  SYSTEM_PERMISSIONS_CATALOG,
} from "@/types/permissions";
import type { AuthContext } from "@/types/auth";
import type { DatabaseRepositories } from "@/lib/server/database/database.types";

const ROOT_DIR = path.resolve(import.meta.dir, "..");

function makeAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    ...createEmptyAuthContext(),
    isAuthenticated: true,
    isActive: true,
    appUserId: "11111111-1111-1111-1111-111111111111",
    provider: "supabase",
    providerSubject: "22222222-2222-2222-2222-222222222222",
    email: "operador@artenmolduras.local",
    name: "Operador Teste",
    status: "active",
    roles: ["atendimento"],
    permissions: ["clientes.view", "orcamentos.create"],
    ...overrides,
  };
}

function makePermissionsRepoStub(granted: string[] = []): DatabaseRepositories {
  return {
    permissions: {
      listPermissions: async () => [],
      listRolePermissions: async () => [],
      setRolePermissions: async () => {},
      getUserPermissionCodes: async () => granted,
    },
  } as unknown as DatabaseRepositories;
}

// ============================================================================
// 1. TESTES UNITÁRIOS
// ============================================================================

describe("1. Testes Unitários (Erros, RBAC, Guardas, Cookies e RAM Token Store)", () => {
  afterEach(() => {
    sessionTokenStore.clear();
  });

  test("sanitizeErrorMessage oculta strings de conexão e JWTs preservando mensagens seguras", () => {
    const connErr = sanitizeErrorMessage(
      "Falha ao conectar em postgres://admin:supersegredo@db.internal:5432/prod",
    );
    expect(connErr).not.toContain("supersegredo");
    expect(connErr).not.toContain("postgres://");

    const jwtErr = sanitizeErrorMessage(
      "Token inválido: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb",
    );
    expect(jwtErr).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");

    expect(sanitizeErrorMessage("E-mail já cadastrado.")).toBe("E-mail já cadastrado.");
    expect(sanitizeErrorMessage("")).toBe("Ocorreu um erro inesperado.");
  });

  test("hierarquia AppError e isAppError mantêm status codes esperados", () => {
    const errors = [
      new ValidationError("Inválido"),
      new UnauthorizedError("Não autenticado"),
      new ForbiddenError("Proibido"),
      new NotFoundError("Não encontrado"),
      new ConflictError("Conflito"),
      new DatabaseError("Banco"),
      new InternalServerError("Interno"),
    ];
    expect(errors.map((e) => e.statusCode)).toEqual([400, 401, 403, 404, 409, 500, 500]);
    for (const err of errors) {
      expect(isAppError(err)).toBe(true);
    }
    expect(isAppError(new Error("comum"))).toBe(false);
  });

  test("mapSupabaseError traduz códigos PostgreSQL e PostgREST sem vazar estrutura interna", () => {
    expect(mapSupabaseError({ status: 401, message: "JWT expired" })).toBeInstanceOf(
      UnauthorizedError,
    );
    expect(mapSupabaseError({ code: "PGRST301", message: "JWT error" })).toBeInstanceOf(
      UnauthorizedError,
    );
    expect(
      mapSupabaseError({ code: "42501", message: "BOOTSTRAP_ALREADY_COMPLETED" }),
    ).toBeInstanceOf(ForbiddenError);
    expect(mapSupabaseError({ code: "PGRST116", message: "0 rows" })).toBeInstanceOf(NotFoundError);
    expect(mapSupabaseError({ code: "23505", message: "duplicate key" })).toBeInstanceOf(
      ConflictError,
    );
    expect(mapSupabaseError({ code: "23503", message: "fk violation" })).toBeInstanceOf(
      ConflictError,
    );
    expect(mapSupabaseError({ code: "23514", message: "check violation" })).toBeInstanceOf(
      ValidationError,
    );
    expect(mapSupabaseError({ code: "23502", message: "not null violation" })).toBeInstanceOf(
      ValidationError,
    );
    expect(mapSupabaseError({ code: "22P02", message: "invalid uuid" })).toBeInstanceOf(
      ValidationError,
    );
    expect(mapSupabaseError({ code: "XX000", message: "unknown" })).toBeInstanceOf(DatabaseError);
  });

  test("parseCookies e extractRequestTokens leem cookies HttpOnly e Bearer header", () => {
    const parsed = parseCookies(
      `foo=bar; ${ACCESS_TOKEN_COOKIE}=tok%2B123; ${REFRESH_TOKEN_COOKIE}=ref%3D456`,
    );
    expect(parsed.foo).toBe("bar");
    expect(parsed[ACCESS_TOKEN_COOKIE]).toBe("tok+123");
    expect(parsed[REFRESH_TOKEN_COOKIE]).toBe("ref=456");

    const reqFromCookie = new Request("http://localhost/test", {
      headers: {
        cookie: `${ACCESS_TOKEN_COOKIE}=cookie-jwt; ${REFRESH_TOKEN_COOKIE}=cookie-ref`,
        "user-agent": "VitestAudit/1.0",
      },
    });
    expect(extractRequestTokens(reqFromCookie)).toEqual({
      accessToken: "cookie-jwt",
      refreshToken: "cookie-ref",
      ipAddress: null,
      userAgent: "VitestAudit/1.0",
    });

    const reqBearerFirst = new Request("http://localhost/test", {
      headers: {
        authorization: "Bearer header-jwt",
        cookie: `${ACCESS_TOKEN_COOKIE}=cookie-jwt`,
      },
    });
    expect(extractRequestTokens(reqBearerFirst).accessToken).toBe("header-jwt");
  });

  test("sessionTokenStore mantém accessToken apenas em RAM sem refreshToken e sem persistência", () => {
    expect(sessionTokenStore.get()).toBeNull();
    expect(sessionTokenStore.getAccessToken()).toBeNull();

    sessionTokenStore.set({
      accessToken: "mem-jwt-token",
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    });

    const stored = sessionTokenStore.get();
    expect(stored).not.toBeNull();
    expect(stored?.accessToken).toBe("mem-jwt-token");
    expect("refreshToken" in (stored as object)).toBe(false);
    expect(sessionTokenStore.getAccessToken()).toBe("mem-jwt-token");

    // Token expirado deve retornar null automaticamente
    sessionTokenStore.set({
      accessToken: "expired-jwt",
      expiresAt: Math.floor(Date.now() / 1000) - 10,
    });
    expect(sessionTokenStore.getAccessToken()).toBeNull();
  });

  test("authorization.ts aplica fail-closed para anônimos, inativos/suspensos e permissões ausentes", async () => {
    expect(() => requireAuthenticatedUser(createEmptyAuthContext())).toThrow(UnauthorizedError);
    expect(() =>
      requireActiveUser(makeAuthContext({ isActive: false, status: "inactive" })),
    ).toThrow(ForbiddenError);
    expect(() =>
      requireActiveUser(makeAuthContext({ isActive: false, status: "suspended" })),
    ).toThrow(ForbiddenError);

    const activeAtendimento = makeAuthContext({
      roles: ["atendimento"],
      permissions: ["clientes.view", "orcamentos.create"],
    });
    const repos = makePermissionsRepoStub(["clientes.view", "orcamentos.create"]);

    expect(await hasPermission(activeAtendimento, "clientes.view", repos)).toBe(true);
    expect(await hasPermission(activeAtendimento, "usuarios.delete", repos)).toBe(false);

    await expect(requirePermission(activeAtendimento, "usuarios.delete", repos)).rejects.toThrow(
      ForbiddenError,
    );
    await expect(
      requireAnyPermission(activeAtendimento, ["usuarios.delete", "orcamentos.create"], repos),
    ).resolves.toMatchObject({ appUserId: activeAtendimento.appUserId });
    await expect(
      requireAllPermissions(activeAtendimento, ["clientes.view", "usuarios.delete"], repos),
    ).rejects.toThrow(ForbiddenError);

    // Admin ativo possui bypass de superperfil no guard server-side
    const adminCtx = makeAuthContext({ roles: ["admin"], permissions: [] });
    expect(await hasPermission(adminCtx, "usuarios.delete", repos)).toBe(true);
  });

  test("isAuthRequired ignora flags legadas inseguras e permanece sempre ativo (fail-closed)", () => {
    const prev = process.env.REQUIRE_AUTH;
    try {
      delete process.env.REQUIRE_AUTH;
      expect(isAuthRequired()).toBe(true);
      process.env.REQUIRE_AUTH = "false";
      expect(isAuthRequired()).toBe(true);
      process.env.REQUIRE_AUTH = "true";
      expect(isAuthRequired()).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.REQUIRE_AUTH;
      else process.env.REQUIRE_AUTH = prev;
    }
  });

  test("permission.guard.ts protege módulos, rotas e ações no frontend", () => {
    const emptyAuth = createEmptyAuthContext();
    expect(canExecute(emptyAuth, "clientes.view")).toBe(false);
    expect(canAccessPathname(emptyAuth, "/")).toBe(false);
    expect(canAccessPathname(emptyAuth, "/login")).toBe(true);

    const estoqueUser = makeAuthContext({
      roles: ["estoque"],
      permissions: ["estoque.view", "produtos.view"],
    });
    expect(canAccessModule(estoqueUser, "estoque")).toBe(true);
    expect(canAccessModule(estoqueUser, "pagamentos")).toBe(false);
    expect(canExecuteAny(estoqueUser, ["pagamentos.view", "estoque.view"])).toBe(true);
    expect(canAccessPathname(estoqueUser, "/estoque")).toBe(true);
    expect(canAccessPathname(estoqueUser, "/configuracoes")).toBe(false);

    const adminUser = makeAuthContext({ roles: ["admin"], permissions: [] });
    expect(canAccessPathname(adminUser, "/configuracoes")).toBe(true);
    expect(canExecute(adminUser, "usuarios.create")).toBe(true);
  });
});

// ============================================================================
// 2. TESTES ESTÁTICOS / ESTRUTURAIS
// ============================================================================

describe("2. Testes Estáticos / Estruturais (Migration SQL, Catálogo RBAC e Endpoints)", () => {
  const migrationSql = fs.readFileSync(
    path.join(ROOT_DIR, "supabase", "migrations", "20261115220000_fase_a_auth_rbac.sql"),
    "utf8",
  );

  test("catálogo de permissões possui exatamente 12 módulos, 6 perfis iniciais e 63 permissões únicas", () => {
    expect(PERMISSION_MODULES).toHaveLength(12);
    expect(INITIAL_ROLES_SEED).toHaveLength(6);
    expect(SYSTEM_PERMISSIONS_CATALOG).toHaveLength(63);
    expect(Object.keys(PERMISSION_CODES)).toHaveLength(63);

    const uniqueCodes = new Set(SYSTEM_PERMISSIONS_CATALOG.map((p) => p.code));
    expect(uniqueCodes.size).toBe(63);

    for (const codes of Object.values(ROUTE_REQUIRED_PERMISSIONS)) {
      for (const code of codes) {
        expect(uniqueCodes.has(code)).toBe(true);
      }
    }
  });

  test("migration SQL possui paridade exata 1:1 com os 6 perfis e 63 permissões do TypeScript", () => {
    for (const role of INITIAL_ROLES_SEED) {
      expect(migrationSql).toContain(`('${role.code}'`);
    }
    for (const perm of SYSTEM_PERMISSIONS_CATALOG) {
      expect(migrationSql).toContain(`('${perm.code}'`);
    }
  });

  test("migration SQL garante bootstrap atômico, compatibilidade PostgreSQL local e ausência de bypass aberto", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.tg_set_updated_at()");
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.current_app_user_id()");
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.is_current_app_user_active()",
    );
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.current_app_user_has_role(p_role_id UUID)",
    );
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.app_user_has_permission(");
    expect(migrationSql).toContain("p_user_id UUID");
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.app_user_has_permission(p_permission_code TEXT)",
    );
    expect(migrationSql).toContain(
      "CREATE OR REPLACE FUNCTION public.link_and_touch_current_identity(p_provider TEXT DEFAULT 'supabase')",
    );
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(");
    expect(migrationSql).toContain("pg_advisory_xact_lock");
    expect(migrationSql).toContain("LOCK TABLE public.app_users IN EXCLUSIVE MODE");
    expect(migrationSql).toContain("BOOTSTRAP_ALREADY_COMPLETED");
    expect(migrationSql).toContain("SELECT 1 FROM pg_roles WHERE rolname = 'service_role'");

    // Não pode haver bypass em RLS quando não existe admin ativo
    expect(migrationSql).not.toContain("OR NOT public.has_any_active_admin()");

    // Revogação total de leitura/escrita anônima nas 7 tabelas RBAC e restrição do bootstrap
    expect(migrationSql).toContain(
      "REVOKE ALL ON public.app_users, public.auth_identities, public.roles, public.permissions, public.user_roles, public.role_permissions, public.auth_audit_log FROM anon;",
    );
    expect(migrationSql).toContain(
      "REVOKE ALL ON FUNCTION public.bootstrap_first_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;",
    );
    expect(migrationSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;",
    );
    expect(migrationSql).not.toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.bootstrap_first_admin[^;]*TO\s+(anon|authenticated|PUBLIC)/i,
    );
  });

  test("migration incremental 20261116234500 aplica endurecimento final sem recriar tabelas", () => {
    const incrementalSql = fs.readFileSync(
      path.join(ROOT_DIR, "supabase", "migrations", "20261116234500_fase_a_rbac_hardening.sql"),
      "utf8",
    );

    const sqlWithoutComments = incrementalSql.replace(/--.*$/gm, "");
    expect(sqlWithoutComments).not.toMatch(/\bCREATE\s+TABLE\b/i);
    expect(sqlWithoutComments).not.toMatch(/\bDROP\s+TABLE\b/i);
    expect(sqlWithoutComments).not.toContain("OR NOT public.has_any_active_admin()");
    expect(incrementalSql).toContain("ai.provider = v_provider");
    expect(incrementalSql).toContain("ai.provider_subject = v_sub");
    expect(incrementalSql).toContain("v_email_verified IS TRUE");
    expect(incrementalSql).toContain("actor_user_id = public.current_app_user_id()");
    expect(incrementalSql).toContain(
      "REVOKE ALL ON FUNCTION public.app_user_has_permission(UUID, TEXT) FROM PUBLIC;",
    );
    expect(incrementalSql).not.toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.app_user_has_permission\(UUID,\s*TEXT\)\s+TO\s+(anon|authenticated)/i,
    );
    expect(incrementalSql).toContain(
      "REVOKE ALL ON public.app_users, public.auth_identities, public.roles, public.permissions, public.user_roles, public.role_permissions, public.auth_audit_log FROM anon;",
    );
  });

  test("Server Functions somam exatamente 21 endpoints distribuídos nos 5 arquivos da Fase A", () => {
    const fnDir = path.join(ROOT_DIR, "src", "lib", "server", "functions");
    const fnFiles = fs
      .readdirSync(fnDir)
      .filter((f) => f.endsWith(".functions.ts"))
      .sort();

    expect(fnFiles).toEqual([
      "auth.functions.ts",
      "health.functions.ts",
      "permissions.functions.ts",
      "roles.functions.ts",
      "users.functions.ts",
    ]);

    const perFileCounts: Record<string, number> = {};
    let total = 0;
    for (const file of fnFiles) {
      const src = fs.readFileSync(path.join(fnDir, file), "utf8");
      const matches = src.match(/export const \w+ServerFn\s*=\s*createServerFn\(/g) ?? [];
      perFileCounts[file] = matches.length;
      total += matches.length;
    }

    expect(perFileCounts).toEqual({
      "auth.functions.ts": 6,
      "health.functions.ts": 1,
      "permissions.functions.ts": 2,
      "roles.functions.ts": 6,
      "users.functions.ts": 6,
    });
    expect(total).toBe(21);
  });

  test("hardening de sessão, bootstrap, health e cliente legado refletido nos arquivos-fonte", () => {
    const storeSrc = fs.readFileSync(
      path.join(ROOT_DIR, "src", "lib", "auth", "session-token.store.ts"),
      "utf8",
    );
    expect(storeSrc).not.toContain("sessionStorage.setItem");
    expect(storeSrc).not.toContain("localStorage.setItem");

    const attacherSrc = fs.readFileSync(
      path.join(ROOT_DIR, "src", "integrations", "supabase", "auth-attacher.ts"),
      "utf8",
    );
    expect(attacherSrc).not.toContain("supabase.auth.getSession()");

    const authSvcSrc = fs.readFileSync(
      path.join(ROOT_DIR, "src", "lib", "services", "auth.service.ts"),
      "utf8",
    );
    expect(authSvcSrc).not.toMatch(/\bsupabase\.auth\.setSession\s*\([^.]/);

    const healthSrc = fs.readFileSync(
      path.join(ROOT_DIR, "src", "lib", "server", "functions", "health.functions.ts"),
      "utf8",
    );
    expect(healthSrc).toContain("allowAnonymous: false");
    expect(healthSrc).toContain("requireAnyPermission");

    const authFnSrc = fs.readFileSync(
      path.join(ROOT_DIR, "src", "lib", "server", "functions", "auth.functions.ts"),
      "utf8",
    );
    expect(authFnSrc).toContain("FIRST_ADMIN_BOOTSTRAP_SECRET");
    expect(authFnSrc).toContain("timingSafeEqual");
    expect(authFnSrc).toContain("bootstrapFirstAdmin");
    expect(authFnSrc).toContain("refreshToken: null");

    const servicesDir = path.join(ROOT_DIR, "src", "lib", "services");
    const legacyClientUsers = fs
      .readdirSync(servicesDir)
      .filter(
        (f) => f.endsWith(".ts") && f !== "auth.service.ts" && f !== "command-search.service.ts",
      )
      .filter((f) =>
        fs
          .readFileSync(path.join(servicesDir, f), "utf8")
          .includes("@/integrations/supabase/client"),
      )
      .sort();

    expect(legacyClientUsers).toEqual([
      "clientes.service.ts",
      "configuracoes.service.ts",
      "dashboard.service.ts",
      "estoque.service.ts",
      "historico.service.ts",
      "importacoes.service.ts",
      "orcamentos.service.ts",
      "ordem-producao.service.ts",
      "pagamentos.service.ts",
      "pedidos.service.ts",
      "produtos.service.ts",
      "whatsapp.service.ts",
    ]);
  });
});
