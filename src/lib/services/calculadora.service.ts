/**
 * Persistência da Calculadora — salva como orçamento e, opcionalmente,
 * adiciona como item a um pedido novo/existente.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CalcInput, CalcResult } from "@/lib/calculadora/types";
import type { Orcamento, Pedido } from "@/types/erp";

function buildItemDescricao(input: CalcInput, result: CalcResult): string {
  const moldura = input.molduras
    .map((m) => m.produto.codigo ?? m.produto.nome)
    .join(" + ");
  const tam = `${result.largura_final_cm}×${result.altura_final_cm}cm (arte ${result.largura_interna_cm}×${result.altura_interna_cm})`;
  return [moldura || "Quadro personalizado", tam].filter(Boolean).join(" — ");
}

function buildMetadados(input: CalcInput, result: CalcResult) {
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

export const calculadoraService = {
  /** Salva como orçamento (rascunho) sem cliente. */
  async salvarOrcamento(input: CalcInput, result: CalcResult): Promise<Orcamento> {
    const { data: orc, error } = await supabase
      .from("orcamentos")
      .insert({
        status: "rascunho",
        valor_total: result.total_venda,
        observacoes: input.observacoes ?? null,
        metadados: buildMetadados(input, result),
      } as any)
      .select("*")
      .single();
    if (error) throw error;

    const { error: itErr } = await supabase.from("orcamento_itens").insert({
      orcamento_id: orc.id,
      descricao: buildItemDescricao(input, result),
      quantidade: result.quantidade,
      largura_cm: result.largura_final_cm,
      altura_cm: result.altura_final_cm,
      valor_unitario: result.total_venda / Math.max(1, result.quantidade),
      valor_total: result.total_venda,
      metadados: buildMetadados(input, result),
    } as any);
    if (itErr) throw itErr;

    return orc as Orcamento;
  },

  /** Adiciona um item calculado a um pedido existente. */
  async adicionarAPedidoExistente(
    pedidoId: string,
    input: CalcInput,
    result: CalcResult,
  ): Promise<Pedido> {
    const { error: itErr } = await supabase.from("pedido_itens").insert({
      pedido_id: pedidoId,
      descricao: buildItemDescricao(input, result),
      quantidade: result.quantidade,
      largura_cm: result.largura_final_cm,
      altura_cm: result.altura_final_cm,
      valor_unitario: result.total_venda / Math.max(1, result.quantidade),
      valor_total: result.total_venda,
      metadados: buildMetadados(input, result),
    } as any);
    if (itErr) throw itErr;

    // recalcula total do pedido
    const { data: itens } = await supabase
      .from("pedido_itens")
      .select("valor_total")
      .eq("pedido_id", pedidoId);
    const total = (itens ?? []).reduce((s, i) => s + Number(i.valor_total), 0);

    const { data: ped, error: upErr } = await supabase
      .from("pedidos")
      .update({ valor_total: total })
      .eq("id", pedidoId)
      .select("*")
      .single();
    if (upErr) throw upErr;
    return ped as Pedido;
  },

  /** Cria um pedido novo com o item calculado. */
  async criarPedidoNovo(
    input: CalcInput,
    result: CalcResult,
    opts?: { cliente_id?: string | null; observacoes?: string | null },
  ): Promise<Pedido> {
    const { data: ped, error } = await supabase
      .from("pedidos")
      .insert({
        cliente_id: opts?.cliente_id ?? null,
        status: "aguardando_producao",
        valor_total: result.total_venda,
        observacoes: opts?.observacoes ?? input.observacoes ?? null,
        metadados: buildMetadados(input, result),
      } as any)
      .select("*")
      .single();
    if (error) throw error;

    const { error: itErr } = await supabase.from("pedido_itens").insert({
      pedido_id: ped.id,
      descricao: buildItemDescricao(input, result),
      quantidade: result.quantidade,
      largura_cm: result.largura_final_cm,
      altura_cm: result.altura_final_cm,
      valor_unitario: result.total_venda / Math.max(1, result.quantidade),
      valor_total: result.total_venda,
      metadados: buildMetadados(input, result),
    } as any);
    if (itErr) throw itErr;

    return ped as Pedido;
  },
};
