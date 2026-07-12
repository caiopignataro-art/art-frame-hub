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
   * Futuramente interpretará barras inteiras, sobras e otimização de cortes.
   */
  private static calculateBarras(input: StockConsumptionInput): StockConsumptionResult {
    return {
      sucesso: true,
      quantidadeConsumida: input.quantidade,
      alertas: ["Lógica de otimização de barras (Stock Engine) não ativa."],
    };
  }

  /**
   * Cálculo específico para produtos estocados em Chapas (ex: Vidro, Fundo).
   * Futuramente interpretará layouts de corte bidimensional.
   */
  private static calculateChapas(input: StockConsumptionInput): StockConsumptionResult {
    return {
      sucesso: true,
      quantidadeConsumida: input.quantidade,
      alertas: ["Lógica de corte bidimensional de chapas (Stock Engine) não ativa."],
    };
  }

  /**
   * Cálculo específico para produtos estocados em Bobinas (ex: Papel de Impressão).
   * Futuramente interpretará o consumo linear em largura fixa de bobina.
   */
  private static calculateBobinas(input: StockConsumptionInput): StockConsumptionResult {
    return {
      sucesso: true,
      quantidadeConsumida: input.quantidade,
      alertas: ["Lógica de aproveitamento de bobinas (Stock Engine) não ativa."],
    };
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
