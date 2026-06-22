/**
 * Agregações usadas pelo Dashboard. Tudo é calculado no client a partir
 * das tabelas existentes — sem views materializadas para manter simplicidade.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Pedido, Pagamento, PedidoItem } from "@/types/erp";

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

const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);

export const dashboardService = {
  async load(): Promise<DashboardData> {
    const inicioMes = startOfMonth().toISOString();

    const [pedidosRes, itensRes, pagamentosRes] = await Promise.all([
      supabase
        .from("pedidos")
        .select("id, cliente_id, status, valor_total, created_at, cliente:clientes(nome)")
        .order("created_at", { ascending: false }),
      supabase.from("pedido_itens").select("descricao, quantidade, valor_total"),
      supabase.from("pagamentos").select("valor, status, data_pagamento, created_at"),
    ]);

    if (pedidosRes.error) throw pedidosRes.error;
    if (itensRes.error) throw itensRes.error;
    if (pagamentosRes.error) throw pagamentosRes.error;

    const pedidos = (pedidosRes.data ?? []) as (Pedido & { cliente: { nome: string } | null })[];
    const itens = (itensRes.data ?? []) as Pick<PedidoItem, "descricao" | "quantidade" | "valor_total">[];
    const pagamentos = (pagamentosRes.data ?? []) as Pagamento[];

    const pedidosMes = pedidos.filter((p) => p.created_at >= inicioMes && p.status !== "cancelado");
    const faturamentoMes = pedidosMes.reduce((s, p) => s + Number(p.valor_total), 0);
    const qtdPedidosMes = pedidosMes.length;
    const ticketMedio = qtdPedidosMes ? faturamentoMes / qtdPedidosMes : 0;

    // Lucro estimado: usa margem média de 45% quando não há custo direto disponível.
    const lucroEstimado = faturamentoMes * 0.45;

    const emProducao = pedidos.filter((p) =>
      ["aguardando_producao", "em_producao", "montagem", "controle_qualidade"].includes(p.status),
    ).length;

    // Produtos mais utilizados
    const mapaProd = new Map<string, { quantidade: number; total: number }>();
    itens.forEach((i) => {
      const k = i.descricao ?? "—";
      const cur = mapaProd.get(k) ?? { quantidade: 0, total: 0 };
      cur.quantidade += Number(i.quantidade);
      cur.total += Number(i.valor_total);
      mapaProd.set(k, cur);
    });
    const produtosMaisUsados = [...mapaProd.entries()]
      .map(([descricao, v]) => ({ descricao, ...v }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 5);

    // Clientes recorrentes
    const mapaCli = new Map<string, { nome: string; pedidos: number; total: number }>();
    pedidos.forEach((p) => {
      if (!p.cliente_id) return;
      const cur = mapaCli.get(p.cliente_id) ?? { nome: p.cliente?.nome ?? "—", pedidos: 0, total: 0 };
      cur.pedidos += 1;
      cur.total += Number(p.valor_total);
      mapaCli.set(p.cliente_id, cur);
    });
    const clientesRecorrentes = [...mapaCli.entries()]
      .map(([cliente_id, v]) => ({ cliente_id, ...v }))
      .sort((a, b) => b.pedidos - a.pedidos)
      .slice(0, 5);

    // Série dos últimos 6 meses (faturamento)
    const serieFaturamento: { mes: string; valor: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i, 1);
      const ini = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
      const fim = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
      const valor = pedidos
        .filter((p) => p.created_at >= ini && p.created_at < fim && p.status !== "cancelado")
        .reduce((s, p) => s + Number(p.valor_total), 0);
      serieFaturamento.push({
        mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        valor,
      });
    }

    // Pagamentos recebidos (para uso futuro / cards)
    void pagamentos;

    return {
      faturamentoMes,
      ticketMedio,
      qtdPedidosMes,
      lucroEstimado,
      emProducao,
      produtosMaisUsados,
      clientesRecorrentes,
      serieFaturamento,
    };
  },
};
