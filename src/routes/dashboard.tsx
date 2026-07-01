import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { dashboardService } from "@/lib/services/dashboard.service";
import { produtosService } from "@/lib/services/produtos.service";
import { formatBRL } from "@/lib/format";
import { TrendingUp, Receipt, ShoppingBag, PiggyBank, Hammer, AlertTriangle } from "lucide-react";
import { PRODUTO_TIPO_LABEL } from "@/types/erp";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Molduraria ERP" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: dashboardService.load });
  const alertasQ = useQuery({
    queryKey: ["alertas-essenciais"],
    queryFn: () => produtosService.listAlertasEssenciais(),
  });

  const maxSerie = Math.max(1, ...(data?.serieFaturamento.map((s) => s.valor) ?? [0]));

  return (
    <AppShell title="Dashboard">
      <PageHeader
        title="Visão geral do negócio"
        description="Indicadores de faturamento, produção e clientes."
      />

      {alertasQ.data && alertasQ.data.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>🔴 Estoque crítico ({alertasQ.data.length})</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5 text-sm">
              {alertasQ.data.slice(0, 5).map((a) => (
                <li key={a.produto.id}>
                  <strong>{PRODUTO_TIPO_LABEL[a.produto.tipo]}</strong> — {a.produto.nome}:{" "}
                  {a.estoque_real} {a.produto.unidade_estoque ?? a.produto.unidade} restante(s)
                </li>
              ))}
              {alertasQ.data.length > 5 && (
                <li className="text-xs opacity-80">+ {alertasQ.data.length - 5} outros</li>
              )}
            </ul>
            <Link to="/produtos/essenciais" className="mt-2 inline-block underline text-sm">
              Ver produtos essenciais →
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando indicadores…</p>}

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <KPI icon={<TrendingUp className="h-4 w-4" />} label="Faturamento do mês" value={formatBRL(data.faturamentoMes)} />
            <KPI icon={<Receipt className="h-4 w-4" />} label="Ticket médio" value={formatBRL(data.ticketMedio)} />
            <KPI icon={<ShoppingBag className="h-4 w-4" />} label="Pedidos no mês" value={data.qtdPedidosMes} />
            <KPI icon={<PiggyBank className="h-4 w-4" />} label="Lucro estimado" value={formatBRL(data.lucroEstimado)} />
            <KPI icon={<Hammer className="h-4 w-4" />} label="Em produção" value={data.emProducao} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-sm">Faturamento — últimos 6 meses</CardTitle></CardHeader>
              <CardContent>
                <div className="flex h-48 items-end gap-3">
                  {data.serieFaturamento.map((s) => (
                    <div key={s.mes} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="w-full rounded-t bg-primary/80"
                        style={{ height: `${(s.valor / maxSerie) * 100}%`, minHeight: 2 }}
                        title={formatBRL(s.valor)}
                      />
                      <span className="text-xs text-muted-foreground">{s.mes}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Clientes recorrentes</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.clientesRecorrentes.length === 0 && <p className="text-muted-foreground text-xs">Sem dados.</p>}
                {data.clientesRecorrentes.map((c) => (
                  <div key={c.cliente_id} className="flex items-center justify-between border-b border-border/50 pb-1 last:border-0">
                    <span className="truncate">{c.nome}</span>
                    <span className="text-muted-foreground">{c.pedidos} ped. · {formatBRL(c.total)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader><CardTitle className="text-sm">Produtos mais utilizados</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.produtosMaisUsados.length === 0 && <p className="text-muted-foreground text-xs">Sem dados.</p>}
              {data.produtosMaisUsados.map((p) => (
                <div key={p.descricao} className="flex items-center justify-between border-b border-border/50 pb-1 last:border-0">
                  <span className="truncate">{p.descricao}</span>
                  <span className="text-muted-foreground">{Number(p.quantidade).toFixed(2)} · {formatBRL(p.total)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </AppShell>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {icon} {label}
        </CardTitle>
      </CardHeader>
      <CardContent><div className="text-2xl font-semibold">{value}</div></CardContent>
    </Card>
  );
}
