import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
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
import { ordemProducaoService } from "@/lib/services/ordem-producao.service";
import { PedidoDetailDialog } from "@/components/erp/PedidoDetailDialog";
import { formatDate } from "@/lib/format";
import { PEDIDO_FLUXO, type PedidoStatus } from "@/types/erp";
import { cn } from "@/lib/utils";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { pagamentosService } from "@/lib/services/pagamentos.service";

export const Route = createFileRoute("/producao")({
  head: () => ({ meta: [{ title: "Produção — Molduraria ERP" }] }),
  component: ProducaoPage,
});

const COLUMNS: { status: PedidoStatus; label: string }[] = [
  { status: "orcamento", label: "Orçamento" },
  { status: "aprovado", label: "Aprovado" },
  { status: "em_producao", label: "Em produção" },
  { status: "pronto", label: "Pronto" },
];

function proximoStatus(atual: PedidoStatus): PedidoStatus | null {
  const i = PEDIDO_FLUXO.indexOf(atual);
  if (i < 0 || i >= PEDIDO_FLUXO.length - 1) return null;
  return PEDIDO_FLUXO[i + 1];
}

interface ActionDefinition {
  label: string;
  variant?: "default" | "outline" | "destructive" | "ghost";
  minSelection: number;
  maxSelection?: number;
  actionKey: "aprovar" | "arquivar" | "produzir" | "voltar" | "pronto" | "entregue";
}

const KANBAN_ACTIONS_CONFIG: Record<PedidoStatus, ActionDefinition[]> = {
  orcamento: [
    { label: "Aprovar", variant: "default", minSelection: 1, maxSelection: 1, actionKey: "aprovar" },
    { label: "Arquivar selecionados", variant: "destructive", minSelection: 1, actionKey: "arquivar" },
  ],
  aprovado: [
    { label: "Iniciar produção", variant: "default", minSelection: 1, actionKey: "produzir" },
    { label: "Voltar para Orçamento", variant: "outline", minSelection: 1, actionKey: "voltar" },
  ],
  em_producao: [
    { label: "Finalizar produção", variant: "default", minSelection: 1, actionKey: "pronto" },
    { label: "Voltar para Aprovado", variant: "outline", minSelection: 1, actionKey: "voltar" },
  ],
  pronto: [],
  entregue: [],
};

type SelecaoPorColuna = Partial<Record<PedidoStatus, Set<string>>>;

function ProducaoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["pedidos"], queryFn: () => pedidosService.list() });
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [selecao, setSelecao] = useState<SelecaoPorColuna>({});
  /** Estado explícito da coluna ativa para seleção múltipla.
   *  Definido ao marcar o primeiro pedido; limpo quando a seleção zera.
   *  Reutilizável pelas próximas etapas (ações em lote). */
  const [activeSelectionStatus, setActiveSelectionStatus] = useState<PedidoStatus | null>(null);
  // Estado genérico para controle do diálogo de confirmação unificado (AlertDialog)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmDialogConfig, setConfirmDialogConfig] = useState<{
    title: string;
    description: string;
    actionLabel: string;
    actionVariant?: "default" | "destructive";
    onConfirm: () => void;
  } | null>(null);

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
      const db = new Set(prev[status] ?? []);
      if (db.has(id)) db.delete(id);
      else db.add(id);
      const proximo: SelecaoPorColuna = { ...prev };
      if (db.size === 0) delete proximo[status];
      else proximo[status] = db;
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

  const arquivarLote = useMutation({
    mutationFn: async (ids: string[]) => {
      // Revalida se todos os IDs selecionados continuam no status 'orcamento'
      const validos = ids.filter((id) => statusPorId.get(id) === "orcamento");
      const descartados = ids.length - validos.length;
      if (descartados > 0) {
        toast.info(`${descartados} pedido(s) foram alterados por outro usuário e descartados.`);
      }
      if (validos.length === 0) {
        throw new Error("Nenhum pedido válido restante para arquivar.");
      }
      return pedidosService.arquivarEmLote(validos);
    },
    onSuccess: () => {
      toast.success("Pedidos arquivados com sucesso");
      limparSelecaoColuna("orcamento");
      qc.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const finalizarLote = useMutation({
    mutationFn: async (ids: string[]) => {
      const validos = ids.filter((id) => statusPorId.get(id) === "em_producao");
      const descartados = ids.length - validos.length;
      if (descartados > 0) {
        toast.info(`${descartados} pedido(s) não estão mais no status Em Produção e foram ignorados.`);
      }
      if (validos.length === 0) {
        throw new Error("Nenhum pedido válido restante para finalizar.");
      }
      return pedidosService.finalizarProducaoEmLote(validos);
    },
    onSuccess: () => {
      toast.success("Produção finalizada com sucesso");
      limparSelecaoColuna("em_producao");
      qc.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voltarParaAprovado = useMutation({
    mutationFn: async (ids: string[]) => {
      const validos = ids.filter((id) => statusPorId.get(id) === "em_producao");
      const descartados = ids.length - validos.length;
      if (descartados > 0) {
        toast.info(`${descartados} pedido(s) não estão mais no status Em Produção e foram ignorados.`);
      }
      if (validos.length === 0) {
        throw new Error("Nenhum pedido válido restante para retornar.");
      }
      return pedidosService.voltarParaAprovadoEmLote(validos);
    },
    onSuccess: () => {
      toast.success("Pedidos retornados para Aprovado");
      limparSelecaoColuna("em_producao");
      qc.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const produzirLote = useMutation({
    mutationFn: async (ids: string[]) => {
      const validos = ids.filter((id) => statusPorId.get(id) === "aprovado");
      const descartados = ids.length - validos.length;
      if (descartados > 0) {
        toast.info(`${descartados} pedido(s) não estão mais com status Aprovado e foram ignorados.`);
      }
      if (validos.length === 0) {
        throw new Error("Nenhum pedido válido restante para produzir.");
      }
      return ordemProducaoService.create({ pedidosIds: validos });
    },
    onSuccess: (opId: string) => {
      toast.success("Ordem de Produção criada com sucesso!");
      limparSelecaoColuna("aprovado");
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      navigate({ to: "/producao/ordens/$id", params: { id: opId } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voltarLote = useMutation({
    mutationFn: async (ids: string[]) => {
      const validos = ids.filter((id) => statusPorId.get(id) === "aprovado");
      const descartados = ids.length - validos.length;
      if (descartados > 0) {
        toast.info(`${descartados} pedido(s) não estão mais com status Aprovado e foram ignorados.`);
      }
      if (validos.length === 0) {
        throw new Error("Nenhum pedido válido restante para retornar.");
      }

      // Orquestração de Rollback:
      // 1. Remove os pagamentos de cada pedido para evitar violação de trigger database
      for (const id of validos) {
        const pCompleto = await pedidosService.get(id);
        if (pCompleto?.pagamentos) {
          for (const pg of pCompleto.pagamentos) {
            await pagamentosService.remove(pg.id);
          }
        }
      }
      // 2. Atualiza o status dos pedidos de volta para 'orcamento'
      return pedidosService.setStatusLote(validos, "orcamento");
    },
    onSuccess: () => {
      toast.success("Pedidos retornados para orçamento");
      limparSelecaoColuna("aprovado");
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleActionClick = (action: ActionDefinition, status: PedidoStatus, selecionados: Set<string>) => {
    const ids = Array.from(selecionados);
    if (action.actionKey === "aprovar") {
      if (ids.length === 1) {
        setSelecionado(ids[0]);
      }
    } else if (action.actionKey === "arquivar") {
      setConfirmDialogConfig({
        title: "Arquivar pedidos?",
        description: `Deseja arquivar os ${ids.length} pedidos selecionados? Eles serão retirados do fluxo operacional ativo do Kanban.`,
        actionLabel: "Arquivar",
        actionVariant: "destructive",
        onConfirm: () => arquivarLote.mutate(ids),
      });
      setConfirmDialogOpen(true);
    } else if (action.actionKey === "produzir") {
      setConfirmDialogConfig({
        title: "Iniciar produção?",
        description: `Deseja iniciar a produção de ${ids.length} pedido(s) selecionados?`,
        actionLabel: "Confirmar",
        actionVariant: "default",
        onConfirm: () => produzirLote.mutate(ids),
      });
      setConfirmDialogOpen(true);
    } else if (action.actionKey === "voltar") {
      if (status === "aprovado") {
        setConfirmDialogConfig({
          title: "Retornar pedidos para Orçamento?",
          description: `Você está prestes a retornar ${ids.length} pedido(s) selecionados para o status "Orçamento". ATENÇÃO: Todos os registros de pagamentos e sinal associados a estes pedidos serão removidos fisicamente de forma irreversível do Financeiro.`,
          actionLabel: "Confirmar Retorno",
          actionVariant: "destructive",
          onConfirm: () => voltarLote.mutate(ids),
        });
        setConfirmDialogOpen(true);
      } else if (status === "em_producao") {
        setConfirmDialogConfig({
          title: "Retornar pedidos para Aprovado?",
          description: `Confirma o retorno dos ${ids.length} pedidos selecionados para o status Aprovado.`,
          actionLabel: "Confirmar Retorno",
          actionVariant: "default",
          onConfirm: () => voltarParaAprovado.mutate(ids),
        });
        setConfirmDialogOpen(true);
      }
    } else if (action.actionKey === "pronto") {
      setConfirmDialogConfig({
        title: "Finalizar produção?",
        description: `Confirma a conclusão da produção dos ${ids.length} pedidos selecionados e sua movimentação para o status Pronto.`,
        actionLabel: "Finalizar Produção",
        actionVariant: "default",
        onConfirm: () => finalizarLote.mutate(ids),
      });
      setConfirmDialogOpen(true);
    }
  };

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
      <nav className="-mt-2 mb-4 flex gap-1 border-b border-border">
        <Link
          to="/producao"
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            "border-primary text-foreground"
          )}
        >
          Fluxo de Produção
        </Link>
        <Link
          to="/producao/ordens"
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Ordens de Produção
        </Link>
      </nav>
      <PageHeader title="Fluxo de produção" description="Visão Kanban dos pedidos aprovados em produção." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = pedidos.filter((p) => p.status === col.status);
          const selecionados = selecao[col.status] ?? new Set<string>();
          const qtdSelecionados = selecionados.size;
          const bloqueado = statusAtivo !== null && statusAtivo !== col.status;
          const configActions = KANBAN_ACTIONS_CONFIG[col.status] ?? [];

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
                    className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-2 text-xs"
                    role="toolbar"
                    aria-label={`Ações para ${col.label}`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <span>
                        {qtdSelecionados} selecionado{qtdSelecionados > 1 ? "s" : ""}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => limparSelecaoColuna(col.status)}
                        aria-label="Cancelar seleção"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    {configActions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-primary/20">
                        {configActions.map((act) => {
                          const disableBtn =
                            qtdSelecionados < act.minSelection ||
                            (act.maxSelection !== undefined && qtdSelecionados > act.maxSelection);
                          return (
                            <Button
                              key={act.actionKey}
                              size="sm"
                              variant={act.variant ?? "default"}
                              className="h-7 text-[10px] px-2 py-0"
                              disabled={disableBtn || arquivarLote.isPending}
                              onClick={() => handleActionClick(act, col.status, selecionados)}
                            >
                              {act.label}
                            </Button>
                          );
                        })}
                      </div>
                    )}
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

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialogConfig?.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {confirmDialogConfig?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDialogConfig(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={confirmDialogConfig?.actionVariant === "destructive" ? "bg-destructive hover:bg-destructive/95" : undefined}
              onClick={() => {
                confirmDialogConfig?.onConfirm();
                setConfirmDialogOpen(false);
              }}
            >
              {confirmDialogConfig?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
