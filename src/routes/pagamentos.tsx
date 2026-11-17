import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Clock, CreditCard, Plus, Receipt } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { PageToolbar } from "@/components/erp/PageToolbar";
import { EmptyState } from "@/components/erp/EmptyState";
import { TableLoadingRows } from "@/components/erp/LoadingState";
import { PagamentoStatusBadge } from "@/components/erp/StatusBadge";
import { PedidoDetailDialog } from "@/components/erp/PedidoDetailDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { pagamentosService } from "@/lib/services/pagamentos.service";
import { pedidosService } from "@/lib/services/pedidos.service";
import { formatBRL, formatDateTime } from "@/lib/format";
import {
  FORMA_PAGAMENTO_LABEL,
  PAGAMENTO_STATUS_LABEL,
  type FormaPagamento,
  type PagamentoStatus,
} from "@/types/erp";

export const Route = createFileRoute("/pagamentos")({
  head: () => ({ meta: [{ title: "Pagamentos — Art Frame Hub" }] }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["pagamentos"],
    queryFn: pagamentosService.listAll,
  });
  const [open, setOpen] = useState(false);
  const [pedidoId, setPedidoId] = useState<string>("");
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [status, setStatus] = useState<PagamentoStatus>("pago");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PagamentoStatus | "todos">("todos");
  const [formaFilter, setFormaFilter] = useState<FormaPagamento | "todas">("todas");
  const [selectedPedidoId, setSelectedPedidoId] = useState<string | null>(null);

  const pedidos = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => pedidosService.list(),
    enabled: open,
  });

  const criar = useMutation({
    mutationFn: () =>
      pagamentosService.create({
        pedido_id: pedidoId,
        valor: Number(valor.replace(",", ".")),
        forma_pagamento: forma,
        status,
        data_pagamento: status === "pago" ? new Date().toISOString() : null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      toast.success("Pagamento registrado");
      setOpen(false);
      setPedidoId("");
      setValor("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalRecebido = useMemo(
    () => (data ?? []).filter((p) => p.status === "pago").reduce((s, p) => s + Number(p.valor), 0),
    [data],
  );
  const totalAberto = useMemo(
    () =>
      (data ?? [])
        .filter((p) => p.status === "pendente" || p.status === "parcial")
        .reduce((s, p) => s + Number(p.valor), 0),
    [data],
  );

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((p) => {
      if (statusFilter !== "todos" && p.status !== statusFilter) return false;
      if (formaFilter !== "todas" && p.forma_pagamento !== formaFilter) return false;
      if (!q) return true;
      const num = String(p.pedido?.numero_pedido ?? "");
      const cli = (p.pedido?.cliente?.nome ?? "").toLowerCase();
      return num.includes(q) || cli.includes(q);
    });
  }, [data, search, statusFilter, formaFilter]);

  return (
    <AppShell title="Pagamentos">
      <PageHeader
        title="Pagamentos e Recebíveis"
        description="Controle financeiro de sinais, quitações, parcelas e situação de pagamento por pedido."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Registrar pagamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar pagamento</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Pedido</Label>
                  <Select value={pedidoId} onValueChange={setPedidoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um pedido…" />
                    </SelectTrigger>
                    <SelectContent>
                      {(pedidos.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          #{p.numero_pedido} — {p.cliente?.nome ?? "—"} · {formatBRL(p.valor_total)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Valor (R$)</Label>
                  <Input
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Forma de pagamento</Label>
                    <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamento)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FORMA_PAGAMENTO_LABEL) as FormaPagamento[]).map((f) => (
                          <SelectItem key={f} value={f}>
                            {FORMA_PAGAMENTO_LABEL[f]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as PagamentoStatus)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PAGAMENTO_STATUS_LABEL) as PagamentoStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>
                            {PAGAMENTO_STATUS_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => criar.mutate()}
                  disabled={!pedidoId || !valor || criar.isPending}
                >
                  {criar.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Resumo Financeiro */}
      <div className="mb-5 grid gap-3.5 sm:grid-cols-3">
        <Card className="border-emerald-500/20 bg-emerald-500/[0.02]">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Total Recebido (Pago)
              </span>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatBRL(totalRecebido)}
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/[0.02]">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Em Aberto / Pendente
              </span>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                {formatBRL(totalAberto)}
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-600">
              <Clock className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                Lançamentos Exibidos
              </span>
              <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-foreground">
                {filtered.length}
              </div>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Receipt className="h-4 w-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      <PageToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nº do pedido ou cliente…"
        meta={
          <span>
            <strong className="text-foreground">{filtered.length}</strong> registro(s)
          </span>
        }
      >
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as PagamentoStatus | "todos")}
        >
          <SelectTrigger className="h-8 w-full text-xs sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.keys(PAGAMENTO_STATUS_LABEL) as PagamentoStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {PAGAMENTO_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={formaFilter}
          onValueChange={(v) => setFormaFilter(v as FormaPagamento | "todas")}
        >
          <SelectTrigger className="h-8 w-full text-xs sm:w-48">
            <SelectValue placeholder="Forma de pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as formas</SelectItem>
            {(Object.keys(FORMA_PAGAMENTO_LABEL) as FormaPagamento[]).map((f) => (
              <SelectItem key={f} value={f}>
                {FORMA_PAGAMENTO_LABEL[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageToolbar>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Forma</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Data de Pagamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableLoadingRows columns={6} rows={6} />}

            {!isLoading &&
              filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className={p.pedido_id ? "cursor-pointer" : undefined}
                  onClick={() => p.pedido_id && setSelectedPedidoId(p.pedido_id)}
                >
                  <TableCell className="font-mono text-xs font-semibold text-primary">
                    #{p.pedido?.numero_pedido ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {p.pedido?.cliente?.nome ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {FORMA_PAGAMENTO_LABEL[p.forma_pagamento]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <PagamentoStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                    {formatBRL(p.valor)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(p.data_pagamento)}
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-0">
                  <EmptyState
                    icon={CreditCard}
                    title="Nenhum lançamento financeiro encontrado"
                    description="Registre um novo pagamento ou ajuste os filtros selecionados."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <PedidoDetailDialog
        pedidoId={selectedPedidoId}
        onOpenChange={(o) => !o && setSelectedPedidoId(null)}
      />
    </AppShell>
  );
}
