import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pedidosService } from "@/lib/services/pedidos.service";
import { PedidoStatusBadge } from "@/components/erp/StatusBadge";
import { formatBRL, formatDate } from "@/lib/format";
import { PEDIDO_STATUS_LABEL, type PedidoStatus } from "@/types/erp";
import { PedidoDetailDialog } from "@/components/erp/PedidoDetailDialog";

export const Route = createFileRoute("/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — Molduraria ERP" }] }),
  component: PedidosPage,
});

function PedidosPage() {
  const { data, isLoading } = useQuery({ queryKey: ["pedidos"], queryFn: () => pedidosService.list() });
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<PedidoStatus | "todos">("todos");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const lista = data ?? [];
    const termo = busca.trim().toLowerCase();
    return lista.filter((p) => {
      if (statusFiltro !== "todos" && p.status !== statusFiltro) return false;
      if (!termo) return true;
      return (
        String(p.numero_pedido).includes(termo) ||
        (p.cliente?.nome ?? "").toLowerCase().includes(termo)
      );
    });
  }, [data, busca, statusFiltro]);

  return (
    <AppShell title="Pedidos">
      <PageHeader title="Pedidos" description="Pedidos confirmados e em fluxo." />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Buscar por número ou cliente…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="sm:max-w-sm"
        />
        <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as PedidoStatus | "todos")}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.keys(PEDIDO_STATUS_LABEL) as PedidoStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{PEDIDO_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
            {filtrados.map((p) => (
              <TableRow key={p.id} className="cursor-pointer" onClick={() => setSelecionado(p.id)}>
                <TableCell className="font-mono">#{p.numero_pedido}</TableCell>
                <TableCell>{p.cliente?.nome ?? "—"}</TableCell>
                <TableCell><PedidoStatusBadge status={p.status} /></TableCell>
                <TableCell className="text-right">{formatBRL(p.valor_total)}</TableCell>
                <TableCell>{formatDate(p.data_entrega_prevista)}</TableCell>
              </TableRow>
            ))}
            {!isLoading && filtrados.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum pedido.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>

      <PedidoDetailDialog pedidoId={selecionado} onOpenChange={(o) => !o && setSelecionado(null)} />
    </AppShell>
  );
}
