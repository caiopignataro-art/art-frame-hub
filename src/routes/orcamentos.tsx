import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { orcamentosService } from "@/lib/services/orcamentos.service";
import { OrcamentoStatusBadge } from "@/components/erp/StatusBadge";
import { formatBRL, formatDate } from "@/lib/format";

export const Route = createFileRoute("/orcamentos")({
  head: () => ({ meta: [{ title: "Orçamentos — Molduraria ERP" }] }),
  component: OrcamentosPage,
});

function OrcamentosPage() {
  const { data, isLoading } = useQuery({ queryKey: ["orcamentos"], queryFn: orcamentosService.list });

  return (
    <AppShell title="Orçamentos">
      <PageHeader
        title="Orçamentos"
        description="Propostas enviadas aos clientes."
        actions={<Button disabled><Plus className="mr-2 h-4 w-4" /> Novo orçamento</Button>}
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {data?.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-mono">#{o.numero_orcamento}</TableCell>
                <TableCell>{o.cliente?.nome ?? "—"}</TableCell>
                <TableCell><OrcamentoStatusBadge status={o.status} /></TableCell>
                <TableCell className="text-right">{formatBRL(o.valor_total)}</TableCell>
                <TableCell>{formatDate(o.created_at)}</TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum orçamento.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
