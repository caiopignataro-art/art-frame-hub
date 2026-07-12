import type { StockConsumptionInput, StockConsumptionResult } from "../types";

/**
 * Interface comum para todas as estratégias de otimização de corte do Stock Engine.
 */
export interface CuttingStrategy {
  /**
   * Executa a lógica de simulação/reserva do corte do material.
   */
  calculate(input: StockConsumptionInput): StockConsumptionResult;
}
