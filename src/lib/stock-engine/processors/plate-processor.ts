import type { StockConsumptionInput, StockConsumptionResult } from "../types";

/**
 * Processador de Chapas (PlateProcessor) do Stock Engine.
 * Encapsula a lógica de negócio específica para itens estocados em chapas planas
 * (ex: Passe-partout, Vidro/Proteção, MDF/Fundo).
 */
export class PlateProcessor {
  /**
   * Executa a reserva de chapa ou retalho de chapa, calculando a sobra
   * e gerando novos retalhos se aplicável.
   */
  public static reservar(input: StockConsumptionInput): StockConsumptionResult {
    // A lógica de corte bidimensional 2D e reserva roda na trigger PLpgSQL.
    // Esta estrutura de domínio serve de ponto de extensão no frontend.
    return {
      sucesso: true,
      quantidadeConsumida: input.quantidade,
      alertas: ["Reserva processada pelo PlateProcessor (PLpgSQL)."],
    };
  }

  /**
   * Converte a reserva de chapa em consumo efetivo.
   */
  public static consumir(input: StockConsumptionInput): StockConsumptionResult {
    return {
      sucesso: true,
      quantidadeConsumida: input.quantidade,
    };
  }

  /**
   * Registra a geração de um retalho de chapa a partir de sobra de corte.
   */
  public static gerarRetalho(chapaOrigemId: string, largura: number, altura: number): void {
    // Stub de geração de retalho 2D
  }

  /**
   * Marca um retalho como utilizado.
   */
  public static usarRetalho(retalhoChapaId: string): void {
    // Stub de uso de retalho 2D
  }

  /**
   * Descarte manual de chapa ou retalho por dano ou obsolescência.
   */
  public static descartar(id: string, tipo: "chapa" | "retalho", motivo: string): void {
    // Stub de descarte
  }

  /**
   * Auditoria de chapas disponíveis no estoque físico.
   */
  public static auditoria(produtoId: string): Record<string, any> {
    return {
      produtoId,
      auditado: true,
      timestamp: new Date().toISOString(),
    };
  }
}
