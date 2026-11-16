/**
 * Tipos de domínio do ERP de Molduraria.
 * Independentes de provedor de banco de dados (desacoplados do SDK Supabase).
 */
import type { OrdemProducaoStatus } from "@/lib/constants/ordem-producao-status";
export type { OrdemProducaoStatus };

export type JsonValue =
  string | number | boolean | null | { [key: string]: JsonValue | undefined } | JsonValue[];

// ---------- Enums ----------
export type OrcamentoStatus =
  "rascunho" | "enviado" | "aprovado" | "recusado" | "expirado" | "convertido";

export type PedidoStatus = "orcamento" | "aprovado" | "em_producao" | "pronto" | "entregue";

export type PagamentoStatus = "pendente" | "pago" | "parcial" | "estornado" | "cancelado";

export type FormaPagamento =
  "dinheiro" | "pix" | "cartao_credito" | "cartao_debito" | "transferencia" | "boleto" | "outro";

export type ProdutoTipo =
  | "moldura"
  | "vidro"
  | "paspatur"
  | "fundo"
  | "acessorio"
  | "servico"
  | "outro"
  | "perfil_moldura"
  | "passe_partout"
  | "protecao_frontal"
  | "impressao"
  | "chassi";

export type HistoricoAcao =
  | "criado"
  | "atualizado"
  | "excluido"
  | "status_alterado"
  | "ITEM_PREPARADO"
  | "ITEM_DESMARCADO"
  | "ITEM_PROBLEMA_REGISTRADO"
  | "ITEM_PROBLEMA_REMOVIDO"
  | "PEDIDO_CONCLUIDO_PRODUCAO"
  | "ORDEM_PRODUCAO_CONCLUIDA";

export type ProblemaTipo =
  | "MATERIAL_FALTANTE"
  | "MEDIDA_INCORRETA"
  | "MOLDURA_DANIFICADA"
  | "VIDRO_DANIFICADO"
  | "PASSE_PARTOUT_DANIFICADO"
  | "IMPRESSAO_INCORRETA"
  | "OUTRO";

// ---------- Entidades ----------
export type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  cpf_cnpj: string | null;
  endereco: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type Produto = {
  id: string;
  codigo: string | null;
  nome: string;
  tipo: ProdutoTipo;
  descricao: string | null;
  unidade: string;
  unidade_venda: string | null;
  unidade_estoque: string | null;
  preco_custo: number;
  preco_venda: number;
  preco_venda_acima_m2: number | null;
  preco_venda_limite_m2: number | null;
  estoque: number;
  estoque_ideal: number;
  estoque_minimo: number;
  estoque_minimo_barras: number;
  ativo: boolean;
  fabricante: string | null;
  fornecedor: string | null;
  perfil: string | null;
  acabamento: string | null;
  altura_cm: number | null;
  largura_cm: number | null;
  chapa_largura_cm: number | null;
  chapa_altura_cm: number | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type Orcamento = {
  id: string;
  cliente_id: string | null;
  numero_orcamento: number;
  status: OrcamentoStatus;
  valor_total: number;
  validade: string | null;
  observacoes: string | null;
  metadados: JsonValue;
  created_at: string;
  updated_at: string;
};

export type OrcamentoItem = {
  id: string;
  orcamento_id: string;
  produto_id: string | null;
  descricao: string | null;
  quantidade: number;
  largura_cm: number | null;
  altura_cm: number | null;
  valor_unitario: number;
  valor_total: number;
  observacoes: string | null;
  metadados: JsonValue;
  created_at: string;
  updated_at: string;
};

export type Pedido = {
  id: string;
  cliente_id: string | null;
  orcamento_id: string | null;
  ordem_producao_id: string | null;
  numero_pedido: number;
  status: PedidoStatus;
  valor_total: number;
  forma_pagamento: FormaPagamento | null;
  data_pedido: string;
  data_entrega_prevista: string | null;
  data_entrega_realizada: string | null;
  observacoes: string | null;
  pdf_url: string | null;
  whatsapp_enviado: boolean;
  metadados: JsonValue;
  created_at: string;
  updated_at: string;
};

export type PedidoItem = {
  id: string;
  pedido_id: string;
  produto_id: string | null;
  descricao: string | null;
  quantidade: number;
  largura_cm: number | null;
  altura_cm: number | null;
  valor_unitario: number;
  valor_total: number;
  observacoes: string | null;
  metadados: JsonValue;
  created_at: string;
  updated_at: string;
};

export type Pagamento = {
  id: string;
  pedido_id: string;
  valor: number;
  forma_pagamento: FormaPagamento;
  status: PagamentoStatus;
  data_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

export type Historico = {
  id: string;
  entidade: string;
  entidade_id: string;
  usuario: string | null;
  acao: HistoricoAcao;
  descricao: string | null;
  dados_antes: JsonValue | null;
  dados_depois: JsonValue | null;
  created_at: string;
};

// ---------- Inserts ----------
export interface ClienteInsert {
  id?: string;
  nome: string;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  cpf_cnpj?: string | null;
  endereco?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProdutoInsert {
  id?: string;
  codigo?: string | null;
  nome: string;
  tipo?: ProdutoTipo;
  descricao?: string | null;
  unidade?: string;
  unidade_venda?: string | null;
  unidade_estoque?: string | null;
  preco_custo?: number;
  preco_venda?: number;
  preco_venda_acima_m2?: number | null;
  preco_venda_limite_m2?: number | null;
  estoque?: number;
  estoque_ideal?: number;
  estoque_minimo?: number;
  estoque_minimo_barras?: number;
  ativo?: boolean;
  fabricante?: string | null;
  fornecedor?: string | null;
  perfil?: string | null;
  acabamento?: string | null;
  altura_cm?: number | null;
  largura_cm?: number | null;
  chapa_largura_cm?: number | null;
  chapa_altura_cm?: number | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OrcamentoInsert {
  id?: string;
  cliente_id?: string | null;
  numero_orcamento?: number;
  status?: OrcamentoStatus;
  valor_total?: number;
  validade?: string | null;
  observacoes?: string | null;
  metadados?: JsonValue;
  created_at?: string;
  updated_at?: string;
}

export interface OrcamentoItemInsert {
  id?: string;
  orcamento_id: string;
  produto_id?: string | null;
  descricao?: string | null;
  quantidade?: number;
  largura_cm?: number | null;
  altura_cm?: number | null;
  valor_unitario?: number;
  valor_total?: number;
  observacoes?: string | null;
  metadados?: JsonValue;
  created_at?: string;
  updated_at?: string;
}

export interface PedidoInsert {
  id?: string;
  cliente_id?: string | null;
  orcamento_id?: string | null;
  ordem_producao_id?: string | null;
  numero_pedido?: number;
  status?: PedidoStatus;
  valor_total?: number;
  forma_pagamento?: FormaPagamento | null;
  data_pedido?: string;
  data_entrega_prevista?: string | null;
  data_entrega_realizada?: string | null;
  observacoes?: string | null;
  pdf_url?: string | null;
  whatsapp_enviado?: boolean;
  metadados?: JsonValue;
  created_at?: string;
  updated_at?: string;
}

export interface PedidoItemInsert {
  id?: string;
  pedido_id: string;
  produto_id?: string | null;
  descricao?: string | null;
  quantidade?: number;
  largura_cm?: number | null;
  altura_cm?: number | null;
  valor_unitario?: number;
  valor_total?: number;
  observacoes?: string | null;
  metadados?: JsonValue;
  created_at?: string;
  updated_at?: string;
}

export interface PagamentoInsert {
  id?: string;
  pedido_id: string;
  valor: number;
  forma_pagamento: FormaPagamento;
  status?: PagamentoStatus;
  data_pagamento?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ---------- Updates ----------
export type ClienteUpdate = Partial<ClienteInsert>;
export type ProdutoUpdate = Partial<ProdutoInsert>;
export type OrcamentoUpdate = Partial<OrcamentoInsert>;
export type PedidoUpdate = Partial<PedidoInsert>;
export type PagamentoUpdate = Partial<PagamentoInsert>;

// ---------- Shapes compostos ----------
export type OrcamentoComItens = Orcamento & {
  cliente: Cliente | null;
  itens: OrcamentoItem[];
};

export type PedidoComItens = Pedido & {
  cliente: Cliente | null;
  itens: PedidoItem[];
  pagamentos: Pagamento[];
};

// ---------- Labels ----------
export const ORCAMENTO_STATUS_LABEL: Record<OrcamentoStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  convertido: "Convertido em pedido",
};

export const PEDIDO_STATUS_LABEL: Record<PedidoStatus, string> = {
  orcamento: "Orçamento",
  aprovado: "Aprovado",
  em_producao: "Em produção",
  pronto: "Pronto",
  entregue: "Entregue",
};

/** Fluxo completo de status. */
export const PEDIDO_FLUXO: PedidoStatus[] = [
  "orcamento",
  "aprovado",
  "em_producao",
  "pronto",
  "entregue",
];

/** Status iniciais (antes de entrar em produção). */
export const PEDIDO_STATUS_INICIAIS: PedidoStatus[] = ["orcamento", "aprovado"];

// ---------- WhatsApp ----------
export interface NotificacaoWhatsapp {
  id: string;
  pedido_id: string | null;
  cliente_id: string | null;
  evento: string;
  destinatario: string | null;
  mensagem: string;
  status: string;
  tentativas: number;
  erro: string | null;
  payload: JsonValue;
  enviado_em: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificacaoWhatsappInsert {
  id?: string;
  pedido_id?: string | null;
  cliente_id?: string | null;
  evento: string;
  destinatario?: string | null;
  mensagem: string;
  status?: string;
  tentativas?: number;
  erro?: string | null;
  payload?: JsonValue;
  enviado_em?: string | null;
  created_at?: string;
  updated_at?: string;
}

export type WhatsappEvento =
  | "pedido_aprovado"
  | "pedido_pronto"
  | "pedido_entregue"
  | "orcamento_enviado"
  | "pagamento_recebido";

export const PAGAMENTO_STATUS_LABEL: Record<PagamentoStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
  parcial: "Parcial",
  estornado: "Estornado",
  cancelado: "Cancelado",
};

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};

export const PRODUTO_TIPO_LABEL: Record<ProdutoTipo, string> = {
  perfil_moldura: "Perfil de Moldura",
  passe_partout: "Passe-partout",
  protecao_frontal: "Proteção Frontal",
  fundo: "Fundo",
  impressao: "Impressão",
  chassi: "Chassi",
  servico: "Serviços",
  moldura: "Moldura (legado)",
  vidro: "Vidro (legado)",
  paspatur: "Paspatur (legado)",
  acessorio: "Acessório (legado)",
  outro: "Outro",
};

/** Categorias cadastradas manualmente (aba Essenciais). */
export const PRODUTO_CATEGORIAS_ESSENCIAIS = [
  "protecao_frontal",
  "fundo",
  "impressao",
  "chassi",
  "servico",
] as const satisfies readonly ProdutoTipo[];

export type ProdutoCategoriaEssencial = (typeof PRODUTO_CATEGORIAS_ESSENCIAIS)[number];

/** Categorias importadas via XLSX (aba Catálogo). */
export const PRODUTO_CATEGORIAS_IMPORTACAO = [
  "perfil_moldura",
  "passe_partout",
] as const satisfies readonly ProdutoTipo[];

export type ProdutoCategoriaImportacao = (typeof PRODUTO_CATEGORIAS_IMPORTACAO)[number];

// ---------- Item temporário da Calculadora (transferido para Novo Pedido) ----------
export interface PedidoItemDraft {
  descricao: string;
  quantidade: number;
  largura_cm: number;
  altura_cm: number;
  valor_unitario: number;
  valor_total: number;
  metadados: Record<string, unknown>;
}

// ---------- Ordem de Produção ----------
export type OrdemProducaoComponenteTipo =
  "MOLDURA" | "VIDRO" | "FUNDO" | "PASSEPARTOUT" | "CHASSI" | "IMPRESSAO";

export interface OrdemProducaoItemComponente {
  id: string;
  ordem_producao_item_id: string;
  tipo: OrdemProducaoComponenteTipo;
  descricao: string;
  ordem: number;
  preparado: boolean;
  preparado_em: string | null;
  preparado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrdemProducao {
  id: string;
  numero: number;
  status: OrdemProducaoStatus;
  criado_em: string;
  atualizado_em: string | null;
  concluido_em: string | null;
  criado_por: string | null;
  observacoes: string | null;
  para_dia?: string;
}

export interface OrdemProducaoItem {
  id: string;
  ordem_producao_id: string;
  pedido_id: string;
  item_pedido_id: string;
  criado_em: string;
  atualizado_em: string;
  preparado?: boolean;
  preparado_em?: string | null;
  preparado_por?: string | null;
  possui_problema?: boolean;
  problema_tipo?: ProblemaTipo | null;
  problema_descricao?: string | null;
  problema_em?: string | null;
  problema_por?: string | null;
  componentes?: OrdemProducaoItemComponente[];
}

export type OrdemProducaoDetalhada = OrdemProducao & {
  pedidos: PedidoComItens[];
};
