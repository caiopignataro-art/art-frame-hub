import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Eye, Pencil, Plus, ShoppingBag } from "lucide-react";
import { PageHeader } from "@/components/erp/PageHeader";
import { PageToolbar } from "@/components/erp/PageToolbar";
import { EmptyState } from "@/components/erp/EmptyState";
import { ErrorState } from "@/components/erp/ErrorState";
import { TableLoadingRows } from "@/components/erp/LoadingState";
import { PedidoStatusBadge } from "@/components/erp/StatusBadge";
import { PedidoDetailDialog } from "@/components/erp/PedidoDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pedidosService } from "@/lib/services/pedidos.service";
import { formatBRL, formatDate } from "@/lib/format";
import { PEDIDO_STATUS_LABEL, type PedidoStatus } from "@/types/erp";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pedidos/")({
  head: () => ({ meta: [{ title: "Pedidos — Art Frame Hub" }] }),
  component: PedidosPage,
});

const STATUS_TABS: { value: PedidoStatus | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "orcamento", label: "Orçamento" },
  { value: "aprovado", label: "Aprovado" },
  { value: "em_producao", label: "Em produção" },
  { value: "pronto", label: "Pronto" },
  { value: "entregue", label: "Entregue" },
];

function PedidosPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => pedidosService.list(),
  });
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<PedidoStatus | "todos">("todos");
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const counts = useMemo(() => {
    const map: Record<string, number> = { todos: (data ?? []).length };
    for (const p of data ?? []) {
      map[p.status] = (map[p.status] ?? 0) + 1;
    }
    return map;
  }, [data]);

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

  const totalFiltrado = useMemo(
    () => filtrados.reduce((acc, p) => acc + Number(p.valor_total), 0),
    [filtrados],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pedidos"
        description="Gestão comercial de pedidos desde o orçamento inicial até a fabricação e entrega ao cliente."
        badge={
          data ? (
            <Badge variant="secondary" className="font-mono text-xs tabular-nums">
              {data.length}
            </Badge>
          ) : undefined
        }
        actions={
          <Button asChild size="sm">
            <Link to="/pedidos/novo" search={{}}>
              <Plus className="h-4 w-4" />
              Novo pedido
            </Link>
          </Button>
        }
      />

      {isError && (
        <ErrorState
          title="Falha ao carregar pedidos"
          description="Não foi possível consultar a listagem de pedidos."
          onRetry={() => void refetch()}
        />
      )}

      {/* Filtros rápidos por status */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((t) => {
          const active = statusFiltro === t.value;
          const cnt = counts[t.value] ?? 0;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setStatusFiltro(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/80 bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span>{t.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0 font-mono text-[10px] tabular-nums",
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      <PageToolbar
        search={busca}
        onSearchChange={setBusca}
        searchPlaceholder="Buscar por nº do pedido ou nome do cliente…"
        meta={
          <span>
            <strong className="text-foreground">{filtrados.length}</strong> pedido(s) · Total:{" "}
            <strong className="font-mono text-foreground">{formatBRL(totalFiltrado)}</strong>
          </span>
        }
      >
        <Select
          value={statusFiltro}
          onValueChange={(v) => setStatusFiltro(v as PedidoStatus | "todos")}
        >
          <SelectTrigger className="h-8 w-full text-xs sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.keys(PEDIDO_STATUS_LABEL) as PedidoStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {PEDIDO_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageToolbar>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Nº Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Entrega Prevista</TableHead>
              <TableHead className="text-right">Valor Total</TableHead>
              <TableHead className="w-28 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableLoadingRows columns={6} rows={6} />}

            {!isLoading &&
              filtrados.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => setSelecionado(p.id)}
                >
                  <TableCell className="font-mono text-xs font-semibold text-primary">
                    #{p.numero_pedido}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {p.cliente?.nome ?? "—"}
                  </TableCell>
                  <TableCell>
                    <PedidoStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      {formatDate(p.data_entrega_prevista)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                    {formatBRL(p.valor_total)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Detalhes do pedido"
                        onClick={() => setSelecionado(p.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button asChild size="icon" variant="ghost" title="Editar pedido">
                        <Link to="/pedidos/novo" search={{ id: p.id }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && filtrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={ShoppingBag}
                    title="Nenhum pedido encontrado"
                    description="Crie um novo pedido ou ajuste os filtros de status e busca."
                    action={
                      <Button asChild size="sm">
                        <Link to="/pedidos/novo" search={{}}>
                          <Plus className="h-4 w-4" />
                          Novo pedido
                        </Link>
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <PedidoDetailDialog pedidoId={selecionado} onOpenChange={(o) => !o && setSelecionado(null)} />
    </div>
  );
}
