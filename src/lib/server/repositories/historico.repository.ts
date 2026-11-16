import type { Historico } from "@/types/erp";

export interface HistoricoRepository {
  list(opts?: { entidade?: string; entidadeId?: string; limit?: number }): Promise<Historico[]>;
}
