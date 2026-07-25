/**
 * Tipos de domínio do ERP de Molduraria.
 */
import type { Database, Tables, TablesInsert, TablesUpdate, Enums } from "@/integrations/supabase/types";

export type DB = Database;

// ---------- Entidades ----------
export type Cliente        = Tables<"clientes">;
export type Produto        = Tables<"produtos">;
export type Orcamento      = Tables<"orcamentos">;
export type OrcamentoItem  = Tables<"orcamento_itens">;
export type Pedido         = Tables<"pedidos">;
export type PedidoItem     = Tables<"pedido_itens">;
export type Pagamento      = Tables<"pagamentos">;
export type Historico      = Tables<"historico">;

// ---------- Inserts ----------
export type ClienteInsert       = TablesInsert<"clientes">;
export type ProdutoInsert       = TablesInsert<"produtos">;
export type OrcamentoInsert     = TablesInsert<"orcamentos">;
export type OrcamentoItemInsert = TablesInsert<"orcamento_itens">;
export type PedidoInsert        = TablesInsert<"pedidos">;
export type PedidoItemInsert    = TablesInsert<"pedido_itens">;
export type PagamentoInsert     = TablesInsert<"pagamentos">;

// ---------- Updates ----------
export type ClienteUpdate    = TablesUpdate<"clientes">;
export type ProdutoUpdate    = TablesUpdate<"produtos">;
export type OrcamentoUpdate  = TablesUpdate<"orcamentos">;
export type PedidoUpdate     = TablesUpdate<"pedidos">;
export type PagamentoUpdate  = TablesUpdate<"pagamentos">;

// ---------- Enums ----------
export type OrcamentoStatus  = Enums<"orcamento_status">;
export type PedidoStatus     = Enums<"pedido_status">;
export type PagamentoStatus  = Enums<"pagamento_status">;
export type FormaPagamento   = Enums<"forma_pagamento">;
export type ProdutoTipo      = Enums<"produto_tipo">;
export type HistoricoAcao    = Enums<"historico_acao">;

// ---------- Shapes compostos ----------
export type OrcamentoComItens = Orcamento & {
  cliente: Cliente | null;
  itens: OrcamentoItem[];
};

export type PedidoComItens = Pedido & {
  cliente: Cliente | null;
  itens: PedidoItem[];
  pagamentos: Pagamento[];
};

// ---------- Labels ----------
export const ORCAMENTO_STATUS_LABEL: Record<OrcamentoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  convertido: "Convertido em pedido",
};

export const PEDIDO_STATUS_LABEL: Record<PedidoStatus, string> = {
  orcamento: "Orçamento",
  aprovado: "Aprovado",
  em_producao: "Em produção",
  pronto: "Pronto",
  entregue: "Entregue",
};

/** Fluxo completo de status. */
export const PEDIDO_FLUXO: PedidoStatus[] = [
  "orcamento",
  "aprovado",
  "em_producao",
  "pronto",
  "entregue",
];

/** Status iniciais (antes de entrar em produção). */
export const PEDIDO_STATUS_INICIAIS: PedidoStatus[] = ["orcamento", "aprovado"];

// ---------- WhatsApp ----------
export type NotificacaoWhatsapp = Tables<"notificacoes_whatsapp">;
export type NotificacaoWhatsappInsert = TablesInsert<"notificacoes_whatsapp">;
export type WhatsappEvento =
  | "pedido_aprovado"
  | "pedido_pronto"
  | "pedido_entregue"
  | "orcamento_enviado"
  | "pagamento_recebido";

export const PAGAMENTO_STATUS_LABEL: Record<PagamentoStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
  parcial: "Parcial",
  estornado: "Estornado",
  cancelado: "Cancelado",
};

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};

export const PRODUTO_TIPO_LABEL: Record<ProdutoTipo, string> = {
  perfil_moldura: "Perfil de Moldura",
  passe_partout: "Passe-partout",
  protecao_frontal: "Proteção Frontal",
  fundo: "Fundo",
  impressao: "Impressão",
  chassi: "Chassi",
  servico: "Serviço",
  moldura: "Moldura (legado)",
  vidro: "Vidro (legado)",
  paspatur: "Paspatur (legado)",
  acessorio: "Acessório (legado)",
  outro: "Outro",
};

/** Categorias cadastradas manualmente (aba Essenciais). */
export const PRODUTO_CATEGORIAS_ESSENCIAIS = [
  "protecao_frontal",
  "fundo",
  "impressao",
  "chassi",
] as const satisfies readonly ProdutoTipo[];

export type ProdutoCategoriaEssencial = (typeof PRODUTO_CATEGORIAS_ESSENCIAIS)[number];

/** Categorias importadas via XLSX (aba Catálogo). */
export const PRODUTO_CATEGORIAS_IMPORTACAO = [
  "perfil_moldura",
  "passe_partout",
] as const satisfies readonly ProdutoTipo[];

export type ProdutoCategoriaImportacao = (typeof PRODUTO_CATEGORIAS_IMPORTACAO)[number];

// ---------- Item temporário da Calculadora (transferido para Novo Pedido) ----------
export interface PedidoItemDraft {
  descricao: string;
  quantidade: number;
  largura_cm: number;
  altura_cm: number;
  valor_unitario: number;
  valor_total: number;
  metadados: Record<string, unknown>;
}

// ---------- Ordem de Produção ----------
import type { OrdemProducaoStatus } from "@/lib/constants/ordem-producao-status";
export type { OrdemProducaoStatus };

export interface OrdemProducao {
  id: string;
  numero: number;
  status: OrdemProducaoStatus;
  criado_em: string;
  atualizado_em: string;
  concluido_em: string | null;
  criado_por: string | null;
  observacoes: string | null;
}

export interface OrdemProducaoItem {
  id: string;
  ordem_producao_id: string;
  pedido_id: string;
  item_pedido_id: string;
  criado_em: string;
  atualizado_em: string;
}

export type OrdemProducaoDetalhada = OrdemProducao & {
  pedidos: PedidoComItens[];
};

