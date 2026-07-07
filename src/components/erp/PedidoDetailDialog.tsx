import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PedidoStatusBadge } from "@/components/erp/StatusBadge";
import { pedidosService } from "@/lib/services/pedidos.service";
import { historicoService } from "@/lib/services/historico.service";
import { whatsappService } from "@/lib/services/whatsapp.service";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import { PEDIDO_FLUXO, PEDIDO_STATUS_LABEL, type PedidoStatus } from "@/types/erp";
import { gerarPedidoPDF, gerarMensagemWhatsapp, whatsappUrl } from "@/lib/pdf/pedidoPDF";

export function PedidoDetailDialog({ pedidoId, onOpenChange }: { pedidoId: string | null; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
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

  const setStatus = useMutation({
    mutationFn: async (s: PedidoStatus) => {
      if (!p) throw new Error("Pedido não carregado");
      const pagamentos = p.pagamentos ?? [];
      const temPagamento = pagamentos.some(
        (pg) => Number(pg.valor) > 0 && pg.status !== "estornado" && pg.status !== "cancelado",
      );
      if (s === "aprovado") {
        if (!p.forma_pagamento) {
          throw new Error("Selecione a forma de pagamento antes de aprovar o pedido.");
        }
        if (!temPagamento) {
          throw new Error(
            "Para aprovar um pedido é necessário informar o Sinal (maior que zero) ou marcar como Pago.",
          );
        }
      }
      if (s === "orcamento" && temPagamento) {
        const ok = window.confirm(
          "Pedidos em Orçamento não podem possuir pagamento registrado. Deseja remover os pagamentos e voltar para Orçamento?",
        );
        if (!ok) throw new Error("Alteração cancelada.");
        for (const pg of pagamentos) {
          await (await import("@/lib/services/pagamentos.service")).pagamentosService.remove(pg.id);
        }
      }
      return pedidosService.setStatus(pedidoId!, s);
    },
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["pedido", pedidoId] });
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleEnviarWhats = async () => {
    if (!p) return;
    try {
      const { blob, filename } = gerarPedidoPDF({
        pedido: p,
        cliente: p.cliente,
        itens: p.itens ?? [],
      });
      // baixa o PDF localmente para o usuário anexar no WhatsApp
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const msg = gerarMensagemWhatsapp({
        pedido: p,
        cliente: p.cliente,
        itens: p.itens ?? [],
      });
      const tel = p.cliente?.whatsapp ?? p.cliente?.telefone ?? "";
      window.open(whatsappUrl(tel, msg), "_blank");

      await pedidosService.marcarWhatsappEnviado(p.id);
      qc.invalidateQueries({ queryKey: ["pedido", pedidoId] });
      toast.success("PDF baixado e WhatsApp aberto.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar PDF");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {p ? <span className="inline-flex items-center gap-2">Pedido #{p.numero_pedido} <PedidoStatusBadge status={p.status} /></span> : "Pedido"}
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

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleEnviarWhats} variant="default">
                <MessageCircle className="mr-1 h-4 w-4" />
                {p.whatsapp_enviado ? "Reenviar via WhatsApp" : "Enviar pedido via WhatsApp"}
              </Button>
              {p.status === "orcamento" && (
                <Button size="sm" onClick={() => setStatus.mutate("aprovado")} disabled={setStatus.isPending}>
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Aprovar pedido
                </Button>
              )}
              {p.status === "aprovado" && (
                <Button size="sm" onClick={() => setStatus.mutate("em_producao")} disabled={setStatus.isPending}>
                  Iniciar produção
                </Button>
              )}
              {p.status === "em_producao" && (
                <Button size="sm" onClick={() => setStatus.mutate("pronto")} disabled={setStatus.isPending}>
                  Marcar como pronto
                </Button>
              )}
              {p.status === "pronto" && (
                <Button size="sm" onClick={() => setStatus.mutate("entregue")} disabled={setStatus.isPending}>
                  Marcar como entregue
                </Button>
              )}
            </div>

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
              <CardContent className="space-y-2 text-sm">
                {(p.itens ?? []).map((i) => {
                  const imgs = (((i as any).metadados)?.entrada?.imagens ?? []) as string[];
                  return (
                    <div key={i.id} className="border-b border-border/50 pb-2 last:border-0">
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{i.descricao}</span>
                        <span className="shrink-0">{Number(i.quantidade)} · {formatBRL(i.valor_total)}</span>
                      </div>
                      {imgs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {imgs.map((src, ii) => (
                            <a key={ii} href={src} target="_blank" rel="noreferrer">
                              <img src={src} alt={`Foto ${ii + 1}`} className="h-14 w-14 rounded border object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
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
