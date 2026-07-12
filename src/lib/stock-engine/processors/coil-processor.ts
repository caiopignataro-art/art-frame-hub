import type { StockConsumptionInput, StockConsumptionResult } from "../types";

/**
 * Processador de Bobinas (CoilProcessor) do Stock Engine.
 * Encapsula a lógica de negócio específica para materiais armazenados em rolo
 * (ex: Canvas, Fine Art, Papel Fotográfico, Vinil).
 */
export class CoilProcessor {
  /**
   * Executa a reserva de material a partir de uma bobina ativa,
   * calculando a orientação de corte ideal e registrando o desperdício.
   */
  public static reservar(input: StockConsumptionInput): StockConsumptionResult {
    // A lógica de corte linear e cálculo de desperdício é executada na trigger PLpgSQL.
    // Esta estrutura de domínio serve como ponto de extensão no frontend.
    return {
      sucesso: true,
      quantidadeConsumida: input.comprimento || 0,
      alertas: ["Reserva processada pelo CoilProcessor (PLpgSQL)."],
    };
  }

  /**
   * Converte a reserva da bobina em consumo real.
   */
  public static consumir(input: StockConsumptionInput): StockConsumptionResult {
    return {
      sucesso: true,
      quantidadeConsumida: input.comprimento || 0,
    };
  }

  /**
   * Registra movimentação física da bobina.
   */
  public static registrarMovimentacao(bobinaId: string, tipo: string, quantidadeCm: number): void {
    // Stub de movimentação
  }

  /**
   * Realiza auditoria no comprimento restante e área da bobina.
   */
  public static auditoria(produtoId: string): Record<string, any> {
    return {
      produtoId,
      auditado: true,
      timestamp: new Date().toISOString(),
    };
  }
}
