/**
 * Serviço do módulo de Estoque Inteligente.
 *
 * Toda a regra crítica (reserva, consumo, estorno, retalhos)
 * vive em funções/triggers PL/pgSQL na migration. Aqui ficam
 * apenas as leituras agregadas, ajustes manuais e operações
 * idempotentes invocáveis pela UI.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  EstoqueMovimentacao,
  OrdemProducao,
  Retalho,
  ReservaEstoque,
  FabricanteEstoqueMinimo,
} from "@/types/estoque";
import type { Produto } from "@/types/erp";

export interface PerfilEstoque {
  produto: Produto;
  barras: number;
  comprimento_barra_cm: number;
  total_cm_barras: number;
  retalhos_cm: number;
  saldo_total_cm: number;
  reservado_cm: number;
  disponivel_cm: number;
  estoque_minimo_barras: number;
  abaixo_minimo: boolean;
}

export interface EstoqueResumo {
  total_barras: number;
  total_retalhos: number;
  perfis_baixo_estoque: number;
  valor_estoque: number;
  valor_retalhos: number;
  consumo_mes_cm: number;
}

async function getComprimentoBarra(): Promise<number> {
  const { data } = await supabase
    .from("configuracoes_sistema")
    .select("valor")
    .eq("chave", "estoque.comprimento_barra_cm")
    .maybeSingle();
  const v = data?.valor as unknown;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 270;
}

export const estoqueService = {
  /** Lista perfis de moldura com snapshot de estoque calculado. */
  async listarPerfis(): Promise<PerfilEstoque[]> {
    const compBarra = await getComprimentoBarra();
    const { data: produtos, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("tipo", "perfil_moldura")
      .order("codigo");
    if (error) throw error;

    const { data: retalhos } = await supabase
      .from("retalhos")
      .select("produto_id, comprimento_cm")
      .eq("status", "disponivel");

    const { data: reservas } = await supabase
      .from("reservas_estoque")
      .select("produto_id, comprimento_cm")
      .eq("status", "ativa");

    const retalhosMap = new Map<string, number>();
    for (const r of retalhos ?? []) {
      retalhosMap.set(r.produto_id, (retalhosMap.get(r.produto_id) ?? 0) + Number(r.comprimento_cm));
    }
    const reservasMap = new Map<string, number>();
    for (const r of reservas ?? []) {
      reservasMap.set(r.produto_id, (reservasMap.get(r.produto_id) ?? 0) + Number(r.comprimento_cm));
    }

    return (produtos ?? []).map((p) => {
      const barras = Number(p.quantidade ?? 0);
      const totalBarrasCm = barras * compBarra;
      const retalhosCm = retalhosMap.get(p.id) ?? 0;
      const saldo = totalBarrasCm + retalhosCm;
      const reservado = reservasMap.get(p.id) ?? 0;
      const minBarras = Number((p as { estoque_minimo_barras?: number }).estoque_minimo_barras ?? 0);
      return {
        produto: p as Produto,
        barras,
        comprimento_barra_cm: compBarra,
        total_cm_barras: totalBarrasCm,
        retalhos_cm: retalhosCm,
        saldo_total_cm: saldo,
        reservado_cm: reservado,
        disponivel_cm: saldo - reservado,
        estoque_minimo_barras: minBarras,
        abaixo_minimo: barras < minBarras,
      };
    });
  },

  async resumo(): Promise<EstoqueResumo> {
    const perfis = await this.listarPerfis();
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const { data: movs } = await supabase
      .from("estoque_movimentacoes")
      .select("quantidade_cm, tipo")
      .gte("created_at", inicioMes.toISOString())
      .in("tipo", ["consumo", "uso_retalho"]);

    const consumoMes = (movs ?? []).reduce((s, m) => s + Number(m.quantidade_cm), 0);

    return {
      total_barras: perfis.reduce((s, p) => s + p.barras, 0),
      total_retalhos: perfis.reduce((s, p) => s + p.retalhos_cm, 0),
      perfis_baixo_estoque: perfis.filter((p) => p.abaixo_minimo).length,
      valor_estoque: perfis.reduce(
        (s, p) => s + p.barras * Number(p.produto.preco_custo ?? 0),
        0,
      ),
      valor_retalhos: perfis.reduce(
        (s, p) =>
          s +
          (p.retalhos_cm / Math.max(1, p.comprimento_barra_cm)) *
            Number(p.produto.preco_custo ?? 0),
        0,
      ),
      consumo_mes_cm: consumoMes,
    };
  },

  async listarRetalhos(filtroProdutoId?: string): Promise<Retalho[]> {
    let q = supabase.from("retalhos").select("*").order("created_at", { ascending: false });
    if (filtroProdutoId) q = q.eq("produto_id", filtroProdutoId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async listarMovimentacoes(produtoId?: string, limit = 100): Promise<EstoqueMovimentacao[]> {
    let q = supabase
      .from("estoque_movimentacoes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (produtoId) q = q.eq("produto_id", produtoId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async listarReservas(pedidoId?: string): Promise<ReservaEstoque[]> {
    let q = supabase.from("reservas_estoque").select("*").order("created_at", { ascending: false });
    if (pedidoId) q = q.eq("pedido_id", pedidoId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async listarOrdensProducao(): Promise<OrdemProducao[]> {
    const { data, error } = await supabase
      .from("ordens_producao")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  },

  /** Ajuste manual de estoque (entrada/baixa). */
  async ajustarEstoque(produtoId: string, deltaBarras: number, observacao?: string) {
    const { data: prod, error: eP } = await supabase
      .from("produtos")
      .select("id, quantidade")
      .eq("id", produtoId)
      .single();
    if (eP) throw eP;
    const compBarra = await getComprimentoBarra();
    const novaQtd = Math.max(0, Number(prod.quantidade ?? 0) + deltaBarras);
    const saldoAntes = Number(prod.quantidade ?? 0) * compBarra;
    const saldoDepois = novaQtd * compBarra;

    const { error: upErr } = await supabase
      .from("produtos")
      .update({ quantidade: novaQtd })
      .eq("id", produtoId);
    if (upErr) throw upErr;

    const { error: mvErr } = await supabase.from("estoque_movimentacoes").insert({
      produto_id: produtoId,
      tipo: deltaBarras >= 0 ? "entrada" : "ajuste",
      quantidade_cm: Math.abs(deltaBarras) * compBarra,
      quantidade_barras: Math.abs(deltaBarras),
      saldo_anterior_cm: saldoAntes,
      saldo_posterior_cm: saldoDepois,
      observacao: observacao ?? (deltaBarras >= 0 ? "Entrada manual" : "Baixa manual"),
    });
    if (mvErr) throw mvErr;
  },

  async descartarRetalho(retalhoId: string) {
    const { error } = await supabase
      .from("retalhos")
      .update({ status: "descartado" })
      .eq("id", retalhoId);
    if (error) throw error;
  },

  async listarFabricanteMinimos(): Promise<FabricanteEstoqueMinimo[]> {
    const { data, error } = await supabase
      .from("fabricante_estoque_minimo")
      .select("*")
      .order("fabricante");
    if (error) throw error;
    return data ?? [];
  },

  async setMinimoProduto(produtoId: string, minBarras: number) {
    const { error } = await supabase
      .from("produtos")
      .update({ estoque_minimo_barras: minBarras } as never)
      .eq("id", produtoId);
    if (error) throw error;
  },

  async setMinimoFabricante(fabricante: string, minBarras: number) {
    const { error } = await supabase
      .from("fabricante_estoque_minimo")
      .upsert(
        { fabricante, estoque_minimo_barras: minBarras },
        { onConflict: "fabricante" },
      );
    if (error) throw error;
  },
};
