import type { ImportIssue, ProdutoImportRow } from "@/lib/importacao/parsers";
import type { ProdutoCategoriaImportacao } from "@/types/erp";

export interface ImportacaoRegistro {
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
}

export interface CommitResult {
  inseridos: number;
  atualizados: number;
  ignorados: number;
  erros: number;
  erros_detalhe: ImportIssue[];
  importacao_id: string;
}

export interface ImportacoesRepository {
  commit(params: {
    categoria: ProdutoCategoriaImportacao;
    arquivo_nome: string;
    rows: ProdutoImportRow[];
    issues: ImportIssue[];
  }): Promise<CommitResult>;
  list(limit?: number): Promise<ImportacaoRegistro[]>;
}
