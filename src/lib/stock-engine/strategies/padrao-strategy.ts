import type { CuttingStrategy } from "./strategy-interface";
import type { StockConsumptionInput, StockConsumptionResult } from "../types";

/**
 * Estratégia de consumo padrão para unidades discretas, m² genérico e metro linear simples.
 */
export class PadraoStrategy implements CuttingStrategy {
  calculate(input: StockConsumptionInput): StockConsumptionResult {
    return {
      sucesso: true,
      quantidadeConsumida: input.quantidade,
      alertas: ["Consumo direto processado (Estratégia Padrão)."],
    };
  }
}
