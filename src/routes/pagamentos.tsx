import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { pagamentosService } from "@/lib/services/pagamentos.service";
import { pedidosService } from "@/lib/services/pedidos.service";
import { PagamentoStatusBadge } from "@/components/erp/StatusBadge";
import { formatBRL, formatDateTime } from "@/lib/format";
import { FORMA_PAGAMENTO_LABEL, PAGAMENTO_STATUS_LABEL, type FormaPagamento, type PagamentoStatus } from "@/types/erp";

export const Route = createFileRoute("/pagamentos")({
  head: () => ({ meta: [{ title: "Pagamentos — Molduraria ERP" }] }),
  component: PagamentosPage,
});

function PagamentosPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["pagamentos"], queryFn: pagamentosService.listAll });
  const [open, setOpen] = useState(false);
  const [pedidoId, setPedidoId] = useState<string>("");
  const [valor, setValor] = useState("");
  const [forma, setForma] = useState<FormaPagamento>("pix");
  const [status, setStatus] = useState<PagamentoStatus>("pago");

  const pedidos = useQuery({ queryKey: ["pedidos"], queryFn: () => pedidosService.list(), enabled: open });

  const criar = useMutation({
    mutationFn: () => pagamentosService.create({
      pedido_id: pedidoId,
      valor: Number(valor.replace(",", ".")),
      forma_pagamento: forma,
      status,
      data_pagamento: status === "pago" ? new Date().toISOString() : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      toast.success("Pagamento registrado");
      setOpen(false); setPedidoId(""); setValor("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalRecebido = (data ?? []).filter((p) => p.status === "pago").reduce((s, p) => s + Number(p.valor), 0);
  const totalAberto = (data ?? []).filter((p) => p.status === "pendente" || p.status === "parcial").reduce((s, p) => s + Number(p.valor), 0);

  return (
    <AppShell title="Pagamentos">
      <PageHeader
        title="Pagamentos"
        description={`Recebido: ${formatBRL(totalRecebido)} · Em aberto: ${formatBRL(totalAberto)}`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Novo pagamento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Registrar pagamento</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Pedido</Label>
                  <Select value={pedidoId} onValueChange={setPedidoId}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {(pedidos.data ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>#{p.numero_pedido} — {p.cliente?.nome ?? "—"} · {formatBRL(p.valor_total)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Valor</Label>
                  <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label>Forma</Label>
                    <Select value={forma} onValueChange={(v) => setForma(v as FormaPagamento)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(FORMA_PAGAMENTO_LABEL) as FormaPagamento[]).map((f) => (
                          <SelectItem key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as PagamentoStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PAGAMENTO_STATUS_LABEL) as PagamentoStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{PAGAMENTO_STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => criar.mutate()} disabled={!pedidoId || !valor || criar.isPending}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
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
