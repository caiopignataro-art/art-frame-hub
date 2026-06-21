import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { pagamentosService } from "@/lib/services/pagamentos.service";
import { PagamentoStatusBadge } from "@/components/erp/StatusBadge";
import { formatBRL, formatDateTime } from "@/lib/format";
import { FORMA_PAGAMENTO_LABEL } from "@/types/erp";

export const Route = createFileRoute("/pagamentos")({
  head: () => ({ meta: [{ title: "Pagamentos — Molduraria ERP" }] }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const { data, isLoading } = useQuery({ queryKey: ["pagamentos"], queryFn: pagamentosService.listAll });

  return (
    <AppShell title="Pagamentos">
      <PageHeader title="Pagamentos" description="Recebimentos vinculados a pedidos." />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {data?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono">#{p.pedido?.numero_pedido ?? "—"}</TableCell>
                <TableCell>{p.pedido?.cliente?.nome ?? "—"}</TableCell>
                <TableCell>{FORMA_PAGAMENTO_LABEL[p.forma_pagamento]}</TableCell>
                <TableCell><PagamentoStatusBadge status={p.status} /></TableCell>
                <TableCell className="text-right">{formatBRL(p.valor)}</TableCell>
                <TableCell>{formatDateTime(p.data_pagamento)}</TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum pagamento.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
