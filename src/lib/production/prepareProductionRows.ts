import type { OrdemProducao, PedidoComItens } from "@/types/erp";
import type { MaterialCalculado } from "@/lib/calculadora/types";

export type OperationalStatus = "PENDENTE" | "PREPARADO" | "PROBLEMA";

export function getOperationalStatus(item: { preparado: boolean; possui_problema: boolean }): OperationalStatus {
  if (item.preparado && item.possui_problema) {
    if (process.env.NODE_ENV !== "production") {
      throw new Error("Estado inválido: item não pode ser preparado e possuir problema simultaneamente.");
    }
    return "PROBLEMA";
  }
  if (item.preparado) return "PREPARADO";
  if (item.possui_problema) return "PROBLEMA";
  return "PENDENTE";
}

export interface ProductionRow {
  readonly pedidoId: string;
  readonly pedidoNumero: number;
  readonly itemId: string; // ID of the row in ordem_producao_itens
  readonly itemPedidoId: string; // ID of the row in pedido_itens
  readonly itemIndex: number;
  readonly quantidade: number;
  readonly moldura: string;
  readonly medidas: string;
  readonly protecaoFrontal: string;
  readonly fundo: string;
  readonly passePartout: string;
  readonly impressao: string;
  readonly servicos: string;
  readonly identificacao: string;
  readonly preparado: boolean;
  readonly preparadoEm: string | null;
  readonly preparadoPor: string | null;
  readonly possuiProblema: boolean;
  readonly problemaTipo: string | null;
  readonly problemaDescricao: string | null;
  readonly problemaEm: string | null;
  readonly problemaPor: string | null;
  readonly status: OperationalStatus;
  readonly componentes: readonly any[];
}

export interface ProductionGroupedOrder {
  readonly pedidoId: string;
  readonly pedidoNumero: number;
  readonly itens: readonly ProductionRow[];
  readonly totalItens: number;
  readonly pedidoPronto: boolean;
  readonly pedidoConcluido: boolean;
}

export interface OrdemProducaoDetalhadaCompleta {
  op: OrdemProducao;
  pedidos: PedidoComItens[];
  opItens: any[];
  itensCount: number;
  quantidadesCount: number;
  historico: any[];
}

/**
 * Pure data preparation function mapping database JSON structures to a clean presenter schema.
 * Respects original ordering without sorting, filtering, or modifying inputs.
 */
export function prepareProductionRows(ordemData: OrdemProducaoDetalhadaCompleta): readonly ProductionGroupedOrder[] {
  if (!ordemData || !ordemData.pedidos || !ordemData.opItens) return [];

  const opItensMap = new Map(ordemData.opItens.map(oi => [oi.item_pedido_id, oi]));

  return ordemData.pedidos.map((pedido) => {
    const itens = pedido.itens ?? [];

    const mappedItens = itens.map((item, index): ProductionRow => {
      const md = item.metadados as any;
      const opItem = opItensMap.get(item.id);

      // Extract moldura
      let moldura = "—";
      const moldurasInput = md?.entrada?.molduras ?? [];
      if (moldurasInput.length > 0) {
        moldura = moldurasInput.map((m: any) => m.codigo || m.descricao).join(" + ");
      }

      // Extract medidas (Abertura com fallback para Medida Final)
      const medAberturaL = md?.calculo?.largura_abertura_cm;
      const medAberturaA = md?.calculo?.altura_abertura_cm;
      const medidas = medAberturaL && medAberturaA
        ? `${Number(medAberturaL)} × ${Number(medAberturaA)}`
        : `${Number(item.largura_cm || 0)} × ${Number(item.altura_cm || 0)}`;

      // Classificação dos materiais em UMA ÚNICA PASSAGEM (O(N))
      const materiais: MaterialCalculado[] = md?.calculo?.materiais ?? [];
      let protecaoFrontal = "—";
      let fundo = "—";
      let impressao = "—";
      const servicosList: string[] = [];

      for (const m of materiais) {
        if (m.origem === "protecao_frontal") {
          protecaoFrontal = m.descricao;
        } else if (m.origem === "fundo") {
          fundo = m.descricao;
        } else if (m.origem === "impressao") {
          impressao = m.descricao;
        } else if (m.origem === "servico") {
          servicosList.push(m.descricao);
        }
      }

      const servicos = servicosList.length > 0 ? servicosList.join(", ") : "—";

      // Extract passePartout
      const passePartout = md?.entrada?.passe_partouts?.length > 0 ? "Sim" : "Não";

      // Extract identificacao
      const identificacao = md?.entrada?.observacoes || item.descricao || "—";

      const prepVal = !!opItem?.preparado;
      const probVal = !!opItem?.possui_problema;

      return {
        pedidoId: pedido.id,
        pedidoNumero: pedido.numero_pedido,
        itemId: opItem?.id ?? "",
        itemPedidoId: item.id,
        itemIndex: index,
        quantidade: Number(item.quantidade || 0),
        moldura,
        medidas,
        protecaoFrontal,
        fundo,
        passePartout,
        impressao,
        servicos,
        identificacao,
        preparado: prepVal,
        preparadoEm: opItem?.preparado_em ?? null,
        preparadoPor: opItem?.preparado_por ?? null,
        possuiProblema: probVal,
        problemaTipo: opItem?.problema_tipo ?? null,
        problemaDescricao: opItem?.problema_descricao ?? null,
        problemaEm: opItem?.problema_em ?? null,
        problemaPor: opItem?.problema_por ?? null,
        status: getOperationalStatus({ preparado: prepVal, possui_problema: probVal }),
        componentes: opItem?.componentes ?? [],
      };
    });

    return {
      pedidoId: pedido.id,
      pedidoNumero: pedido.numero_pedido,
      itens: mappedItens,
      totalItens: mappedItens.length,
      pedidoPronto: !!(pedido as any).pedido_pronto,
      pedidoConcluido: !!(pedido as any).pedido_concluido,
    };
  });
}
