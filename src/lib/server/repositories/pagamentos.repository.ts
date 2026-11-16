import type { Pagamento, PagamentoInsert, PagamentoUpdate } from "@/types/erp";

export type PagamentoComPedidoCliente = Pagamento & {
  pedido: { numero_pedido: number; cliente: { nome: string } | null } | null;
};

export interface PagamentosRepository {
  listByPedido(pedidoId: string): Promise<Pagamento[]>;
  listAll(): Promise<PagamentoComPedidoCliente[]>;
  create(input: PagamentoInsert): Promise<Pagamento>;
  update(id: string, patch: PagamentoUpdate): Promise<Pagamento>;
  remove(id: string): Promise<void>;
}
