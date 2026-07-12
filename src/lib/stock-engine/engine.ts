import { BarrasStrategy } from "./strategies/barras-strategy";
import { GuillotineStrategy } from "./strategies/guillotine-strategy";
import { BobinasStrategy } from "./strategies/bobinas-strategy";
import { PadraoStrategy } from "./strategies/padrao-strategy";
import type { CuttingStrategy } from "./strategies/strategy-interface";
import type { StockConsumptionInput, StockConsumptionResult } from "./types";

/**
 * StockEngine é a camada de domínio responsável por interpretar o consumo
 * de estoque baseado em diferentes formas de armazenamento.
 * Utiliza o Strategy Pattern para delegar o cálculo de aproveitamento para o algoritmo correto.
 */
export class StockEngine {
  private static strategies: Record<string, CuttingStrategy> = {
    barras_default: new BarrasStrategy(),
    guillotine: new GuillotineStrategy(),
    bobinas_default: new BobinasStrategy(),
    padrao: new PadraoStrategy(),
  };

  /**
   * Resolve qual estratégia de corte executar baseando-se no mapeamento configurado.
   * Por padrão, mapeia dinamicamente de acordo com a forma de estoque do item.
   */
  public static getStrategy(strategyKey: string): CuttingStrategy {
    return this.strategies[strategyKey] || this.strategies.padrao;
  }

  /**
   * Interpreta o consumo geral de um produto baseado nos parâmetros informados.
   */
  public static interpretConsumption(
    input: StockConsumptionInput,
    algorithmKey?: string
  ): StockConsumptionResult {
    // Escolhe a chave da estratégia configurada ou cai no mapeamento padrão da forma de estoque
    const key = algorithmKey || this.getDefaultStrategyKeyForForm(input.formaEstoque);
    const strategy = this.getStrategy(key);
    return strategy.calculate(input);
  }

  /**
   * Retorna a estratégia padrão para cada forma de estoque caso nenhuma específica esteja definida.
   */
  private static getDefaultStrategyKeyForForm(formaEstoque: string): string {
    switch (formaEstoque) {
      case "barras":
        return "barras_default";
      case "chapas":
        return "guillotine";
      case "bobinas":
        return "bobinas_default";
      default:
        return "padrao";
    }
  }
}
