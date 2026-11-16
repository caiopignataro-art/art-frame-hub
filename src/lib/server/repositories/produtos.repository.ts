import type { Produto, ProdutoInsert, ProdutoTipo, ProdutoUpdate } from "@/types/erp";

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
  | { kind: "percentual"; percent: number }
  | { kind: "multiplicador"; fator: number }
  | { kind: "fixo"; preco: number };

export interface BulkPreviewRow {
  id: string;
  codigo: string | null;
  nome: string;
  preco_atual: number;
  preco_novo: number;
  delta_pct: number;
}

export interface ProdutosRepository {
  list(opts?: { tipo?: ProdutoTipo; ativo?: boolean }): Promise<Produto[]>;
  getById(id: string): Promise<Produto | null>;
  proximoCodigo(): Promise<string>;
  create(input: ProdutoInsert): Promise<Produto>;
  update(id: string, patch: ProdutoUpdate): Promise<Produto>;
  remove(id: string): Promise<void>;
  listAlertasEssenciais(): Promise<EssencialAlerta[]>;
  bulkPreview(scope: BulkScope, mode: BulkMode): Promise<BulkPreviewRow[]>;
  bulkApply(scope: BulkScope, mode: BulkMode): Promise<{ afetados: number; impactoVenda: number }>;
}
