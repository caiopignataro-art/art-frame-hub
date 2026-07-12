import type { CuttingStrategy } from "./strategy-interface";
import type { StockConsumptionInput, StockConsumptionResult } from "../types";
import { PlateProcessor } from "../processors/plate-processor";

/**
 * Estratégia de corte Guillotine para produtos armazenados em chapas planas.
 */
export class GuillotineStrategy implements CuttingStrategy {
  calculate(input: StockConsumptionInput): StockConsumptionResult {
    return PlateProcessor.reservar(input);
  }
}
