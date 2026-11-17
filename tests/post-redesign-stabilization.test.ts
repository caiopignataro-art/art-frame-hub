/**
 * Suíte de Verificação — Rodada de Correções e Estabilização Pós-Redesign.
 *
 * Cobre:
 * 1. Guardas RBAC por módulo e subrota (anônimo, inativo e perfis parciais).
 * 2. Renderização SSR e prevenção de hydration mismatch em `SidebarProvider`.
 * 3. Auditoria estrutural de `AppShell.tsx`, `CommandPalette.tsx`, `AuthContextProvider.tsx`
 *    e `command-search.service.ts` (sem consultas privadas durante loading/anônimo e busca limitada).
 */
import fs from "node:fs";
import path from "node:path";
import * as React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "bun:test";
import { canAccessPathname, ROUTE_REQUIRED_PERMISSIONS } from "@/lib/auth/permission.guard";
import { createEmptyAuthContext } from "@/lib/server/auth/auth.context";
import { Sidebar, SidebarProvider } from "@/components/ui/sidebar";
import type { AuthContext } from "@/types/auth";

const ROOT_DIR = path.resolve(import.meta.dir, "..");

function makeAuth(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    ...createEmptyAuthContext(),
    isAuthenticated: true,
    isActive: true,
    appUserId: "11111111-1111-1111-1111-111111111111",
    provider: "supabase",
    providerSubject: "22222222-2222-2222-2222-222222222222",
    email: "teste@artenmolduras.local",
    name: "Usuário Teste",
    status: "active",
    roles: ["consulta"],
    permissions: [],
    ...overrides,
  };
}

describe("1. RBAC por Módulo e Subrota (Anônimo, Inativo e Perfis Parciais)", () => {
  const protectedRoutes = Object.keys(ROUTE_REQUIRED_PERMISSIONS);

  test("usuário anônimo não acessa nenhuma rota protegida (apenas /login)", () => {
    const anon = createEmptyAuthContext();
    expect(canAccessPathname(anon, "/login")).toBe(true);
    for (const route of protectedRoutes) {
      expect(canAccessPathname(anon, route)).toBe(false);
    }
    expect(canAccessPathname(anon, "/producao/ordens/op-123")).toBe(false);
  });

  test("usuário autenticado mas inativo/suspenso/convidado não acessa rotas protegidas", () => {
    for (const status of ["inactive", "suspended", "invited"] as const) {
      const user = makeAuth({ isActive: false, status, permissions: ["pedidos.view"] });
      expect(canAccessPathname(user, "/login")).toBe(true);
      for (const route of protectedRoutes) {
        expect(canAccessPathname(user, route)).toBe(false);
      }
    }
  });

  test("subrotas de produtos, pedidos, estoque e produção respeitam permissões individuais", () => {
    const estoqueViewer = makeAuth({
      roles: ["estoque"],
      permissions: ["produtos.view", "estoque.view"],
    });

    // Tem acesso a /produtos e /produtos/essenciais, mas NÃO a /produtos/importacao
    expect(canAccessPathname(estoqueViewer, "/produtos")).toBe(true);
    expect(canAccessPathname(estoqueViewer, "/produtos/essenciais")).toBe(true);
    expect(canAccessPathname(estoqueViewer, "/produtos/importacao")).toBe(false);

    // Subrotas de estoque permitidas; produção e configurações bloqueadas
    expect(canAccessPathname(estoqueViewer, "/estoque")).toBe(true);
    expect(canAccessPathname(estoqueViewer, "/estoque/retalhos")).toBe(true);
    expect(canAccessPathname(estoqueViewer, "/estoque/movimentacoes")).toBe(true);
    expect(canAccessPathname(estoqueViewer, "/estoque/ordens")).toBe(true);
    expect(canAccessPathname(estoqueViewer, "/producao")).toBe(false);
    expect(canAccessPathname(estoqueViewer, "/producao/ordens")).toBe(false);
    expect(canAccessPathname(estoqueViewer, "/producao/ordens/abc")).toBe(false);
    expect(canAccessPathname(estoqueViewer, "/configuracoes")).toBe(false);

    // Usuário com pedidos.view mas sem pedidos.create/update acessa /pedidos, mas não /pedidos/novo
    const consulta = makeAuth({
      roles: ["consulta"],
      permissions: ["pedidos.view"],
    });
    expect(canAccessPathname(consulta, "/pedidos")).toBe(true);
    expect(canAccessPathname(consulta, "/pedidos/novo")).toBe(false);
  });
});

describe("2. Sidebar SSR e Prevenção de Hydration Mismatch", () => {
  test("SidebarProvider renderiza HTML consistente no SSR com estado inicial determinístico", () => {
    const htmlExpanded = renderToString(
      React.createElement(
        SidebarProvider,
        { defaultOpen: true },
        React.createElement(
          Sidebar,
          { collapsible: "icon" },
          React.createElement("div", null, "Nav"),
        ),
      ),
    );
    expect(htmlExpanded).toContain('data-state="expanded"');
    expect(htmlExpanded).toContain('data-collapsible=""');

    const htmlCollapsed = renderToString(
      React.createElement(
        SidebarProvider,
        { defaultOpen: false },
        React.createElement(
          Sidebar,
          { collapsible: "icon" },
          React.createElement("div", null, "Nav"),
        ),
      ),
    );
    expect(htmlCollapsed).toContain('data-state="collapsed"');
    expect(htmlCollapsed).toContain('data-collapsible="icon"');
  });

  test("sidebar.tsx lê cookie apenas em useEffect (pós-mount) e preserva Ctrl+B e sidebar_state", () => {
    const sidebarSrc = fs.readFileSync(
      path.join(ROOT_DIR, "src", "components", "ui", "sidebar.tsx"),
      "utf8",
    );
    expect(sidebarSrc).toContain("React.useState(defaultOpen)");
    expect(sidebarSrc).not.toMatch(/React\.useState\(\(\)\s*=>\s*\{[\s\S]*?document\.cookie/);
    expect(sidebarSrc).toContain("SIDEBAR_COOKIE_NAME");
    expect(sidebarSrc).toContain('SIDEBAR_KEYBOARD_SHORTCUT = "b"');
    expect(sidebarSrc).toContain("SameSite=Lax");
  });
});

describe("3. Auditoria Estrutural de Consultas Protegidas, Navegação e Command Palette", () => {
  test("AppShell.tsx não libera navegação nem alertas para !auth.isAuthenticated e filtra subitems via canPath", () => {
    const appShellSrc = fs.readFileSync(
      path.join(ROOT_DIR, "src", "components", "layout", "AppShell.tsx"),
      "utf8",
    );
    expect(appShellSrc).not.toContain("!auth.isAuthenticated ||");
    expect(appShellSrc).not.toContain("if (!auth.isAuthenticated) return true");
    expect(appShellSrc).toContain("canPath(sub.to)");
    expect(appShellSrc).toContain('can("produtos.view")');
    expect(appShellSrc).toContain(
      "!isLoading && (!authRequired || (auth.isAuthenticated && auth.isActive))",
    );
  });

  test("CommandPalette.tsx usa debounce, busca paginada/limitada e respeita RBAC e isLoading", () => {
    const cpSrc = fs.readFileSync(
      path.join(ROOT_DIR, "src", "components", "layout", "CommandPalette.tsx"),
      "utf8",
    );
    expect(cpSrc).not.toContain("!auth.isAuthenticated ||");
    expect(cpSrc).not.toContain("if (!auth.isAuthenticated) return true");
    expect(cpSrc).toContain("SEARCH_DEBOUNCE_MS");
    expect(cpSrc).toContain("SEARCH_LIMIT");
    expect(cpSrc).toContain("commandSearchService");
    expect(cpSrc).toContain('can("pedidos.view")');
    expect(cpSrc).toContain('can("clientes.view")');
    expect(cpSrc).toContain('can("produtos.view")');
    expect(cpSrc).toContain('can("producao.view")');
    expect(cpSrc).toContain(
      "!isLoading && (!authRequired || (auth.isAuthenticated && auth.isActive))",
    );

    const searchSvcSrc = fs.readFileSync(
      path.join(ROOT_DIR, "src", "lib", "services", "command-search.service.ts"),
      "utf8",
    );
    expect(searchSvcSrc).toContain(".range(from, to)");
    expect(searchSvcSrc).toContain("parseNumericToken");
  });

  test("AuthContextProvider.tsx bloqueia can/canAny/canModule/canPath durante sessionQuery.isLoading", () => {
    const authCtxSrc = fs.readFileSync(
      path.join(ROOT_DIR, "src", "components", "auth", "AuthContextProvider.tsx"),
      "utf8",
    );
    expect(authCtxSrc).toContain("if (sessionQuery.isLoading) return false;");
  });
});
