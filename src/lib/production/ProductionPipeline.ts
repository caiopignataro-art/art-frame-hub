import { calcular } from "@/lib/calculadora/calculator";
import type { CalcInput, CalcResult } from "@/lib/calculadora/types";

class ProductionPipelineService {
  /**
   * Facade para processamento de produção.
   * Atualmente apenas encapsula a chamada para o calculator.ts legado,
   * preservando 100% do comportamento e cálculos originais.
   */
  public process(input: CalcInput): CalcResult {
    return calcular(input);
  }
}

export const ProductionPipeline = new ProductionPipelineService();
