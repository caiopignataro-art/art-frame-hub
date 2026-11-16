import type { Historico, OrdemProducao, OrdemProducaoItem, PedidoComItens } from "@/types/erp";

export interface ProductionConclusionResult {
  pedido: {
    id: string;
    concluido: boolean;
    pedido_pronto: boolean;
  };
  ordemProducao: {
    id: string;
    concluida: boolean;
    pedidosConcluidos: number;
    pedidosTotal: number;
  };
}

export interface ProductionItemState {
  id: string;
  preparado: boolean;
  possui_problema: boolean;
  problema_tipo: string | null;
  problema_descricao: string | null;
  preparado_em: string | null;
  preparado_por: string | null;
  problema_em: string | null;
  problema_por: string | null;
}

export interface PedidoOperationalState {
  id: string;
  itens_total: number;
  itens_preparados: number;
  itens_com_problema: number;
  pedido_pronto: boolean;
}

export interface ProductionOperationResult {
  item: ProductionItemState;
  pedido: PedidoOperationalState;
}

export interface OrdemProducaoDetalhePayload {
  op: OrdemProducao;
  pedidos: PedidoComItens[];
  opItens: OrdemProducaoItem[];
  itensCount: number;
  quantidadesCount: number;
  historico: Historico[];
}

export interface OrdemProducaoRepository {
  list(): Promise<(OrdemProducao & { qtd_pedidos: number; para_dia?: string })[]>;
  getById(id: string): Promise<OrdemProducaoDetalhePayload | null>;
  create(params: { pedidosIds: string[]; observacoes?: string | null }): Promise<string>;
  removerPedido(params: { pedidoId: string; motivo: string }): Promise<{
    ordem_producao_id: string;
    op_ficou_vazia: boolean;
    pedidos_restantes: number;
  }>;
  concluir(id: string): Promise<void>;
  arquivar(id: string): Promise<void>;
  cancelar(id: string): Promise<void>;
  marcarItemPreparado(
    ordemProducaoItemId: string,
    preparado: boolean,
  ): Promise<ProductionOperationResult>;
  marcarComponentePreparado(
    componenteId: string,
    preparado: boolean,
  ): Promise<ProductionOperationResult>;
  registrarProblemaItem(
    ordemProducaoItemId: string,
    problema: { possui_problema: boolean; tipo?: string; descricao?: string },
  ): Promise<ProductionOperationResult>;
  concluirPedidoProducao(pedidoId: string): Promise<ProductionConclusionResult>;
}
