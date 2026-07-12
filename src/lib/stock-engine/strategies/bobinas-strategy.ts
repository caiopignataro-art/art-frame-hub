import type { CuttingStrategy } from "./strategy-interface";
import type { StockConsumptionInput, StockConsumptionResult } from "../types";
import { CoilProcessor } from "../processors/coil-processor";

/**
 * Estratégia de corte para produtos armazenados em bobinas de rolo.
 */
export class BobinasStrategy implements CuttingStrategy {
  calculate(input: StockConsumptionInput): StockConsumptionResult {
    return CoilProcessor.reservar(input);
  }
}
