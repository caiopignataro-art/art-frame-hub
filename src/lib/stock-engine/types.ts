import type { FormaEstoque } from "@/types/estoque";

/**
 * Parâmetros de entrada para o motor de interpretação de consumo de estoque.
 */
export interface StockConsumptionInput {
  produtoId: string;
  codigo?: string | null;
  formaEstoque: FormaEstoque;
  unidade: string;
  quantidade: number;
  largura?: number;
  altura?: number;
  comprimento?: number;
  area?: number;
  observacoes?: string;
  pedidoId?: string;
  pedidoItemId?: string;
}

/**
 * Resultado do cálculo/interpretação de consumo retornado pelo Stock Engine.
 */
export interface StockConsumptionResult {
  sucesso: boolean;
  quantidadeConsumida: number;
  retalhosGerados?: Array<{
    comprimentoCm: number;
    observacao?: string;
  }>;
  retalhosUtilizados?: Array<{
    retalhoId: string;
    comprimentoCm: number;
  }>;
  alertas?: string[];
  dadosDetalhados?: Record<string, any>;
}
