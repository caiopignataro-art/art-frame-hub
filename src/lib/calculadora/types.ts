import type { Produto } from "@/types/erp";

export interface MolduraSelecionada {
  produto: Produto;
}

export interface PassePartoutSelecionado {
  produto: Produto;
  /** Medida (cm) deste passe-partout específico. */
  medida_cm: number;
}

export interface CalcInput {
  quantidade: number;
  /** Largura interna da arte (cm). */
  largura_interna_cm: number;
  /** Altura interna da arte (cm). */
  altura_interna_cm: number;
  molduras: MolduraSelecionada[];
  passe_partouts: PassePartoutSelecionado[];
  protecao: Produto | null;
  fundo: Produto | null;
  servicos: Produto[];
  observacoes?: string;
}

export type MaterialOrigem =
  | "perfil_moldura"
  | "passe_partout"
  | "protecao_frontal"
  | "fundo"
  | "servico";

export interface MaterialCalculado {
  produto_id: string;
  codigo: string | null;
  descricao: string;
  origem: MaterialOrigem;
  unidade: string;
  /** Quantidade consumida (m para moldura, m² para áreas, un para serviços). */
  quantidade: number;
  preco_custo: number;
  preco_venda: number;
  custo_total: number;
  venda_total: number;
  lucro: number;
}

export interface CalcResult {
  quantidade: number;
  largura_interna_cm: number;
  altura_interna_cm: number;
  soma_passe_partout_cm: number;
  largura_final_cm: number;
  altura_final_cm: number;
  perimetro_ml: number;
  area_m2: number;
  materiais: MaterialCalculado[];
  total_custo: number;
  total_venda: number;
  lucro_bruto: number;
  margem_pct: number;
}
