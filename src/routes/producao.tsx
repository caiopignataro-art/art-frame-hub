import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { pedidosService } from "@/lib/services/pedidos.service";
import { PedidoDetailDialog } from "@/components/erp/PedidoDetailDialog";
import { formatDate } from "@/lib/format";
import { PEDIDO_FLUXO, type PedidoStatus } from "@/types/erp";

export const Route = createFileRoute("/producao")({
  head: () => ({ meta: [{ title: "Produção — Molduraria ERP" }] }),
  component: ProducaoPage,
});

const COLUMNS: { status: PedidoStatus; label: string }[] = [
  { status: "aguardando_producao", label: "Aguardando" },
  { status: "em_producao", label: "Em produção" },
  { status: "montagem", label: "Montagem" },
  { status: "controle_qualidade", label: "Controle de qualidade" },
  { status: "pronto", label: "Pronto" },
];

function proximoStatus(atual: PedidoStatus): PedidoStatus | null {
  const i = PEDIDO_FLUXO.indexOf(atual);
  if (i < 0 || i >= PEDIDO_FLUXO.length - 1) return null;
  return PEDIDO_FLUXO[i + 1];
}

function ProducaoPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["pedidos"], queryFn: () => pedidosService.list() });
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const avancar = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PedidoStatus }) => pedidosService.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pedidos = data ?? [];

  return (
    <AppShell title="Produção">
      <PageHeader title="Fluxo de produção" description="Visão Kanban dos pedidos por estágio." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
                {items.map((p) => {
                  const next = proximoStatus(p.status);
                  return (
                    <div key={p.id} className="rounded-md border border-border bg-card p-3 text-sm">
                      <button className="text-left w-full" onClick={() => setSelecionado(p.id)}>
                        <div className="font-mono text-xs text-muted-foreground">#{p.numero_pedido}</div>
                        <div className="font-medium">{p.cliente?.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">Entrega: {formatDate(p.data_entrega_prevista)}</div>
                      </button>
                      {next && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          onClick={() => avancar.mutate({ id: p.id, status: next })}
                          disabled={avancar.isPending}
                        >
                          Avançar <ChevronRight className="ml-1 h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <PedidoDetailDialog pedidoId={selecionado} onOpenChange={(o) => !o && setSelecionado(null)} />
    </AppShell>
  );
}
