import type {
  Orcamento,
  OrcamentoComItens,
  OrcamentoInsert,
  OrcamentoItem,
  OrcamentoItemInsert,
  OrcamentoStatus,
  OrcamentoUpdate,
} from "@/types/erp";

export interface OrcamentosRepository {
  list(): Promise<(Orcamento & { cliente: { nome: string } | null })[]>;
  getById(id: string): Promise<OrcamentoComItens | null>;
  create(input: OrcamentoInsert): Promise<Orcamento>;
  update(id: string, patch: OrcamentoUpdate): Promise<Orcamento>;
  setStatus(id: string, status: OrcamentoStatus): Promise<Orcamento>;
  remove(id: string): Promise<void>;
  addItem(item: OrcamentoItemInsert): Promise<OrcamentoItem>;
  removeItem(itemId: string): Promise<void>;
}
