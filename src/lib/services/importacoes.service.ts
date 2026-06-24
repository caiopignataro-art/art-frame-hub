import { supabase } from "@/integrations/supabase/client";
import type { ProdutoCategoriaImportacao } from "@/types/erp";
import type { ProdutoImportRow, ImportIssue } from "@/lib/importacao/parsers";

export type ImportacaoModo = "completo" | "estoque";

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
  modo: ImportacaoModo;
  inseridos: number;
  atualizados: number;
  ignorados: number;
  nao_encontrados: number;
  somente_estoque: number;
  erros: number;
  erros_detalhe: ImportIssue[];
  importacao_id: string;
};

export const importacoesService = {
  /**
   * Faz upsert/atualização dos produtos e registra a importação.
   * - modo="completo": upsert padrão (insere novos, atualiza todos os campos dos existentes).
   * - modo="estoque" : APENAS atualiza o campo `estoque` dos códigos já existentes.
   *                    Códigos não cadastrados são ignorados (contabilizados como "não encontrados").
   *                    Campos cadastrais (descrição, preços, etc.) NÃO são alterados.
   */
  async commit(params: {
    categoria: ProdutoCategoriaImportacao;
    arquivo_nome: string;
    rows: ProdutoImportRow[];
    issues: ImportIssue[];
    modo?: ImportacaoModo;
  }): Promise<CommitResult> {
    const { categoria, arquivo_nome, rows, issues } = params;
    const modo: ImportacaoModo = params.modo ?? "estoque";
    const codigos = rows.map((r) => r.codigo);

    const { data: existentes, error: errSel } = await supabase
      .from("produtos")
      .select("id, codigo, estoque")
      .in("codigo", codigos.length ? codigos : ["__none__"]);
    if (errSel) throw errSel;
    const mapExistentes = new Map(
      (existentes ?? []).filter((p) => p.codigo).map((p) => [p.codigo as string, p]),
    );

    const errosRuntime: ImportIssue[] = [];
    let inseridos = 0;
    let atualizados = 0;
    let somenteEstoque = 0;
    let naoEncontrados = 0;

    if (rows.length > 0) {
      if (modo === "completo") {
        const insertedExpected = rows.filter((r) => !mapExistentes.has(r.codigo)).length;
        const updatedExpected = rows.length - insertedExpected;
        const { error: errUp } = await supabase
          .from("produtos")
          .upsert(rows, { onConflict: "codigo", ignoreDuplicates: false });
        if (errUp) {
          errosRuntime.push({ linha: 0, mensagem: `Falha no upsert: ${errUp.message}`, severidade: "erro" });
        } else {
          inseridos = insertedExpected;
          atualizados = updatedExpected;
        }
      } else {
        // modo = "estoque" — atualizar somente quantidade dos códigos existentes
        for (const r of rows) {
          const existente = mapExistentes.get(r.codigo);
          if (!existente) {
            naoEncontrados += 1;
            continue;
          }
          const { error: errUpd } = await supabase
            .from("produtos")
            .update({ estoque: r.estoque })
            .eq("id", existente.id);
          if (errUpd) {
            errosRuntime.push({
              linha: 0,
              campo: r.codigo,
              mensagem: `Falha ao atualizar estoque do código ${r.codigo}: ${errUpd.message}`,
              severidade: "erro",
            });
          } else {
            somenteEstoque += 1;
          }
        }
        atualizados = somenteEstoque;
      }
    }

    const ignorados = issues.filter((i) => i.severidade === "erro").length + naoEncontrados;
    const errosTotais = issues.filter((i) => i.severidade === "erro").length + errosRuntime.length;
    const status = errosRuntime.length > 0 ? "falha" : errosTotais > 0 ? "parcial" : "concluido";

    const infoIssue: ImportIssue = {
      linha: 0,
      mensagem:
        modo === "estoque"
          ? `Modo: Atualizar Apenas Estoque · ${somenteEstoque} registros tiveram apenas a quantidade atualizada · ${naoEncontrados} código(s) não encontrado(s)`
          : `Modo: Importação Completa · ${inseridos} novo(s), ${atualizados} atualizado(s)`,
      severidade: "aviso",
    };

    const arquivoLog = `[${modo === "estoque" ? "Estoque" : "Completo"}] ${arquivo_nome}`;

    const { data: registro, error: errIns } = await supabase
      .from("importacoes")
      .insert({
        categoria,
        arquivo_nome: arquivoLog,
        total_linhas: rows.length + issues.filter((i) => i.severidade === "erro").length,
        inseridos,
        atualizados,
        ignorados,
        erros: errosTotais,
        erros_detalhe: [infoIssue, ...issues, ...errosRuntime] as unknown as never,
        status,
      })
      .select("*")
      .single();
    if (errIns) throw errIns;

    return {
      modo,
      inseridos,
      atualizados,
      ignorados,
      nao_encontrados: naoEncontrados,
      somente_estoque: somenteEstoque,
      erros: errosTotais,
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
