import { supabase } from "@/integrations/supabase/client";
import type { ProdutoCategoriaImportacao } from "@/types/erp";
import type { ProdutoImportRow, ImportIssue } from "@/lib/importacao/parsers";

export type ImportacaoRegistro = {
  id: string;
  categoria: ProdutoCategoriaImportacao;
  arquivo_nome: string;
  total_linhas: number;
  inseridos: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  erros_detalhe: ImportIssue[];
  status: string;
  usuario: string | null;
  created_at: string;
};

export type CommitResult = {
  inseridos: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  erros_detalhe: ImportIssue[];
  importacao_id: string;
};

export const importacoesService = {
  /** Faz upsert dos produtos e registra a importação. */
  async commit(params: {
    categoria: ProdutoCategoriaImportacao;
    arquivo_nome: string;
    rows: ProdutoImportRow[];
    issues: ImportIssue[];
  }): Promise<CommitResult> {
    const { categoria, arquivo_nome, rows, issues } = params;
    const codigosNovos = rows.map((r) => r.codigo);

    // descobrir quais já existem para diferenciar inserts vs updates
    const { data: existentes, error: errSel } = await supabase
      .from("produtos")
      .select("codigo")
      .in("codigo", codigosNovos.length ? codigosNovos : ["__none__"]);
    if (errSel) throw errSel;
    const setExistentes = new Set((existentes ?? []).map((p) => p.codigo).filter(Boolean) as string[]);

    const insertedExpected = rows.filter((r) => !setExistentes.has(r.codigo)).length;
    const updatedExpected = rows.length - insertedExpected;

    const errosRuntime: ImportIssue[] = [];
    if (rows.length > 0) {
      const { error: errUp } = await supabase
        .from("produtos")
        .upsert(rows, { onConflict: "codigo", ignoreDuplicates: false });
      if (errUp) {
        errosRuntime.push({ linha: 0, mensagem: `Falha no upsert: ${errUp.message}`, severidade: "erro" });
      }
    }

    const errosTotais = issues.filter((i) => i.severidade === "erro").length + errosRuntime.length;
    const status = errosRuntime.length > 0 ? "falha" : errosTotais > 0 ? "parcial" : "concluido";

    const { data: registro, error: errIns } = await supabase
      .from("importacoes")
      .insert({
        categoria,
        arquivo_nome,
        total_linhas: rows.length + issues.filter((i) => i.severidade === "erro").length,
        inseridos: errosRuntime.length ? 0 : insertedExpected,
        atualizados: errosRuntime.length ? 0 : updatedExpected,
        ignorados: issues.filter((i) => i.severidade === "erro").length,
        erros: errosTotais,
        erros_detalhe: [...issues, ...errosRuntime] as unknown as never,
        status,
      })
      .select("*")
      .single();
    if (errIns) throw errIns;

    return {
      inseridos: registro.inseridos,
      atualizados: registro.atualizados,
      ignorados: registro.ignorados,
      erros: registro.erros,
      erros_detalhe: (registro.erros_detalhe as unknown as ImportIssue[]) ?? [],
      importacao_id: registro.id,
    };
  },

  async list(limit = 50): Promise<ImportacaoRegistro[]> {
    const { data, error } = await supabase
      .from("importacoes")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as ImportacaoRegistro[];
  },
};
