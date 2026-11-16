/**
 * Tipos do módulo de Estoque Inteligente.
 * Independentes de provedor de banco de dados (desacoplados do SDK Supabase).
 */
import type { JsonValue } from "./erp";

export type EstoqueMovimentoTipo =
  | "entrada"
  | "ajuste"
  | "reserva"
  | "estorno_reserva"
  | "consumo"
  | "estorno_consumo"
  | "uso_retalho"
  | "geracao_retalho"
  | "descarte_retalho";

export type ReservaStatus = "ativa" | "consumida" | "estornada";

export type RetalhoStatus = "disponivel" | "usado" | "descartado";

export type OrdemProducaoStatus = "aberta" | "concluida" | "arquivada" | "cancelada";

export interface ConfiguracaoSistema {
  id: string;
  chave: string;
  valor: JsonValue;
  descricao: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConfiguracaoSistemaInsert {
  id?: string;
  chave: string;
  valor: JsonValue;
  descricao?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EstoqueMovimentacao {
  id: string;
  produto_id: string;
  pedido_id: string | null;
  reserva_id: string | null;
  retalho_id: string | null;
  tipo: EstoqueMovimentoTipo;
  quantidade_cm: number;
  quantidade_barras: number;
  saldo_anterior_cm: number;
  saldo_posterior_cm: number;
  usuario: string | null;
  observacao: string | null;
  created_at: string;
}

export interface Retalho {
  id: string;
  produto_id: string;
  comprimento_cm: number;
  status: RetalhoStatus;
  origem_pedido_id: string | null;
  pedido_uso_id: string | null;
  data_corte: string;
  data_uso: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservaEstoque {
  id: string;
  pedido_id: string;
  pedido_item_id: string | null;
  produto_id: string;
  comprimento_cm: number;
  retalho_id: string | null;
  status: ReservaStatus;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrdemProducao {
  id: string;
  numero_op: string;
  pedido_id: string;
  pedido_item_id: string | null;
  perfil_produto_id: string | null;
  passe_partout_produto_id: string | null;
  protecao_produto_id: string | null;
  fundo_produto_id: string | null;
  largura_arte_cm: number | null;
  altura_arte_cm: number | null;
  largura_final_cm: number | null;
  altura_final_cm: number | null;
  largura_externa_cm: number | null;
  altura_externa_cm: number | null;
  consumo_moldura_cm: number;
  consumo_vidro_m2: number;
  consumo_fundo_m2: number;
  status: OrdemProducaoStatus;
  observacao: string | null;
  metadados: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface OrdemProducaoInsert {
  id?: string;
  numero_op?: string;
  pedido_id: string;
  pedido_item_id?: string | null;
  perfil_produto_id?: string | null;
  passe_partout_produto_id?: string | null;
  protecao_produto_id?: string | null;
  fundo_produto_id?: string | null;
  largura_arte_cm?: number | null;
  altura_arte_cm?: number | null;
  largura_final_cm?: number | null;
  altura_final_cm?: number | null;
  largura_externa_cm?: number | null;
  altura_externa_cm?: number | null;
  consumo_moldura_cm?: number;
  consumo_vidro_m2?: number;
  consumo_fundo_m2?: number;
  status?: OrdemProducaoStatus;
  observacao?: string | null;
  metadados?: JsonValue;
  created_at?: string;
  updated_at?: string;
}

export interface FabricanteEstoqueMinimo {
  id: string;
  fabricante: string;
  estoque_minimo_barras: number;
  created_at: string;
  updated_at: string;
}

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
  concluida: "Concluída",
  arquivada: "Arquivada",
  cancelada: "Cancelada",
};

/** Chaves de configuração reconhecidas. */
export const CONFIG_KEYS = {
  comprimento_barra_cm: "estoque.comprimento_barra_cm",
  perda_corte_percentual: "estoque.perda_corte_percentual",
  estoque_minimo_default: "estoque.estoque_minimo_barras_default",
} as const;
