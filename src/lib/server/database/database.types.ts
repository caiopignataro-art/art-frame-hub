import type { AuthContext } from "@/types/auth";
import type { AuthRepository } from "@/lib/server/repositories/auth.repository";
import type { ClientesRepository } from "@/lib/server/repositories/clientes.repository";
import type { ConfiguracoesRepository } from "@/lib/server/repositories/configuracoes.repository";
import type { DashboardRepository } from "@/lib/server/repositories/dashboard.repository";
import type { EstoqueRepository } from "@/lib/server/repositories/estoque.repository";
import type { HistoricoRepository } from "@/lib/server/repositories/historico.repository";
import type { ImportacoesRepository } from "@/lib/server/repositories/importacoes.repository";
import type { OrcamentosRepository } from "@/lib/server/repositories/orcamentos.repository";
import type { OrdemProducaoRepository } from "@/lib/server/repositories/ordem-producao.repository";
import type { PagamentosRepository } from "@/lib/server/repositories/pagamentos.repository";
import type { PedidosRepository } from "@/lib/server/repositories/pedidos.repository";
import type { PermissionsRepository } from "@/lib/server/repositories/permissions.repository";
import type { ProdutosRepository } from "@/lib/server/repositories/produtos.repository";
import type { RolesRepository } from "@/lib/server/repositories/roles.repository";
import type { UsersRepository } from "@/lib/server/repositories/users.repository";
import type { WhatsappRepository } from "@/lib/server/repositories/whatsapp.repository";

export type DatabaseProviderName = "supabase" | "postgresql";

export interface DatabaseExecutionContext {
  /** Token JWT validado da requisição atual (isolado por request). */
  accessToken?: string | null;
  /** Contexto do usuário autenticado na requisição. */
  auth?: AuthContext | null;
}

/**
 * Container de repositórios da aplicação.
 * Na Fase A, os repositórios de identidade/acesso (`auth`, `users`, `roles`, `permissions`)
 * estão ativos e implementados. Os repositórios de negócio possuem contratos definidos
 * e serão implementados nas Fases B a E.
 */
export interface DatabaseRepositories {
  readonly provider: DatabaseProviderName;
  readonly auth: AuthRepository;
  readonly users: UsersRepository;
  readonly roles: RolesRepository;
  readonly permissions: PermissionsRepository;

  // Contratos preparados para as Fases B a E
  readonly clientes?: ClientesRepository;
  readonly produtos?: ProdutosRepository;
  readonly configuracoes?: ConfiguracoesRepository;
  readonly dashboard?: DashboardRepository;
  readonly orcamentos?: OrcamentosRepository;
  readonly pedidos?: PedidosRepository;
  readonly pagamentos?: PagamentosRepository;
  readonly historico?: HistoricoRepository;
  readonly estoque?: EstoqueRepository;
  readonly ordemProducao?: OrdemProducaoRepository;
  readonly importacoes?: ImportacoesRepository;
  readonly whatsapp?: WhatsappRepository;
}
