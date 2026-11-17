import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle, Pencil } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PedidoStatusBadge, PagamentoStatusBadge } from "@/components/erp/StatusBadge";
import { pedidosService } from "@/lib/services/pedidos.service";
import { historicoService } from "@/lib/services/historico.service";
import { whatsappService } from "@/lib/services/whatsapp.service";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import {
  FORMA_PAGAMENTO_LABEL,
  PEDIDO_FLUXO,
  PEDIDO_STATUS_LABEL,
  type FormaPagamento,
  type PagamentoStatus,
  type PedidoStatus,
} from "@/types/erp";
import { gerarPedidoPDF, gerarMensagemWhatsapp, whatsappUrl } from "@/lib/pdf/pedidoPDF";

export function PedidoDetailDialog({
  pedidoId,
  onOpenChange,
}: {
  pedidoId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
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
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Falha ao gerar PDF");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {p ? (
              <span className="inline-flex items-center gap-2.5">
                <span className="font-mono text-lg font-bold">Pedido #{p.numero_pedido}</span>
                <PedidoStatusBadge status={p.status} />
              </span>
            ) : (
              "Detalhes do Pedido"
            )}
          </DialogTitle>
        </DialogHeader>

        {p && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/80 bg-muted/30 p-3.5 text-xs sm:grid-cols-4">
              <div>
                <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Cliente
                </span>
                <span className="mt-0.5 block font-medium text-foreground truncate">
                  {p.cliente?.nome ?? "—"}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Valor Total
                </span>
                <span className="mt-0.5 block font-mono font-semibold tabular-nums text-foreground">
                  {formatBRL(p.valor_total)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Entrega Prevista
                </span>
                <span className="mt-0.5 block font-medium text-foreground">
                  {formatDate(p.data_entrega_prevista)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Entregue em
                </span>
                <span className="mt-0.5 block font-medium text-foreground">
                  {formatDate(p.data_entrega_realizada)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  void navigate({ to: "/pedidos/novo", search: { id: p.id } });
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar pedido
              </Button>
              <Button size="sm" onClick={() => void handleEnviarWhats()} variant="secondary">
                <MessageCircle className="h-3.5 w-3.5" />
                {p.whatsapp_enviado ? "Reenviar via WhatsApp" : "Enviar pedido via WhatsApp"}
              </Button>
              {p.status === "orcamento" && (
                <Button
                  size="sm"
                  onClick={() => setStatus.mutate("aprovado")}
                  disabled={setStatus.isPending}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Aprovar pedido
                </Button>
              )}
              {p.status === "aprovado" && (
                <Button
                  size="sm"
                  onClick={() => setStatus.mutate("em_producao")}
                  disabled={setStatus.isPending}
                >
                  Iniciar produção
                </Button>
              )}
              {p.status === "em_producao" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus.mutate("aprovado")}
                    disabled={setStatus.isPending}
                  >
                    Voltar para Aprovado
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setStatus.mutate("pronto")}
                    disabled={setStatus.isPending}
                  >
                    Marcar como pronto
                  </Button>
                </>
              )}
              {p.status === "pronto" && (
                <Button
                  size="sm"
                  onClick={() => setStatus.mutate("entregue")}
                  disabled={setStatus.isPending}
                >
                  Marcar como entregue
                </Button>
              )}
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Progresso Operacional
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="flex flex-wrap gap-1.5 text-xs">
                  {PEDIDO_FLUXO.map((s, idx) => (
                    <li
                      key={s}
                      className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                        idx <= statusAtualIdx
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {idx + 1}. {PEDIDO_STATUS_LABEL[s]}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Itens ({p.itens?.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs sm:text-sm">
                {(p.itens ?? []).map((i) => {
                  const md = i.metadados as { entrada?: { imagens?: string[] } } | null | undefined;
                  const imgs = md?.entrada?.imagens ?? [];
                  return (
                    <div
                      key={i.id}
                      className="border-b border-border/60 pb-2 last:border-0 last:pb-0"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-foreground">{i.descricao}</span>
                        <span className="shrink-0 font-mono text-xs tabular-nums">
                          {Number(i.quantidade)}× · <strong>{formatBRL(i.valor_total)}</strong>
                        </span>
                      </div>
                      {imgs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {imgs.map((src, ii) => (
                            <a key={ii} href={src} target="_blank" rel="noreferrer">
                              <img
                                src={src}
                                alt={`Foto ${ii + 1}`}
                                className="h-14 w-14 rounded-md border object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {(!p.itens || p.itens.length === 0) && (
                  <p className="text-xs text-muted-foreground">Sem itens registrados.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Pagamentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  {(p.pagamentos ?? []).map((pg) => (
                    <div
                      key={pg.id}
                      className="flex items-center justify-between border-b border-border/60 pb-1.5 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {FORMA_PAGAMENTO_LABEL[pg.forma_pagamento as FormaPagamento] ??
                            pg.forma_pagamento}
                        </span>
                        <PagamentoStatusBadge status={pg.status as PagamentoStatus} />
                      </div>
                      <span className="font-mono tabular-nums">
                        {formatBRL(pg.valor)} · {formatDate(pg.data_pagamento)}
                      </span>
                    </div>
                  ))}
                  {(!p.pagamentos || p.pagamentos.length === 0) && (
                    <p className="text-xs text-muted-foreground">Sem pagamentos registrados.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Notificações WhatsApp
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 text-xs">
                  {(whats.data ?? []).map((w) => (
                    <div
                      key={w.id}
                      className="flex flex-col border-b border-border/60 pb-1.5 last:border-0"
                    >
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{formatDateTime(w.created_at)}</span>
                        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                          {w.status}
                        </Badge>
                      </div>
                      <span className="mt-0.5 line-clamp-2 text-foreground">{w.mensagem}</span>
                    </div>
                  ))}
                  {(whats.data ?? []).length === 0 && (
                    <p className="text-muted-foreground">Nenhuma mensagem enfileirada.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Histórico de Eventos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-xs">
                {(historico.data ?? []).map((h) => (
                  <div
                    key={h.id}
                    className="flex gap-3 border-b border-border/40 pb-1 last:border-0"
                  >
                    <span className="w-32 shrink-0 font-mono text-[11px] text-muted-foreground">
                      {formatDateTime(h.created_at)}
                    </span>
                    <span className="text-foreground">{h.descricao}</span>
                  </div>
                ))}
                {(historico.data ?? []).length === 0 && (
                  <p className="text-muted-foreground">Sem eventos registrados.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
