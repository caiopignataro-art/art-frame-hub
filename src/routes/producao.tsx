import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, X } from "lucide-react";
import { pedidosService } from "@/lib/services/pedidos.service";
import { PedidoDetailDialog } from "@/components/erp/PedidoDetailDialog";
import { formatDate } from "@/lib/format";
import { PEDIDO_FLUXO, type PedidoStatus } from "@/types/erp";

export const Route = createFileRoute("/producao")({
  head: () => ({ meta: [{ title: "Produção — Molduraria ERP" }] }),
  component: ProducaoPage,
});

const COLUMNS: { status: PedidoStatus; label: string }[] = [
  { status: "aprovado", label: "Aprovado" },
  { status: "em_producao", label: "Em produção" },
  { status: "pronto", label: "Pronto" },
];

function proximoStatus(atual: PedidoStatus): PedidoStatus | null {
  const i = PEDIDO_FLUXO.indexOf(atual);
  if (i < 0 || i >= PEDIDO_FLUXO.length - 1) return null;
  return PEDIDO_FLUXO[i + 1];
}

/**
 * Seleção múltipla por coluna do Kanban.
 * Cada coluna (status) mantém seu próprio Set de ids selecionados,
 * independente das demais. A infraestrutura fica pronta para as
 * próximas etapas (ações em lote) — nesta etapa, nenhuma ação é
 * executada em cima da seleção.
 */
type SelecaoPorColuna = Partial<Record<PedidoStatus, Set<string>>>;

function ProducaoPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["pedidos"], queryFn: () => pedidosService.list() });
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [selecao, setSelecao] = useState<SelecaoPorColuna>({});
  /** Estado explícito da coluna ativa para seleção múltipla.
   *  Definido ao marcar o primeiro pedido; limpo quando a seleção zera.
   *  Reutilizável pelas próximas etapas (ações em lote). */
  const [activeSelectionStatus, setActiveSelectionStatus] = useState<PedidoStatus | null>(null);

  const pedidos = data ?? [];

  /** Mapa id -> status atual, usado para limpar seleções cujos pedidos
   *  não pertencem mais àquela coluna (ex.: após avançar de status). */
  const statusPorId = useMemo(() => {
    const m = new Map<string, PedidoStatus>();
    for (const p of pedidos) m.set(p.id, p.status);
    return m;
  }, [pedidos]);

  // Ao mover um pedido para outra coluna, remove-o da seleção da coluna de origem.
  useEffect(() => {
    setSelecao((prev) => {
      let mudou = false;
      const proximo: SelecaoPorColuna = {};
      for (const [status, ids] of Object.entries(prev) as [PedidoStatus, Set<string>][]) {
        if (!ids || ids.size === 0) continue;
        const filtrado = new Set<string>();
        for (const id of ids) {
          if (statusPorId.get(id) === status) filtrado.add(id);
          else mudou = true;
        }
        if (filtrado.size > 0) proximo[status] = filtrado;
      }
      return mudou ? proximo : prev;
    });
  }, [statusPorId]);

  const toggleSelecao = (status: PedidoStatus, id: string) => {
    setSelecao((prev) => {
      const atual = new Set(prev[status] ?? []);
      if (atual.has(id)) atual.delete(id);
      else atual.add(id);
      const proximo: SelecaoPorColuna = { ...prev };
      if (atual.size === 0) delete proximo[status];
      else proximo[status] = atual;
      return proximo;
    });
  };

  const limparSelecaoColuna = (status: PedidoStatus) => {
    setSelecao((prev) => {
      if (!prev[status]) return prev;
      const proximo = { ...prev };
      delete proximo[status];
      return proximo;
    });
  };

  const avancar = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PedidoStatus }) => pedidosService.setStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      toast.success("Status atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /** Sincroniza o estado explícito `activeSelectionStatus` com a seleção atual.
   *  - Ao passar de zero para ≥1 selecionado, adota o status da coluna que iniciou a seleção.
   *  - Ao zerar a seleção (via limpar, mover pedido de coluna, etc.), reseta para null. */
  useEffect(() => {
    const statusComSelecao = (Object.keys(selecao) as PedidoStatus[]).find(
      (s) => (selecao[s]?.size ?? 0) > 0,
    ) ?? null;
    setActiveSelectionStatus((prev) => {
      if (statusComSelecao === null) return null;
      if (prev !== null && (selecao[prev]?.size ?? 0) > 0) return prev;
      return statusComSelecao;
    });
  }, [selecao]);

  const statusAtivo = activeSelectionStatus;

  return (
    <AppShell title="Produção">
      <PageHeader title="Fluxo de produção" description="Visão Kanban dos pedidos aprovados em produção." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {COLUMNS.map((col) => {
          const items = pedidos.filter((p) => p.status === col.status);
          const selecionados = selecao[col.status] ?? new Set<string>();
          const qtdSelecionados = selecionados.size;
          const bloqueado = statusAtivo !== null && statusAtivo !== col.status;

          return (
            <Card key={col.status}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{col.label}</span>
                  <span className="rounded-full bg-muted px-2 text-xs text-muted-foreground">{items.length}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {qtdSelecionados > 0 && (
                  <div
                    className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-2 py-1.5 text-xs"
                    role="toolbar"
                    aria-label={`Ações para ${col.label}`}
                  >
                    <span className="font-medium">
                      {qtdSelecionados} selecionado{qtdSelecionados > 1 ? "s" : ""}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2"
                      onClick={() => limparSelecaoColuna(col.status)}
                      aria-label="Cancelar seleção"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                {items.length === 0 && <p className="text-xs text-muted-foreground">Nenhum.</p>}
                {items.map((p) => {
                  const next = proximoStatus(p.status);
                  const checked = selecionados.has(p.id);
                  return (
                    <div
                      key={p.id}
                      className="rounded-md border border-border bg-card p-3 text-sm"
                      data-selected={checked || undefined}
                    >
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleSelecao(col.status, p.id)}
                          aria-label={`Selecionar pedido ${p.numero_pedido}`}
                          className="mt-0.5"
                          disabled={bloqueado && !checked}
                          aria-disabled={bloqueado && !checked}
                          title={
                            bloqueado && !checked
                              ? "Só é possível selecionar pedidos da mesma coluna"
                              : undefined
                          }
                        />
                        <button className="text-left flex-1" onClick={() => setSelecionado(p.id)}>
                          <div className="font-mono text-xs text-muted-foreground">#{p.numero_pedido}</div>
                          <div className="font-medium">{p.cliente?.nome ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">Entrega: {formatDate(p.data_entrega_prevista)}</div>
                        </button>
                      </div>

                      {next && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 w-full"
                          onClick={() => avancar.mutate({ id: p.id, status: next })}
                          disabled={avancar.isPending}
                        >
                          Avançar <ChevronRight className="ml-1 h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <PedidoDetailDialog pedidoId={selecionado} onOpenChange={(o) => !o && setSelecionado(null)} />
    </AppShell>
  );
}
