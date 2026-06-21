/**
 * Tipos de domínio do ERP de Molduraria.
 * Re-exporta os tipos gerados pelo Supabase com aliases legíveis
 * e adiciona shapes auxiliares (com relações populadas).
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

// ---------- Labels (para UI) ----------
export const ORCAMENTO_STATUS_LABEL: Record<OrcamentoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  convertido: "Convertido em pedido",
};

export const PEDIDO_STATUS_LABEL: Record<PedidoStatus, string> = {
  aguardando_producao: "Aguardando produção",
  em_producao: "Em produção",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

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
  moldura: "Moldura",
  vidro: "Vidro",
  paspatur: "Paspatur",
  fundo: "Fundo",
  acessorio: "Acessório",
  servico: "Serviço",
  outro: "Outro",
};
