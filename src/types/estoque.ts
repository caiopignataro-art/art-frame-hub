/**
 * Tipos do módulo de Estoque Inteligente.
 */
import type { Tables, TablesInsert, Enums } from "@/integrations/supabase/types";

export type ConfiguracaoSistema = Tables<"configuracoes_sistema">;
export type EstoqueMovimentacao = Tables<"estoque_movimentacoes">;
export type Retalho = Tables<"retalhos">;
export type ReservaEstoque = Tables<"reservas_estoque">;
export type OrdemProducao = Tables<"ordens_producao">;
export type FabricanteEstoqueMinimo = Tables<"fabricante_estoque_minimo">;

export type EstoqueMovimentoTipo = Enums<"estoque_movimento_tipo">;
export type ReservaStatus = Enums<"reserva_status">;
export type RetalhoStatus = Enums<"retalho_status">;
export type OrdemProducaoStatus = Enums<"ordem_producao_status">;

export type ConfiguracaoSistemaInsert = TablesInsert<"configuracoes_sistema">;
export type OrdemProducaoInsert = TablesInsert<"ordens_producao">;

export const ESTOQUE_MOV_LABEL: Record<EstoqueMovimentoTipo, string> = {
  entrada: "Entrada",
  ajuste: "Ajuste",
  reserva: "Reserva",
  estorno_reserva: "Estorno de reserva",
  consumo: "Consumo",
  estorno_consumo: "Estorno de consumo",
  uso_retalho: "Uso de retalho",
  geracao_retalho: "Geração de retalho",
  descarte_retalho: "Descarte de retalho",
};

export const RETALHO_STATUS_LABEL: Record<RetalhoStatus, string> = {
  disponivel: "Disponível",
  usado: "Usado",
  descartado: "Descartado",
};

export const RESERVA_STATUS_LABEL: Record<ReservaStatus, string> = {
  ativa: "Ativa",
  consumida: "Consumida",
  estornada: "Estornada",
};

export const OP_STATUS_LABEL: Record<OrdemProducaoStatus, string> = {
  aberta: "Aberta",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

/** Chaves de configuração reconhecidas. */
export const CONFIG_KEYS = {
  comprimento_barra_cm: "estoque.comprimento_barra_cm",
  perda_corte_percentual: "estoque.perda_corte_percentual",
  estoque_minimo_default: "estoque.estoque_minimo_barras_default",
} as const;
