import type { PagamentoSnapshot } from "@/lib/pagamento/modalidade";
import type {
  Cliente,
  Pedido,
  PedidoComItens,
  PedidoInsert,
  PedidoItem,
  PedidoItemDraft,
  PedidoItemInsert,
  PedidoStatus,
  PedidoUpdate,
} from "@/types/erp";

export interface CriarPedidoCompletoInput {
  cliente_id: string | null;
  itens: PedidoItemDraft[];
  forma_pagamento: PedidoInsert["forma_pagamento"];
  data_pedido: string;
  data_entrega_prevista: string;
  observacoes?: string | null;
  status?: PedidoStatus;
  pagamento?: PagamentoSnapshot;
}

export interface PedidosRepository {
  list(opts?: {
    status?: PedidoStatus;
    incluirArquivados?: boolean;
  }): Promise<(Pedido & { cliente: { nome: string } | null })[]>;
  getById(id: string): Promise<PedidoComItens | null>;
  create(input: PedidoInsert): Promise<Pedido>;
  update(id: string, patch: PedidoUpdate): Promise<Pedido>;
  setStatus(id: string, status: PedidoStatus): Promise<Pedido | void>;
  setStatusLote(ids: string[], status: PedidoStatus): Promise<void>;
  arquivarEmLote(ids: string[]): Promise<void>;
  voltarParaAprovado(id: string, motivo?: string): Promise<void>;
  voltarParaAprovadoEmLote(ids: string[]): Promise<void>;
  reverterAprovacao(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  addItem(item: PedidoItemInsert): Promise<PedidoItem>;
  removeItem(itemId: string): Promise<void>;
  criarPedidoCompleto(opts: CriarPedidoCompletoInput): Promise<Pedido>;
  atualizarPedidoCompleto(id: string, opts: CriarPedidoCompletoInput): Promise<Pedido>;
  marcarWhatsappEnviado(id: string, pdf_url?: string | null): Promise<Pedido>;
  getCliente(pedidoId: string): Promise<Cliente | null>;
}
