import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PedidoStatusBadge } from "@/components/erp/StatusBadge";
import { pedidosService } from "@/lib/services/pedidos.service";
import { historicoService } from "@/lib/services/historico.service";
import { whatsappService } from "@/lib/services/whatsapp.service";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { PEDIDO_FLUXO, PEDIDO_STATUS_LABEL, type PedidoStatus } from "@/types/erp";

export function PedidoDetailDialog({ pedidoId, onOpenChange }: { pedidoId: string | null; onOpenChange: (open: boolean) => void }) {
  const open = !!pedidoId;
  const pedido = useQuery({
    queryKey: ["pedido", pedidoId],
    queryFn: () => pedidosService.get(pedidoId!),
    enabled: open,
  });
  const historico = useQuery({
    queryKey: ["historico", "pedido", pedidoId],
    queryFn: () => historicoService.list({ entidade: "pedidos", entidadeId: pedidoId! }),
    enabled: open,
  });
  const whats = useQuery({
    queryKey: ["whatsapp", "pedido", pedidoId],
    queryFn: () => whatsappService.listByPedido(pedidoId!),
    enabled: open,
  });

  const p = pedido.data;
  const statusAtualIdx = p ? PEDIDO_FLUXO.indexOf(p.status as PedidoStatus) : -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {p ? <>Pedido #{p.numero_pedido} <PedidoStatusBadge status={p.status} /></> : "Pedido"}
          </DialogTitle>
        </DialogHeader>

        {p && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Cliente:</span> {p.cliente?.nome ?? "—"}</div>
              <div><span className="text-muted-foreground">Valor:</span> {formatBRL(p.valor_total)}</div>
              <div><span className="text-muted-foreground">Entrega prevista:</span> {formatDate(p.data_entrega_prevista)}</div>
              <div><span className="text-muted-foreground">Entregue em:</span> {formatDate(p.data_entrega_realizada)}</div>
            </div>

            {/* Linha do tempo de produção */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Linha do tempo</CardTitle></CardHeader>
              <CardContent>
                <ol className="flex flex-wrap gap-2 text-xs">
                  {PEDIDO_FLUXO.map((s, idx) => (
                    <li key={s} className={`rounded-full px-3 py-1 ${idx <= statusAtualIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {idx + 1}. {PEDIDO_STATUS_LABEL[s]}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Itens ({p.itens?.length ?? 0})</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {(p.itens ?? []).map((i) => (
                  <div key={i.id} className="flex justify-between border-b border-border/50 pb-1 last:border-0">
                    <span className="truncate">{i.descricao}</span>
                    <span>{Number(i.quantidade)} · {formatBRL(i.valor_total)}</span>
                  </div>
                ))}
                {(!p.itens || p.itens.length === 0) && <p className="text-xs text-muted-foreground">Sem itens.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pagamentos</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {(p.pagamentos ?? []).map((pg) => (
                  <div key={pg.id} className="flex justify-between border-b border-border/50 pb-1 last:border-0">
                    <span>{pg.forma_pagamento} · {pg.status}</span>
                    <span>{formatBRL(pg.valor)} — {formatDate(pg.data_pagamento)}</span>
                  </div>
                ))}
                {(!p.pagamentos || p.pagamentos.length === 0) && <p className="text-xs text-muted-foreground">Sem pagamentos.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-xs">
                {(historico.data ?? []).map((h) => (
                  <div key={h.id} className="flex gap-2">
                    <span className="text-muted-foreground w-32 shrink-0">{formatDateTime(h.created_at)}</span>
                    <span>{h.descricao}</span>
                  </div>
                ))}
                {(historico.data ?? []).length === 0 && <p className="text-muted-foreground">Sem eventos.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Notificações WhatsApp</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-xs">
                {(whats.data ?? []).map((w) => (
                  <div key={w.id} className="flex flex-col border-b border-border/50 pb-1 last:border-0">
                    <span className="text-muted-foreground">{formatDateTime(w.created_at)} · {w.evento} · {w.status}</span>
                    <span>{w.mensagem}</span>
                  </div>
                ))}
                {(whats.data ?? []).length === 0 && <p className="text-muted-foreground">Nenhuma mensagem enfileirada.</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
