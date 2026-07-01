import { supabase } from "@/integrations/supabase/client";
import type { Produto, ProdutoInsert, ProdutoUpdate, ProdutoTipo } from "@/types/erp";

export interface EssencialAlerta {
  produto: Produto;
  estoque_real: number;
  estoque_minimo: number;
}

export type BulkScope =
  | { kind: "todos" }
  | { kind: "categoria"; tipo: ProdutoTipo }
  | { kind: "fabricante"; fabricante: string }
  | { kind: "ids"; ids: string[] };

export type BulkMode =
  | { kind: "percentual"; percent: number }      // e.g. 10 => +10%, -5 => -5%
  | { kind: "multiplicador"; fator: number }     // e.g. 1.25
  | { kind: "fixo"; preco: number };             // novo preço fixo

export interface BulkPreviewRow {
  id: string;
  codigo: string | null;
  nome: string;
  preco_atual: number;
  preco_novo: number;
  delta_pct: number;
}

function applyMode(precoAtual: number, mode: BulkMode): number {
  let novo = precoAtual;
  if (mode.kind === "percentual") novo = precoAtual * (1 + mode.percent / 100);
  else if (mode.kind === "multiplicador") novo = precoAtual * mode.fator;
  else if (mode.kind === "fixo") novo = mode.preco;
  return Math.max(0, Math.round(novo * 100) / 100);
}

async function fetchScope(scope: BulkScope): Promise<Produto[]> {
  let q = supabase.from("produtos").select("*").order("nome");
  if (scope.kind === "categoria") q = q.eq("tipo", scope.tipo);
  else if (scope.kind === "fabricante") q = q.eq("fabricante", scope.fabricante);
  else if (scope.kind === "ids") q = q.in("id", scope.ids);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export const produtosService = {
  async list(opts?: { tipo?: ProdutoTipo; ativo?: boolean }): Promise<Produto[]> {
    let q = supabase.from("produtos").select("*").order("nome");
    if (opts?.tipo) q = q.eq("tipo", opts.tipo);
    if (opts?.ativo !== undefined) q = q.eq("ativo", opts.ativo);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async get(id: string): Promise<Produto | null> {
    const { data, error } = await supabase.from("produtos").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async proximoCodigo(): Promise<string> {
    const { data, error } = await supabase.rpc("proximo_codigo_produto");
    if (error) throw error;
    return String(data ?? "0001");
  },

  async create(input: ProdutoInsert): Promise<Produto> {
    const payload: ProdutoInsert = { ...input };
    if (!payload.codigo) {
      payload.codigo = await this.proximoCodigo();
    }
    const { data, error } = await supabase.from("produtos").insert(payload).select("*").single();
    if (error) throw error;
    return data;
  },

  async listAlertasEssenciais(): Promise<EssencialAlerta[]> {
    const tipos: ProdutoTipo[] = ["protecao_frontal", "fundo", "impressao", "chassi"];
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .in("tipo", tipos)
      .eq("ativo", true);
    if (error) throw error;
    return (data ?? [])
      .filter((p) => Number(p.estoque_minimo ?? 0) > 0 && Number(p.estoque) <= Number(p.estoque_minimo))
      .map((p) => ({
        produto: p,
        estoque_real: Number(p.estoque),
        estoque_minimo: Number(p.estoque_minimo ?? 0),
      }));
  },


  async update(id: string, patch: ProdutoUpdate): Promise<Produto> {
    // Nunca permitir alteração de código (chave única do produto)
    const { codigo: _omit, ...safe } = patch as ProdutoUpdate & { codigo?: unknown };
    const { data, error } = await supabase
      .from("produtos")
      .update(safe)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) throw error;
  },

  // ---------- Atualização em massa ----------
  async bulkPreview(scope: BulkScope, mode: BulkMode): Promise<BulkPreviewRow[]> {
    const produtos = await fetchScope(scope);
    return produtos.map((p) => {
      const atual = Number(p.preco_venda);
      const novo = applyMode(atual, mode);
      const delta = atual > 0 ? ((novo - atual) / atual) * 100 : 0;
      return {
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        preco_atual: atual,
        preco_novo: novo,
        delta_pct: delta,
      };
    });
  },

  async bulkApply(
    scope: BulkScope,
    mode: BulkMode,
  ): Promise<{ afetados: number; impactoVenda: number }> {
    const preview = await this.bulkPreview(scope, mode);
    let impacto = 0;
    // Update um a um para que o trigger de auditoria registre antes/depois por produto.
    for (const row of preview) {
      if (row.preco_novo === row.preco_atual) continue;
      const { error } = await supabase
        .from("produtos")
        .update({ preco_venda: row.preco_novo })
        .eq("id", row.id);
      if (error) throw error;
      impacto += row.preco_novo - row.preco_atual;
    }

    // Log consolidado da operação em massa
    const descricao =
      mode.kind === "percentual"
        ? `Atualização em massa de preço: ${mode.percent >= 0 ? "+" : ""}${mode.percent}%`
        : mode.kind === "multiplicador"
          ? `Atualização em massa de preço: multiplicador ${mode.fator}`
          : `Atualização em massa de preço: valor fixo ${mode.preco}`;

    await supabase.from("historico").insert({
      entidade: "produtos_bulk",
      entidade_id: preview[0]?.id ?? crypto.randomUUID(),
      acao: "atualizado",
      descricao: `${descricao} • ${preview.length} produto(s)`,
      dados_depois: JSON.parse(JSON.stringify({
        scope,
        mode,
        afetados: preview.length,
        impacto_venda: impacto,
        itens: preview.slice(0, 50),
      })),
    });

    return { afetados: preview.filter((r) => r.preco_novo !== r.preco_atual).length, impactoVenda: impacto };
  },
};
