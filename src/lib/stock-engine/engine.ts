import { BarProcessor } from "./processors/bar-processor";
import { CoilProcessor } from "./processors/coil-processor";
import { PlateProcessor } from "./processors/plate-processor";
import type { StockConsumptionInput, StockConsumptionResult } from "./types";

/**
 * StockEngine é a camada de domínio responsável por interpretar o consumo
 * de estoque baseado em diferentes formas de armazenamento (Barras, Chapas, etc.).
 * 
 * No momento, a classe implementa apenas a estrutura e as assinaturas de método,
 * sem executar lógica ativa de cálculo de corte/desperdício/aproveitamento.
 */
export class StockEngine {
  /**
   * Interpreta o consumo geral de um produto baseado nos parâmetros informados.
   */
  public static interpretConsumption(input: StockConsumptionInput): StockConsumptionResult {
    switch (input.formaEstoque) {
      case "barras":
        return this.calculateBarras(input);
      case "chapas":
        return this.calculateChapas(input);
      case "bobinas":
        return this.calculateBobinas(input);
      case "metro_linear":
        return this.calculateMetroLinear(input);
      case "area":
        return this.calculateArea(input);
      case "unidade":
      default:
        return this.calculateUnidade(input);
    }
  }

  /**
   * Cálculo específico para produtos estocados em Barras (ex: Perfil de Moldura).
   * Delega para o BarProcessor.
   */
  private static calculateBarras(input: StockConsumptionInput): StockConsumptionResult {
    return BarProcessor.reservar(input);
  }

  /**
   * Cálculo específico para produtos estocados em Chapas (ex: Vidro, Fundo).
   * Delega para o PlateProcessor.
   */
  private static calculateChapas(input: StockConsumptionInput): StockConsumptionResult {
    return PlateProcessor.reservar(input);
  }

  /**
   * Cálculo específico para produtos estocados em Bobinas (ex: Papel de Impressão).
   * Delega para o CoilProcessor.
   */
  private static calculateBobinas(input: StockConsumptionInput): StockConsumptionResult {
    return CoilProcessor.reservar(input);
  }

  /**
   * Cálculo específico para Metro Linear.
   */
  private static calculateMetroLinear(input: StockConsumptionInput): StockConsumptionResult {
    return {
      sucesso: true,
      quantidadeConsumida: input.quantidade,
    };
  }

  /**
   * Cálculo específico para Área (m²).
   */
  private static calculateArea(input: StockConsumptionInput): StockConsumptionResult {
    return {
      sucesso: true,
      quantidadeConsumida: input.quantidade,
    };
  }

  /**
   * Cálculo específico para Unidades.
   */
  private static calculateUnidade(input: StockConsumptionInput): StockConsumptionResult {
    return {
      sucesso: true,
      quantidadeConsumida: input.quantidade,
    };
  }
}
