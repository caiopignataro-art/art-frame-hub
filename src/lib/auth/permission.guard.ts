/**
 * Utilitários client-safe e server-safe de verificação de permissões na interface
 * e mapeamento de permissões por rota/módulo.
 *
 * IMPORTANTE: Ocultar botões ou bloquear rotas no cliente serve apenas para UX.
 * Toda validação real de segurança ocorre obrigatoriamente no servidor via `authorization.ts`.
 */
import type { AuthContext } from "@/types/auth";
import type { PermissionCode, PermissionModule } from "@/types/permissions";

export function canExecute(
  auth:
    Pick<AuthContext, "isAuthenticated" | "isActive" | "roles" | "permissions"> | null | undefined,
  permission: PermissionCode,
): boolean {
  if (!auth || !auth.isAuthenticated || !auth.isActive) return false;
  if (auth.roles.includes("admin")) return true;
  return auth.permissions.includes(permission);
}

export function canExecuteAny(
  auth:
    Pick<AuthContext, "isAuthenticated" | "isActive" | "roles" | "permissions"> | null | undefined,
  permissions: readonly PermissionCode[],
): boolean {
  if (!auth || !auth.isAuthenticated || !auth.isActive) return false;
  if (auth.roles.includes("admin")) return true;
  return permissions.some((p) => auth.permissions.includes(p));
}

export function canAccessModule(
  auth:
    Pick<AuthContext, "isAuthenticated" | "isActive" | "roles" | "permissions"> | null | undefined,
  module: PermissionModule,
): boolean {
  if (!auth || !auth.isAuthenticated || !auth.isActive) return false;
  if (auth.roles.includes("admin")) return true;
  return auth.permissions.some((code) => code.startsWith(`${module}.`));
}

/**
 * Mapeamento de rotas do ERP para as permissões necessárias de visualização.
 */
export const ROUTE_REQUIRED_PERMISSIONS: Record<string, readonly PermissionCode[]> = {
  "/": ["orcamentos.view", "pedidos.view", "pedidos.create"],
  "/dashboard": ["dashboard.view"],
  "/clientes": ["clientes.view"],
  "/pedidos": ["pedidos.view"],
  "/pedidos/novo": ["pedidos.create", "pedidos.update"],
  "/producao": ["producao.view"],
  "/producao/ordens": ["producao.view"],
  "/estoque": ["estoque.view"],
  "/estoque/retalhos": ["estoque.view"],
  "/estoque/movimentacoes": ["estoque.view"],
  "/estoque/ordens": ["estoque.view", "producao.view"],
  "/pagamentos": ["pagamentos.view"],
  "/produtos": ["produtos.view"],
  "/produtos/essenciais": ["produtos.view"],
  "/produtos/importacao": ["produtos.import", "produtos.create"],
  "/historico": ["historico.view"],
  "/configuracoes": [
    "configuracoes.view",
    "configuracoes.manage",
    "usuarios.view",
    "perfis.view",
    "roles.manage",
  ],
};

export function canAccessPathname(
  auth:
    Pick<AuthContext, "isAuthenticated" | "isActive" | "roles" | "permissions"> | null | undefined,
  pathname: string,
): boolean {
  if (pathname === "/login") return true;
  if (!auth || !auth.isAuthenticated || !auth.isActive) return false;
  if (auth.roles.includes("admin")) return true;

  if (pathname.startsWith("/producao/ordens/")) {
    return canExecuteAny(auth, ["producao.view"]);
  }

  const required = ROUTE_REQUIRED_PERMISSIONS[pathname];
  if (!required || required.length === 0) return true;
  return canExecuteAny(auth, required);
}
