import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { pedidosService } from "@/lib/services/pedidos.service";
import { PedidoStatusBadge } from "@/components/erp/StatusBadge";
import { formatDate } from "@/lib/format";
import type { PedidoStatus } from "@/types/erp";

export const Route = createFileRoute("/producao")({
  head: () => ({ meta: [{ title: "Produção — Molduraria ERP" }] }),
  component: ProducaoPage,
});

const COLUMNS: { status: PedidoStatus; label: string }[] = [
  { status: "aguardando_producao", label: "Aguardando" },
  { status: "em_producao", label: "Em produção" },
  { status: "pronto", label: "Pronto" },
  { status: "entregue", label: "Entregue" },
];

function ProducaoPage() {
  const { data } = useQuery({ queryKey: ["pedidos"], queryFn: () => pedidosService.list() });
  const pedidos = data ?? [];

  return (
    <AppShell title="Produção">
      <PageHeader
        title="Fluxo de produção"
        description="Visão Kanban dos pedidos por estágio."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = pedidos.filter((p) => p.status === col.status);
          return (
            <Card key={col.status}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{col.label}</span>
                  <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{items.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.length === 0 && <p className="text-xs text-muted-foreground">Nenhum.</p>}
                {items.map((p) => (
                  <div key={p.id} className="rounded-md border border-border bg-card p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-muted-foreground">#{p.numero_pedido}</span>
                      <PedidoStatusBadge status={p.status} />
                    </div>
                    <div className="mt-1 font-medium">{p.cliente?.nome ?? "—"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Entrega: {formatDate(p.data_entrega_prevista)}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AppShell>
  );
}
