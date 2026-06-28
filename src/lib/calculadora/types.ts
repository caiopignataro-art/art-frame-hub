import type { Produto } from "@/types/erp";

export type PasseOrdem = "interno" | "meio" | "externo";

export interface MolduraSelecionada {
  produto: Produto;
}

export interface PassePartoutSelecionado {
  produto: Produto;
  /** Medida (cm) deste passe-partout específico. */
  medida_cm: number;
  /** Ordem (obrigatória apenas quando houver mais de um PP). */
  ordem?: PasseOrdem;
}

export interface CalcInput {
  quantidade: number;
  /** Largura da arte (cm). */
  largura_interna_cm: number;
  /** Altura da arte (cm). */
  altura_interna_cm: number;
  molduras: MolduraSelecionada[];
  passe_partouts: PassePartoutSelecionado[];
  protecao: Produto | null;
  fundo: Produto | null;
  servicos: Produto[];
  observacoes?: string;
  /** Comprimento de cada barra de moldura (cm). Default 270. */
  barra_cm?: number;
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
  /** Quantidade cobrada (m para moldura, m² para áreas, un para serviços). */
  quantidade: number;
  preco_venda: number;
  /** Valor total cobrado deste material (quantidade × preco_venda × quadros). */
  valor_total: number;
}

export interface BarraDistribuicao {
  /** Comprimentos (cm) das peças cortadas desta barra, na ordem. */
  pecas: number[];
  /** Retalho restante (cm) ao final desta barra. */
  retalho_cm: number;
}

export interface MolduraDetalhe {
  produto_id: string;
  codigo: string | null;
  descricao: string;
  perfil_largura_cm: number;
  /** Consumo comercial (m lineares) — usado para preço. */
  perimetro_comercial_m: number;
  /** Consumo cobrado (mínimo 1 m). */
  perimetro_cobrado_m: number;
  /** Peças horizontais (cm) — sempre 2 por quadro. */
  peca_horizontal_cm: number;
  /** Peças verticais (cm) — sempre 2 por quadro. */
  peca_vertical_cm: number;
  /** Total de peças (2H + 2V) × quantidade de quadros. */
  total_pecas: number;
  /** Distribuição de barras (corte). */
  barras: BarraDistribuicao[];
  /** Quantidade total de barras necessárias. */
  total_barras: number;
  /** True se alguma peça excede o comprimento da barra. */
  peca_excede_barra: boolean;
}

export interface PassePartoutDetalhe {
  produto_id: string;
  codigo: string | null;
  descricao: string;
  medida_cm: number;
  ordem: PasseOrdem | null;
  /** Tamanho acumulado após aplicar este PP (cm). */
  apos_largura_cm: number;
  apos_altura_cm: number;
}

export interface CalcResult {
  quantidade: number;
  /** Medidas da arte. */
  largura_arte_cm: number;
  altura_arte_cm: number;
  /** Soma de todos os PP. */
  soma_passe_partout_cm: number;
  /** Abertura do quadro (arte + 2×ΣPP). */
  largura_abertura_cm: number;
  altura_abertura_cm: number;
  /** Tamanho final (abertura + 2×larg perfil). */
  largura_final_cm: number;
  altura_final_cm: number;
  /** Largura do perfil utilizada (cm) — primeira moldura. */
  perfil_largura_cm: number;
  /** Passe-partouts ordenados (interno → meio → externo). */
  passe_partouts: PassePartoutDetalhe[];
  /** Aviso quando abertura excede 100×80 cm. */
  passe_partout_excede_chapa: boolean;
  /** Detalhe por moldura (produção + preço). */
  molduras: MolduraDetalhe[];
  /** Área comum de materiais planos (m²) — baseada na abertura. */
  area_m2: number;
  materiais: MaterialCalculado[];
  /** Valor unitário (somatório / quadros). */
  valor_unitario: number;
  /** Valor total (qtd × valor unitário). */
  valor_total: number;
}
