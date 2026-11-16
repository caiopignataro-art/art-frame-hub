export interface DashboardData {
  faturamentoMes: number;
  ticketMedio: number;
  qtdPedidosMes: number;
  lucroEstimado: number;
  emProducao: number;
  produtosMaisUsados: { descricao: string; quantidade: number; total: number }[];
  clientesRecorrentes: { cliente_id: string; nome: string; pedidos: number; total: number }[];
  serieFaturamento: { mes: string; valor: number }[];
}

export interface DashboardRepository {
  load(): Promise<DashboardData>;
}
