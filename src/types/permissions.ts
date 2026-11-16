/**
 * Catálogo de Módulos, Perfis e Permissões Granulares do Art Frame Hub.
 * Independente do provedor de banco de dados e de autenticação.
 */

export const PERMISSION_MODULES = [
  "dashboard",
  "clientes",
  "produtos",
  "orcamentos",
  "pedidos",
  "pagamentos",
  "estoque",
  "producao",
  "historico",
  "configuracoes",
  "usuarios",
  "perfis",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export const PERMISSION_MODULE_LABELS: Record<PermissionModule, string> = {
  dashboard: "Dashboard",
  clientes: "Clientes",
  produtos: "Produtos e Importação",
  orcamentos: "Orçamentos",
  pedidos: "Pedidos e Calculadora",
  pagamentos: "Pagamentos e Financeiro",
  estoque: "Estoque Inteligente",
  producao: "Produção e Ordens (OP)",
  historico: "Histórico e Auditoria",
  configuracoes: "Configurações do Sistema",
  usuarios: "Gestão de Usuários",
  perfis: "Perfis e Permissões",
};

export const PERMISSION_CODES = [
  // Dashboard
  "dashboard.view",

  // Clientes
  "clientes.view",
  "clientes.create",
  "clientes.update",
  "clientes.delete",

  // Produtos & Catálogo
  "produtos.view",
  "produtos.create",
  "produtos.update",
  "produtos.delete",
  "produtos.bulk_update",
  "produtos.import",

  // Orçamentos
  "orcamentos.view",
  "orcamentos.create",
  "orcamentos.update",
  "orcamentos.delete",

  // Pedidos
  "pedidos.view",
  "pedidos.create",
  "pedidos.update",
  "pedidos.delete",
  "pedidos.approve",
  "pedidos.cancel",
  "pedidos.archive",
  "pedidos.reopen",
  "pedidos.whatsapp",

  // Pagamentos
  "pagamentos.view",
  "pagamentos.create",
  "pagamentos.update",
  "pagamentos.delete",
  "pagamentos.manage",

  // Estoque
  "estoque.view",
  "estoque.create",
  "estoque.update",
  "estoque.delete",
  "estoque.adjust",
  "estoque.discard",
  "estoque.manage_minimum",

  // Produção
  "producao.view",
  "producao.create",
  "producao.update",
  "producao.delete",
  "producao.create_order",
  "producao.prepare_component",
  "producao.mark_problem",
  "producao.complete_item",
  "producao.complete_order",
  "producao.cancel_order",
  "producao.archive_order",
  "producao.remove_order_item",

  // Histórico
  "historico.view",

  // Configurações
  "configuracoes.view",
  "configuracoes.update",
  "configuracoes.manage",

  // Usuários
  "usuarios.view",
  "usuarios.create",
  "usuarios.update",
  "usuarios.delete",
  "usuarios.deactivate",

  // Perfis e Permissões
  "perfis.view",
  "perfis.create",
  "perfis.update",
  "perfis.delete",
  "roles.manage",
  "permissions.manage",
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number] | (string & {});

export interface Permission {
  id: string;
  code: string;
  name: string;
  module: PermissionModule;
  description: string | null;
  created_at: string;
}

export interface PermissionSeedDefinition {
  code: PermissionCode;
  name: string;
  module: PermissionModule;
  description: string;
}

export const SYSTEM_PERMISSIONS_CATALOG: readonly PermissionSeedDefinition[] = [
  // Dashboard
  {
    code: "dashboard.view",
    name: "Visualizar Dashboard",
    module: "dashboard",
    description: "Permite visualizar indicadores de faturamento, produção e alertas no Dashboard.",
  },

  // Clientes
  {
    code: "clientes.view",
    name: "Visualizar Clientes",
    module: "clientes",
    description: "Permite listar, buscar e consultar clientes.",
  },
  {
    code: "clientes.create",
    name: "Cadastrar Clientes",
    module: "clientes",
    description: "Permite cadastrar novos clientes.",
  },
  {
    code: "clientes.update",
    name: "Editar Clientes",
    module: "clientes",
    description: "Permite atualizar dados de clientes existentes.",
  },
  {
    code: "clientes.delete",
    name: "Excluir Clientes",
    module: "clientes",
    description: "Permite remover clientes sem pedidos vinculados.",
  },

  // Produtos
  {
    code: "produtos.view",
    name: "Visualizar Produtos",
    module: "produtos",
    description: "Permite consultar catálogo de produtos, molduras e insumos.",
  },
  {
    code: "produtos.create",
    name: "Cadastrar Produtos",
    module: "produtos",
    description: "Permite cadastrar produtos essenciais e de catálogo.",
  },
  {
    code: "produtos.update",
    name: "Editar Produtos",
    module: "produtos",
    description: "Permite editar preços, estoque e atributos de produtos.",
  },
  {
    code: "produtos.delete",
    name: "Excluir Produtos",
    module: "produtos",
    description: "Permite excluir produtos do catálogo.",
  },
  {
    code: "produtos.bulk_update",
    name: "Atualização em Massa de Preços",
    module: "produtos",
    description: "Permite simular e aplicar reajustes de preço em lote.",
  },
  {
    code: "produtos.import",
    name: "Importar Planilhas de Produtos",
    module: "produtos",
    description: "Permite importar catálogos XLSX de molduras e passe-partouts.",
  },

  // Orçamentos
  {
    code: "orcamentos.view",
    name: "Visualizar Orçamentos",
    module: "orcamentos",
    description: "Permite visualizar orçamentos e usar a calculadora.",
  },
  {
    code: "orcamentos.create",
    name: "Criar Orçamentos",
    module: "orcamentos",
    description: "Permite elaborar novos orçamentos.",
  },
  {
    code: "orcamentos.update",
    name: "Editar Orçamentos",
    module: "orcamentos",
    description: "Permite atualizar orçamentos existentes.",
  },
  {
    code: "orcamentos.delete",
    name: "Excluir Orçamentos",
    module: "orcamentos",
    description: "Permite excluir orçamentos.",
  },

  // Pedidos
  {
    code: "pedidos.view",
    name: "Visualizar Pedidos",
    module: "pedidos",
    description: "Permite listar e visualizar detalhes de pedidos.",
  },
  {
    code: "pedidos.create",
    name: "Criar Pedidos",
    module: "pedidos",
    description: "Permite criar novos pedidos e itens.",
  },
  {
    code: "pedidos.update",
    name: "Editar Pedidos",
    module: "pedidos",
    description: "Permite editar pedidos e atualizar seus status operacionais.",
  },
  {
    code: "pedidos.delete",
    name: "Excluir Pedidos",
    module: "pedidos",
    description: "Permite excluir pedidos.",
  },
  {
    code: "pedidos.approve",
    name: "Aprovar Pedidos",
    module: "pedidos",
    description: "Permite aprovar orçamentos transformando-os em pedidos aprovados.",
  },
  {
    code: "pedidos.cancel",
    name: "Cancelar / Reverter Aprovação",
    module: "pedidos",
    description: "Permite reverter aprovação de pedidos ou cancelá-los.",
  },
  {
    code: "pedidos.archive",
    name: "Arquivar Pedidos",
    module: "pedidos",
    description: "Permite arquivar pedidos em orçamento em lote.",
  },
  {
    code: "pedidos.reopen",
    name: "Reabrir / Retornar Pedidos",
    module: "pedidos",
    description: "Permite retornar pedidos de produção para aprovado.",
  },
  {
    code: "pedidos.whatsapp",
    name: "Enviar Pedido por WhatsApp / PDF",
    module: "pedidos",
    description: "Permite gerar PDF e registrar envio de notificações via WhatsApp.",
  },

  // Pagamentos
  {
    code: "pagamentos.view",
    name: "Visualizar Pagamentos",
    module: "pagamentos",
    description: "Permite consultar pagamentos e saldos financeiros.",
  },
  {
    code: "pagamentos.create",
    name: "Registrar Pagamentos",
    module: "pagamentos",
    description: "Permite registrar novos recebimentos e sinais.",
  },
  {
    code: "pagamentos.update",
    name: "Editar Pagamentos",
    module: "pagamentos",
    description: "Permite alterar status e valores de pagamentos.",
  },
  {
    code: "pagamentos.delete",
    name: "Excluir Pagamentos",
    module: "pagamentos",
    description: "Permite remover lançamentos de pagamento.",
  },
  {
    code: "pagamentos.manage",
    name: "Gerenciar Financeiro Completo",
    module: "pagamentos",
    description: "Permite gerenciar todas as operações financeiras e estornos.",
  },

  // Estoque
  {
    code: "estoque.view",
    name: "Visualizar Estoque",
    module: "estoque",
    description: "Permite visualizar saldos de barras, retalhos, reservas e movimentações.",
  },
  {
    code: "estoque.create",
    name: "Registrar Entrada de Estoque",
    module: "estoque",
    description: "Permite registrar entradas de materiais no estoque.",
  },
  {
    code: "estoque.update",
    name: "Atualizar Estoque",
    module: "estoque",
    description: "Permite atualizar dados operacionais de estoque.",
  },
  {
    code: "estoque.delete",
    name: "Excluir Registros de Estoque",
    module: "estoque",
    description: "Permite remover registros manuais de estoque quando aplicável.",
  },
  {
    code: "estoque.adjust",
    name: "Ajustar Saldo de Estoque",
    module: "estoque",
    description: "Permite realizar ajustes manuais de entrada e baixa de barras.",
  },
  {
    code: "estoque.discard",
    name: "Descartar Retalhos",
    module: "estoque",
    description: "Permite marcar retalhos disponíveis como descartados.",
  },
  {
    code: "estoque.manage_minimum",
    name: "Gerenciar Estoque Mínimo",
    module: "estoque",
    description: "Permite configurar limites de estoque mínimo por produto e fabricante.",
  },

  // Produção
  {
    code: "producao.view",
    name: "Visualizar Produção",
    module: "producao",
    description: "Permite visualizar o Kanban de produção e Ordens de Produção (OP).",
  },
  {
    code: "producao.create",
    name: "Criar Registros de Produção",
    module: "producao",
    description: "Permite iniciar fluxos de produção.",
  },
  {
    code: "producao.update",
    name: "Atualizar Produção",
    module: "producao",
    description: "Permite atualizar andamento de itens e pedidos na produção.",
  },
  {
    code: "producao.delete",
    name: "Remover Registros de Produção",
    module: "producao",
    description: "Permite remover vínculos produtivos quando autorizado.",
  },
  {
    code: "producao.create_order",
    name: "Criar Ordem de Produção (OP)",
    module: "producao",
    description: "Permite agrupar pedidos aprovados em uma nova Ordem de Produção.",
  },
  {
    code: "producao.prepare_component",
    name: "Preparar Componentes na OP",
    module: "producao",
    description:
      "Permite marcar ou desmarcar componentes individuais (moldura, vidro, etc.) como preparados.",
  },
  {
    code: "producao.mark_problem",
    name: "Apontar Problemas na Produção",
    module: "producao",
    description: "Permite registrar e remover apontamentos de problema em itens da OP.",
  },
  {
    code: "producao.complete_item",
    name: "Concluir Item de Produção",
    module: "producao",
    description: "Permite marcar um item completo da OP como pronto.",
  },
  {
    code: "producao.complete_order",
    name: "Concluir Pedido / Ordem de Produção",
    module: "producao",
    description: "Permite concluir pedidos prontos na OP e finalizar a Ordem de Produção.",
  },
  {
    code: "producao.cancel_order",
    name: "Cancelar Ordem de Produção",
    module: "producao",
    description: "Permite cancelar uma OP retornando seus pedidos para Aprovado.",
  },
  {
    code: "producao.archive_order",
    name: "Arquivar Ordem de Produção",
    module: "producao",
    description: "Permite arquivar Ordens de Produção concluídas ou sem pedidos ativos.",
  },
  {
    code: "producao.remove_order_item",
    name: "Remover Pedido de uma OP",
    module: "producao",
    description: "Permite desvincular seletivamente um pedido de uma Ordem de Produção.",
  },

  // Histórico
  {
    code: "historico.view",
    name: "Visualizar Histórico",
    module: "historico",
    description: "Permite consultar a trilha de auditoria de alterações do sistema.",
  },

  // Configurações
  {
    code: "configuracoes.view",
    name: "Visualizar Configurações",
    module: "configuracoes",
    description: "Permite visualizar parâmetros do sistema.",
  },
  {
    code: "configuracoes.update",
    name: "Atualizar Configurações",
    module: "configuracoes",
    description: "Permite alterar parâmetros de barra, perda de corte e parcelamento.",
  },
  {
    code: "configuracoes.manage",
    name: "Gerenciar Configurações do Sistema",
    module: "configuracoes",
    description: "Permite administração completa das configurações globais.",
  },

  // Usuários
  {
    code: "usuarios.view",
    name: "Visualizar Usuários",
    module: "usuarios",
    description: "Permite listar usuários, seus perfis e logs de acesso.",
  },
  {
    code: "usuarios.create",
    name: "Criar / Convidar Usuários",
    module: "usuarios",
    description: "Permite cadastrar novos usuários e atribuir perfis.",
  },
  {
    code: "usuarios.update",
    name: "Editar Usuários",
    module: "usuarios",
    description: "Permite atualizar dados cadastrais e perfis de usuários.",
  },
  {
    code: "usuarios.delete",
    name: "Remover Vínculos de Usuário",
    module: "usuarios",
    description: "Permite gerenciar remoção lógica e vínculos de usuários.",
  },
  {
    code: "usuarios.deactivate",
    name: "Ativar / Desativar Usuários",
    module: "usuarios",
    description: "Permite suspender, desativar ou reativar o acesso de usuários ao ERP.",
  },

  // Perfis
  {
    code: "perfis.view",
    name: "Visualizar Perfis e Permissões",
    module: "perfis",
    description: "Permite consultar perfis de acesso e matriz de permissões.",
  },
  {
    code: "perfis.create",
    name: "Criar Perfis Personalizados",
    module: "perfis",
    description: "Permite criar novos perfis de acesso.",
  },
  {
    code: "perfis.update",
    name: "Editar Perfis",
    module: "perfis",
    description: "Permite editar nome, descrição e status de perfis.",
  },
  {
    code: "perfis.delete",
    name: "Excluir Perfis Personalizados",
    module: "perfis",
    description: "Permite excluir perfis personalizados que não sejam de sistema.",
  },
  {
    code: "roles.manage",
    name: "Gerenciar Perfis de Acesso",
    module: "perfis",
    description: "Permite administrar perfis e atribuí-los aos usuários.",
  },
  {
    code: "permissions.manage",
    name: "Configurar Permissões de Perfis",
    module: "perfis",
    description: "Permite alterar as permissões granulares associadas a cada perfil.",
  },
];

// ---------- Perfis Iniciais ----------
export const SYSTEM_ROLE_CODES = [
  "admin",
  "atendimento",
  "financeiro",
  "estoque",
  "producao",
  "consulta",
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLE_CODES)[number];

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  is_system: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoleWithDetails extends Role {
  permissions: Permission[];
  permission_codes: string[];
  users_count: number;
}

export interface CreateRoleInput {
  code: string;
  name: string;
  description?: string | null;
  active?: boolean;
  permissionIds?: string[];
  permissionCodes?: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
  active?: boolean;
}

export interface SystemRoleSeedDefinition {
  code: SystemRoleCode;
  name: string;
  description: string;
  is_system: true;
  permissions: readonly PermissionCode[];
}

/**
 * Matriz Inicial de Permissões conforme especificação da Fase A (Seção 5.6).
 */
export const INITIAL_ROLES_SEED: readonly SystemRoleSeedDefinition[] = [
  {
    code: "admin",
    name: "Administrador",
    description: "Acesso total a todos os módulos, configurações, usuários e permissões do ERP.",
    is_system: true,
    permissions: PERMISSION_CODES,
  },
  {
    code: "atendimento",
    name: "Atendimento",
    description: "Gestão comercial de clientes, calculadora, orçamentos e operação de pedidos.",
    is_system: true,
    permissions: [
      "dashboard.view",
      // Clientes: Total
      "clientes.view",
      "clientes.create",
      "clientes.update",
      "clientes.delete",
      // Produtos: Visualizar
      "produtos.view",
      // Orçamentos: Total
      "orcamentos.view",
      "orcamentos.create",
      "orcamentos.update",
      "orcamentos.delete",
      // Pedidos: Operar
      "pedidos.view",
      "pedidos.create",
      "pedidos.update",
      "pedidos.approve",
      "pedidos.archive",
      "pedidos.whatsapp",
      // Pagamentos: Visualizar (e registrar sinal junto ao pedido)
      "pagamentos.view",
      "pagamentos.create",
      // Estoque: Visualizar
      "estoque.view",
      // Produção: Visualizar
      "producao.view",
      // Histórico: Visualizar
      "historico.view",
    ],
  },
  {
    code: "financeiro",
    name: "Financeiro",
    description: "Gestão completa de pagamentos, recebimentos e consulta comercial.",
    is_system: true,
    permissions: [
      "dashboard.view",
      "clientes.view",
      "produtos.view",
      "orcamentos.view",
      "pedidos.view",
      // Pagamentos: Total
      "pagamentos.view",
      "pagamentos.create",
      "pagamentos.update",
      "pagamentos.delete",
      "pagamentos.manage",
      // Estoque e Histórico: Visualizar
      "estoque.view",
      "historico.view",
    ],
  },
  {
    code: "estoque",
    name: "Estoque",
    description:
      "Gestão total de estoque, retalhos, movimentações e operação do catálogo de produtos.",
    is_system: true,
    permissions: [
      "dashboard.view",
      "clientes.view",
      // Produtos: Operar
      "produtos.view",
      "produtos.create",
      "produtos.update",
      "produtos.bulk_update",
      "produtos.import",
      // Pedidos: Visualizar
      "pedidos.view",
      // Estoque: Total
      "estoque.view",
      "estoque.create",
      "estoque.update",
      "estoque.delete",
      "estoque.adjust",
      "estoque.discard",
      "estoque.manage_minimum",
      // Produção e Histórico: Visualizar
      "producao.view",
      "historico.view",
    ],
  },
  {
    code: "producao",
    name: "Produção",
    description:
      "Gestão total de Ordens de Produção (OP), preparação de itens, apontamentos e consumo de estoque.",
    is_system: true,
    permissions: [
      "dashboard.view",
      "clientes.view",
      "produtos.view",
      // Pedidos: Operar (fluxo produtivo)
      "pedidos.view",
      "pedidos.update",
      "pedidos.reopen",
      // Estoque: Operar
      "estoque.view",
      "estoque.update",
      "estoque.discard",
      // Produção: Total
      "producao.view",
      "producao.create",
      "producao.update",
      "producao.delete",
      "producao.create_order",
      "producao.prepare_component",
      "producao.mark_problem",
      "producao.complete_item",
      "producao.complete_order",
      "producao.cancel_order",
      "producao.archive_order",
      "producao.remove_order_item",
      // Histórico: Visualizar
      "historico.view",
    ],
  },
  {
    code: "consulta",
    name: "Consulta",
    description: "Acesso exclusivo de leitura e visualização aos módulos operacionais do ERP.",
    is_system: true,
    permissions: [
      "dashboard.view",
      "clientes.view",
      "produtos.view",
      "orcamentos.view",
      "pedidos.view",
      "pagamentos.view",
      "estoque.view",
      "producao.view",
      "historico.view",
    ],
  },
];
