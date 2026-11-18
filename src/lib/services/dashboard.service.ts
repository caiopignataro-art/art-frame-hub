/**
 * Agregações usadas pelo Dashboard.
 * Executa exclusivamente via RPC `get_dashboard_summary` no servidor PostgreSQL,
 * validando `dashboard.view` e retornando apenas métricas agregadas (sem expor
 * linhas individuais de `pagamentos` ou `pedidos`).
 */
import { supabase } from "@/integrations/supabase/client";

export type DashboardData = {
  faturamentoMes: number;
  ticketMedio: number;
  qtdPedidosMes: number;
  lucroEstimado: number;
  emProducao: number;
  produtosMaisUsados: { descricao: string; quantidade: number; total: number }[];
  clientesRecorrentes: { cliente_id: string; nome: string; pedidos: number; total: number }[];
  serieFaturamento: { mes: string; valor: number }[];
};

export const dashboardService = {
  async load(): Promise<DashboardData> {
    const { data, error } = await supabase.rpc("get_dashboard_summary" as never);
    if (error) throw error;

    const payload = (data ?? {}) as Partial<DashboardData>;
    return {
      faturamentoMes: Number(payload.faturamentoMes ?? 0),
      ticketMedio: Number(payload.ticketMedio ?? 0),
      qtdPedidosMes: Number(payload.qtdPedidosMes ?? 0),
      lucroEstimado: Number(payload.lucroEstimado ?? 0),
      emProducao: Number(payload.emProducao ?? 0),
      produtosMaisUsados: Array.isArray(payload.produtosMaisUsados)
        ? payload.produtosMaisUsados
        : [],
      clientesRecorrentes: Array.isArray(payload.clientesRecorrentes)
        ? payload.clientesRecorrentes
        : [],
      serieFaturamento: Array.isArray(payload.serieFaturamento) ? payload.serieFaturamento : [],
    };
  },
};
