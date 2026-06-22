/**
 * Helpers da Calculadora — converte resultado da calculadora em
 * um item-rascunho de pedido (PedidoItemDraft), pronto para ser
 * adicionado à tela de Novo Pedido.
 */
import type { CalcInput, CalcResult } from "@/lib/calculadora/types";
import type { PedidoItemDraft } from "@/types/erp";

function buildItemDescricao(input: CalcInput, result: CalcResult): string {
  const moldura = input.molduras
    .map((m) => m.produto.codigo ?? m.produto.nome)
    .join(" + ");
  const tam = `${result.largura_final_cm}×${result.altura_final_cm}cm (arte ${result.largura_interna_cm}×${result.altura_interna_cm})`;
  return [moldura || "Quadro personalizado", tam].filter(Boolean).join(" — ");
}

export function buildMetadados(input: CalcInput, result: CalcResult) {
  return {
    versao: 1,
    origem: "calculadora",
    entrada: {
      largura_interna_cm: input.largura_interna_cm,
      altura_interna_cm: input.altura_interna_cm,
      passe_partouts: input.passe_partouts.map((pp) => ({
        produto_id: pp.produto.id,
        codigo: pp.produto.codigo,
        descricao: pp.produto.nome,
        medida_cm: pp.medida_cm,
      })),
      molduras: input.molduras.map((m) => ({
        produto_id: m.produto.id,
        codigo: m.produto.codigo,
        descricao: m.produto.nome,
      })),
      protecao_id: input.protecao?.id ?? null,
      fundo_id: input.fundo?.id ?? null,
      servicos: input.servicos.map((s) => s.id),
      observacoes: input.observacoes ?? null,
    },
    calculo: result,
  };
}

export function buildDraftItem(input: CalcInput, result: CalcResult): PedidoItemDraft {
  return {
    descricao: buildItemDescricao(input, result),
    quantidade: result.quantidade,
    largura_cm: result.largura_final_cm,
    altura_cm: result.altura_final_cm,
    valor_unitario: result.total_venda / Math.max(1, result.quantidade),
    valor_total: result.total_venda,
    metadados: buildMetadados(input, result),
  };
}

// ---- Sessão (transporta itens da calculadora → /pedidos/novo) ----
const KEY = "molduraria-novo-pedido-itens";

export const novoPedidoStore = {
  read(): PedidoItemDraft[] {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(sessionStorage.getItem(KEY) || "[]");
    } catch {
      return [];
    }
  },
  write(itens: PedidoItemDraft[]) {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(KEY, JSON.stringify(itens));
  },
  add(item: PedidoItemDraft) {
    const cur = this.read();
    cur.push(item);
    this.write(cur);
  },
  clear() {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(KEY);
  },
};

export const calculadoraService = {
  buildDraftItem,
  buildMetadados,
};
