import type { ConfiguracaoSistema } from "@/types/estoque";

export interface ConfiguracoesRepository {
  list(): Promise<ConfiguracaoSistema[]>;
  getNumber(chave: string, fallback: number): Promise<number>;
  setNumber(chave: string, valor: number, descricao?: string): Promise<void>;
}
