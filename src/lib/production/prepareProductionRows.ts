import type { OrdemProducao, PedidoComItens } from "@/types/erp";

export interface ProductionRow {
  readonly pedidoId: string;
  readonly pedidoNumero: number;
  readonly itemId: string;
  readonly itemIndex: number;
  readonly quantidade: number;
  readonly moldura: string;
  readonly medidas: string;
  readonly protecaoFrontal: string;
  readonly fundo: string;
  readonly passePartout: string;
  readonly maoDeObra: string;
  readonly identificacao: string;
}

export interface ProductionGroupedOrder {
  readonly pedidoId: string;
  readonly pedidoNumero: number;
  readonly itens: readonly ProductionRow[];
  readonly totalItens: number;
}

export interface OrdemProducaoDetalhadaCompleta {
  op: OrdemProducao;
  pedidos: PedidoComItens[];
  itensCount: number;
  quantidadesCount: number;
  historico: any[];
}

/**
 * Pure data preparation function mapping database JSON structures to a clean presenter schema.
 * Respects original ordering without sorting, filtering, or modifying inputs.
 */
export function prepareProductionRows(ordemData: OrdemProducaoDetalhadaCompleta): readonly ProductionGroupedOrder[] {
  if (!ordemData || !ordemData.pedidos) return [];

  return ordemData.pedidos.map((pedido) => {
    const itens = pedido.itens ?? [];

    const mappedItens = itens.map((item, index): ProductionRow => {
      const md = item.metadados as any;

      // Extract moldura
      let moldura = "—";
      const moldurasInput = md?.entrada?.molduras ?? [];
      if (moldurasInput.length > 0) {
        moldura = moldurasInput.map((m: any) => m.codigo || m.descricao).join(" + ");
      }

      // Extract medidas
      const medidas = `${Number(item.largura_cm || 0)} × ${Number(item.altura_cm || 0)}`;

      // Extract protecaoFrontal
      const protecaoFrontal =
        md?.calculo?.materiais?.find((m: any) => m.origem === "protecao_frontal")?.descricao || "—";

      // Extract fundo
      const fundo =
        md?.calculo?.materiais?.find((m: any) => m.origem === "fundo")?.descricao || "—";

      // Extract passePartout
      const passePartout = md?.entrada?.passe_partouts?.length > 0 ? "Sim" : "Não";

      // Extract maoDeObra
      let maoDeObra = "—";
      const servicos = md?.calculo?.materiais
        ?.filter((m: any) => m.origem === "servico")
        ?.map((m: any) => m.descricao);
      if (servicos && servicos.length > 0) {
        maoDeObra = servicos.join(", ");
      }

      // Extract identificacao
      const identificacao = md?.entrada?.observacoes || item.descricao || "—";

      return {
        pedidoId: pedido.id,
        pedidoNumero: pedido.numero_pedido,
        itemId: item.id,
        itemIndex: index,
        quantidade: Number(item.quantidade || 0),
        moldura,
        medidas,
        protecaoFrontal,
        fundo,
        passePartout,
        maoDeObra,
        identificacao,
      };
    });

    return {
      pedidoId: pedido.id,
      pedidoNumero: pedido.numero_pedido,
      itens: mappedItens,
      totalItens: mappedItens.length,
    };
  });
}
