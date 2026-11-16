import type { Produto } from "@/types/erp";
import type {
  EstoqueMovimentacao,
  FabricanteEstoqueMinimo,
  OrdemProducao,
  ReservaEstoque,
  Retalho,
} from "@/types/estoque";

export interface PerfilEstoque {
  produto: Produto;
  barras: number;
  comprimento_barra_cm: number;
  total_cm_barras: number;
  retalhos_cm: number;
  saldo_total_cm: number;
  reservado_cm: number;
  disponivel_cm: number;
  estoque_minimo_barras: number;
  abaixo_minimo: boolean;
}

export interface EstoqueResumo {
  total_barras: number;
  total_retalhos: number;
  perfis_baixo_estoque: number;
  valor_estoque: number;
  valor_retalhos: number;
  consumo_mes_cm: number;
}

export interface EstoqueRepository {
  listarPerfis(): Promise<PerfilEstoque[]>;
  resumo(): Promise<EstoqueResumo>;
  listarRetalhos(filtroProdutoId?: string): Promise<Retalho[]>;
  listarMovimentacoes(produtoId?: string, limit?: number): Promise<EstoqueMovimentacao[]>;
  listarReservas(pedidoId?: string): Promise<ReservaEstoque[]>;
  listarOrdensProducao(): Promise<OrdemProducao[]>;
  ajustarEstoque(produtoId: string, deltaBarras: number, observacao?: string): Promise<void>;
  descartarRetalho(retalhoId: string): Promise<void>;
  listarFabricanteMinimos(): Promise<FabricanteEstoqueMinimo[]>;
  setMinimoProduto(produtoId: string, minBarras: number): Promise<void>;
  setMinimoFabricante(fabricante: string, minBarras: number): Promise<void>;
}
