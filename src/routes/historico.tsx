import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { historicoService } from "@/lib/services/historico.service";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/historico")({
  head: () => ({ meta: [{ title: "Histórico — Molduraria ERP" }] }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["historico"],
    queryFn: () => historicoService.list({ limit: 200 }),
  });

  return (
    <AppShell title="Histórico">
      <PageHeader
        title="Auditoria"
        description="Todas as alterações registradas automaticamente pelo banco."
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {data?.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(h.created_at)}</TableCell>
                <TableCell><Badge variant="outline">{h.entidade}</Badge></TableCell>
                <TableCell><Badge variant="secondary">{h.acao}</Badge></TableCell>
                <TableCell className="text-sm">{h.descricao ?? "—"}</TableCell>
                <TableCell className="text-xs">{h.usuario ?? "—"}</TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem registros ainda.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
