import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { pedidosService } from "@/lib/services/pedidos.service";
import { PedidoStatusBadge } from "@/components/erp/StatusBadge";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — Molduraria ERP" }] }),
  component: PedidosPage,
});

function PedidosPage() {
  const { data, isLoading } = useQuery({ queryKey: ["pedidos"], queryFn: () => pedidosService.list() });

  return (
    <AppShell title="Pedidos">
      <PageHeader
        title="Pedidos"
        description="Pedidos confirmados e em fluxo."
        actions={<Button disabled><Plus className="mr-2 h-4 w-4" /> Novo pedido</Button>}
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Entrega prevista</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {data?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono">#{p.numero_pedido}</TableCell>
                <TableCell>{p.cliente?.nome ?? "—"}</TableCell>
                <TableCell><PedidoStatusBadge status={p.status} /></TableCell>
                <TableCell className="text-right">{formatBRL(p.valor_total)}</TableCell>
                <TableCell>{formatDate(p.data_entrega_prevista)}</TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum pedido.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
