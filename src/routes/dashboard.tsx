import type * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  Hammer,
  Package,
  PiggyBank,
  Plus,
  Receipt,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { EmptyState } from "@/components/erp/EmptyState";
import { ErrorState } from "@/components/erp/ErrorState";
import { KpiGridSkeleton } from "@/components/erp/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { dashboardService } from "@/lib/services/dashboard.service";
import { produtosService } from "@/lib/services/produtos.service";
import { formatBRL } from "@/lib/format";
import { PRODUTO_TIPO_LABEL } from "@/types/erp";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Art Frame Hub" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardService.load,
  });
  const alertasQ = useQuery({
    queryKey: ["alertas-essenciais"],
    queryFn: () => produtosService.listAlertasEssenciais(),
  });

  const alertas = alertasQ.data ?? [];
  const totalFaturamentoSemestre = (data?.serieFaturamento ?? []).reduce(
    (acc, item) => acc + item.valor,
    0,
  );
  const maxClienteTotal = Math.max(1, ...(data?.clientesRecorrentes.map((c) => c.total) ?? [1]));
  const maxProdutoQtd = Math.max(
    1,
    ...(data?.produtosMaisUsados.map((p) => Number(p.quantidade)) ?? [1]),
  );

  return (
    <AppShell title="Dashboard">
      <PageHeader
        title="Visão Geral do Negócio"
        description="Acompanhamento executivo de faturamento, pedidos, produção e insumos essenciais."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/">
                <Calculator className="h-3.5 w-3.5" />
                Calculadora
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/pedidos/novo" search={{}}>
                <Plus className="h-3.5 w-3.5" />
                Novo pedido
              </Link>
            </Button>
          </>
        }
      />

      {isError && (
        <ErrorState
          title="Falha ao carregar indicadores"
          description="Não foi possível consolidar as métricas financeiras e operacionais do dashboard."
          onRetry={() => void refetch()}
        />
      )}

      {/* SEÇÃO 1 — LINHA DE KPIS COMPACTOS */}
      {isLoading ? (
        <div className="space-y-6">
          <KpiGridSkeleton count={5} />
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-4 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        data && (
          <div className="space-y-6">
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
              <KpiMetricCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Faturamento do mês"
                value={formatBRL(data.faturamentoMes)}
                hint="Receita bruta mensal"
                highlight
              />
              <KpiMetricCard
                icon={<ShoppingBag className="h-4 w-4" />}
                label="Pedidos no mês"
                value={String(data.qtdPedidosMes)}
                hint="Volume comercial no período"
              />
              <KpiMetricCard
                icon={<Receipt className="h-4 w-4" />}
                label="Ticket médio"
                value={formatBRL(data.ticketMedio)}
                hint="Média por pedido no mês"
              />
              <KpiMetricCard
                icon={<PiggyBank className="h-4 w-4" />}
                label="Lucro estimado"
                value={formatBRL(data.lucroEstimado)}
                hint="Margem operacional estimada"
              />
              <KpiMetricCard
                icon={<Hammer className="h-4 w-4" />}
                label="Em produção"
                value={String(data.emProducao)}
                hint="Pedidos ativos na fábrica"
                to="/producao"
              />
            </div>

            {/* SEÇÃO 2 — GRÁFICO RECHARTS + ALERTAS DE ESTOQUE ESSENCIAL */}
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2 flex flex-col">
                <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-sm font-semibold">
                      Evolução de Faturamento (Últimos 6 meses)
                    </CardTitle>
                    <CardDescription>Série histórica mensal de pedidos emitidos</CardDescription>
                  </div>
                  <div className="text-right">
                    <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Acumulado 6m
                    </span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {formatBRL(totalFaturamentoSemestre)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-4">
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.serieFaturamento}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="var(--color-border)"
                        />
                        <XAxis
                          dataKey="mes"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "var(--color-muted-foreground)",
                            fontSize: 12,
                          }}
                          dy={6}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          width={72}
                          tick={{
                            fill: "var(--color-muted-foreground)",
                            fontSize: 11,
                          }}
                          tickFormatter={(val: number) =>
                            val >= 1000 ? `R$ ${(val / 1000).toFixed(0)}k` : `R$ ${val}`
                          }
                        />
                        <Tooltip
                          cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                          content={({ active, payload, label }) => {
                            if (!active || !payload || payload.length === 0) {
                              return null;
                            }
                            const valor = Number(payload[0]?.value ?? 0);
                            return (
                              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                                <div className="mb-1 font-medium capitalize text-muted-foreground">
                                  {label}
                                </div>
                                <div className="font-mono text-sm font-semibold tabular-nums text-popover-foreground">
                                  {formatBRL(valor)}
                                </div>
                              </div>
                            );
                          }}
                        />
                        <Bar
                          dataKey="valor"
                          fill="var(--color-primary)"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={44}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* PAINEL DE ALERTAS DE ESTOQUE ESSENCIAL */}
              <Card className="flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <AlertTriangle
                        className={
                          alertas.length > 0
                            ? "h-4 w-4 text-destructive"
                            : "h-4 w-4 text-muted-foreground"
                        }
                      />
                      Alertas de Estoque
                    </CardTitle>
                    <CardDescription>Insumos essenciais abaixo do mínimo</CardDescription>
                  </div>
                  <Badge variant={alertas.length > 0 ? "destructive" : "success"}>
                    {alertas.length > 0 ? `${alertas.length} crítico(s)` : "Regular"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  {alertas.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Package}
                      title="Estoque essencial regular"
                      description="Todos os insumos essenciais ativos estão acima do nível mínimo configurado."
                    />
                  ) : (
                    <div className="space-y-2">
                      {alertas.slice(0, 5).map((a) => (
                        <div
                          key={a.produto.id}
                          className="flex items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="truncate font-medium text-foreground">
                              {a.produto.nome}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {PRODUTO_TIPO_LABEL[a.produto.tipo]} · Mín: {a.produto.estoque_minimo}
                            </div>
                          </div>
                          <div className="shrink-0 text-right font-mono font-semibold tabular-nums text-destructive">
                            {a.estoque_real}{" "}
                            <span className="font-sans text-[10px] font-normal">
                              {a.produto.unidade_estoque ?? a.produto.unidade}
                            </span>
                          </div>
                        </div>
                      ))}
                      {alertas.length > 5 && (
                        <p className="text-center text-[11px] text-muted-foreground">
                          + {alertas.length - 5} outro(s) item(ns) em alerta
                        </p>
                      )}
                    </div>
                  )}

                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full justify-between text-xs"
                  >
                    <Link to="/produtos/essenciais">
                      <span>Gerenciar produtos essenciais</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* SEÇÃO 3 — ATIVIDADE OPERACIONAL (CLIENTES RECORRENTES E PRODUTOS MAIS UTILIZADOS) */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Clientes Recorrentes
                    </CardTitle>
                    <CardDescription>
                      Maiores compradores por frequência e volume acumulado
                    </CardDescription>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    <Link to="/clientes">
                      Ver todos
                      <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {data.clientesRecorrentes.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Users}
                      title="Sem histórico de recorrência"
                      description="Os clientes mais frequentes aparecerão aqui conforme os pedidos forem registrados."
                    />
                  ) : (
                    <div className="space-y-3">
                      {data.clientesRecorrentes.map((c, idx) => {
                        const pct = Math.max(8, Math.round((c.total / maxClienteTotal) * 100));
                        return (
                          <div key={c.cliente_id} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] font-semibold text-muted-foreground">
                                  {idx + 1}
                                </span>
                                <span className="truncate font-medium text-foreground">
                                  {c.nome}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                                <Badge
                                  variant="secondary"
                                  className="px-1.5 py-0 text-[10px] font-normal"
                                >
                                  {c.pedidos} {c.pedidos === 1 ? "pedido" : "pedidos"}
                                </Badge>
                                <span className="font-mono font-semibold text-foreground">
                                  {formatBRL(c.total)}
                                </span>
                              </div>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary/75 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      Itens e Produtos Mais Utilizados
                    </CardTitle>
                    <CardDescription>
                      Descrições com maior demanda acumulada nos pedidos
                    </CardDescription>
                  </div>
                  <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
                    <Link to="/produtos">
                      Catálogo
                      <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {data.produtosMaisUsados.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Package}
                      title="Sem itens registrados"
                      description="Os produtos mais utilizados nos pedidos aparecerão aqui automaticamente."
                    />
                  ) : (
                    <div className="space-y-3">
                      {data.produtosMaisUsados.map((p, idx) => {
                        const pct = Math.max(
                          8,
                          Math.round((Number(p.quantidade) / maxProdutoQtd) * 100),
                        );
                        return (
                          <div key={p.descricao} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] font-semibold text-muted-foreground">
                                  {idx + 1}
                                </span>
                                <span className="truncate font-medium text-foreground">
                                  {p.descricao}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-2 text-xs tabular-nums">
                                <span className="text-muted-foreground">
                                  {Number(p.quantidade).toFixed(0)} un.
                                </span>
                                <span className="font-mono font-semibold text-foreground">
                                  {formatBRL(p.total)}
                                </span>
                              </div>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-chart-2 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )
      )}
    </AppShell>
  );
}

function KpiMetricCard({
  icon,
  label,
  value,
  hint,
  highlight,
  to,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
  to?: string;
}) {
  const content = (
    <Card
      className={
        highlight
          ? "border-primary/25 bg-primary/[0.02] transition-colors"
          : "transition-colors hover:border-border"
      }
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/70 text-muted-foreground">
            {icon}
          </span>
        </div>
        <div className="mt-2 font-mono text-xl font-semibold tracking-tight tabular-nums text-foreground sm:text-2xl">
          {value}
        </div>
        {hint && (
          <p className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{hint}</span>
            {to && <ArrowUpRight className="h-3 w-3 opacity-70" />}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} className="block focus:outline-none">
        {content}
      </Link>
    );
  }
  return content;
}
