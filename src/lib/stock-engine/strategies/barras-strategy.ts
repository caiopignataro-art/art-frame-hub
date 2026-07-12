import type { CuttingStrategy } from "./strategy-interface";
import type { StockConsumptionInput, StockConsumptionResult } from "../types";
import { BarProcessor } from "../processors/bar-processor";

/**
 * Estratégia de corte para produtos armazenados em barras lineares.
 */
export class BarrasStrategy implements CuttingStrategy {
  calculate(input: StockConsumptionInput): StockConsumptionResult {
    return BarProcessor.reservar(input);
  }
}
