import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Archive, ClipboardList, MoreHorizontal, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/erp/PageHeader";
import { PageToolbar } from "@/components/erp/PageToolbar";
import { EmptyState } from "@/components/erp/EmptyState";
import { TableLoadingRows } from "@/components/erp/LoadingState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ordemProducaoService } from "@/lib/services/ordem-producao.service";
import { formatOPNumber, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrdemProducaoStatus } from "@/lib/constants/ordem-producao-status";
import {
  getOrdemProducaoStatusLabel,
  getOrdemProducaoStatusStyle,
} from "@/lib/constants/ordem-producao-status";
import { productionKeys, productionCache } from "@/lib/services/production-cache";
import { ProductionErrorAlert } from "@/components/production/ProductionErrorAlert";

export const Route = createFileRoute("/producao/ordens/")({
  head: () => ({ meta: [{ title: "Ordens de Produção — Art Frame Hub" }] }),
  component: OrdensProducaoPage,
});

type FilterType = "Todas" | OrdemProducaoStatus;

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: "aberta", label: "Em Preparação" },
  { value: "concluida", label: "Concluída" },
  { value: "arquivada", label: "Arquivada" },
  { value: "cancelada", label: "Cancelada" },
  { value: "Todas", label: "Todas" },
];

function OrdensProducaoPage() {
  const [filter, setFilter] = useState<FilterType>("aberta");
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    type: "arquivar" | "cancelar";
    opId: string;
    opNumero: number;
  } | null>(null);

  const queryClient = useQueryClient();

  const {
    data: ops = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: productionKeys.ordens,
    queryFn: () => ordemProducaoService.list(),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const arquivarMutation = useMutation({
    mutationFn: (id: string) => ordemProducaoService.arquivar(id),
    onSuccess: (_, id) => {
      toast.success("Ordem de Produção arquivada com sucesso.");
      productionCache.invalidateAfterOPStatusChanged(queryClient, id);
      setConfirmAction(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao arquivar Ordem de Produção.");
      setConfirmAction(null);
    },
  });

  const cancelarMutation = useMutation({
    mutationFn: (id: string) => ordemProducaoService.cancelar(id),
    onSuccess: (_, id) => {
      toast.success("Ordem de Produção cancelada com sucesso.");
      productionCache.invalidateAfterOPCancelled(queryClient, id);
      setConfirmAction(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao cancelar Ordem de Produção.");
      setConfirmAction(null);
    },
  });

  const counts = useMemo(() => {
    const map: Record<string, number> = { Todas: ops.length };
    for (const op of ops) {
      map[op.status] = (map[op.status] ?? 0) + 1;
    }
    return map;
  }, [ops]);

  const filteredOps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ops.filter((op) => {
      if (filter !== "Todas" && op.status !== filter) return false;
      if (!q) return true;
      return formatOPNumber(op.numero).toLowerCase().includes(q) || String(op.numero).includes(q);
    });
  }, [ops, filter, search]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ordens de Produção (Lotes de Fabricação)"
        description="Gerenciamento operacional de lotes permanentes de produção gerados a partir dos pedidos aprovados."
      />

      {/* Filtros rápidos de status */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_OPTIONS.map((opt) => {
          const active = filter === opt.value;
          const cnt = counts[opt.value] ?? 0;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/80 bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span>{opt.label}</span>
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
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por número da OP (ex.: OP-0001)…"
        meta={
          <span>
            <strong className="text-foreground">{filteredOps.length}</strong> ordem(ns) exibida(s)
          </span>
        }
      />

      {isError ? (
        <div className="mx-auto max-w-md py-8">
          <ProductionErrorAlert
            title="Não foi possível carregar as ordens"
            description="Ocorreu um erro ao buscar as ordens de produção. Por favor, tente novamente."
            onRetry={refetch}
          />
        </div>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número OP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado Em</TableHead>
                <TableHead>Prazo de Entrega</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-center">Pedidos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableLoadingRows columns={7} rows={5} />}

              {!isLoading &&
                filteredOps.map((op) => (
                  <TableRow key={op.id} className="group">
                    <TableCell className="p-0 font-mono text-xs font-semibold text-primary">
                      <Link
                        to="/producao/ordens/$id"
                        params={{ id: op.id }}
                        className="block px-3.5 py-2.5 focus:outline-none"
                      >
                        {formatOPNumber(op.numero)}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0">
                      <Link
                        to="/producao/ordens/$id"
                        params={{ id: op.id }}
                        className="block px-3.5 py-2.5 focus:outline-none"
                      >
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                            getOrdemProducaoStatusStyle(op.status),
                          )}
                        >
                          {getOrdemProducaoStatusLabel(op.status)}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell className="p-0 text-xs text-muted-foreground">
                      <Link
                        to="/producao/ordens/$id"
                        params={{ id: op.id }}
                        className="block px-3.5 py-2.5 focus:outline-none"
                      >
                        {formatDate(op.criado_em)}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0 text-xs font-medium text-foreground">
                      <Link
                        to="/producao/ordens/$id"
                        params={{ id: op.id }}
                        className="block px-3.5 py-2.5 focus:outline-none"
                      >
                        {op.para_dia ? formatDate(op.para_dia) : "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0 text-xs text-muted-foreground">
                      <Link
                        to="/producao/ordens/$id"
                        params={{ id: op.id }}
                        className="block px-3.5 py-2.5 focus:outline-none"
                      >
                        {op.criado_por ? "Usuário" : "Sistema"}
                      </Link>
                    </TableCell>
                    <TableCell className="p-0 text-center font-mono text-xs font-semibold tabular-nums">
                      <Link
                        to="/producao/ordens/$id"
                        params={{ id: op.id }}
                        className="block px-3.5 py-2.5 focus:outline-none"
                      >
                        {op.qtd_pedidos}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {op.status !== "cancelada" && op.status !== "arquivada" ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Abrir menu de ações</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setConfirmAction({
                                  type: "arquivar",
                                  opId: op.id,
                                  opNumero: op.numero,
                                })
                              }
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              Arquivar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() =>
                                setConfirmAction({
                                  type: "cancelar",
                                  opId: op.id,
                                  opNumero: op.numero,
                                })
                              }
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Cancelar OP
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

              {!isLoading && filteredOps.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-0">
                    <EmptyState
                      icon={ClipboardList}
                      title="Nenhuma ordem de produção encontrada"
                      description={
                        ops.length === 0
                          ? "Inicie a produção de pedidos aprovados no Kanban para gerar lotes de OP."
                          : "Nenhuma ordem corresponde ao status ou termo filtrado."
                      }
                      action={
                        filter !== "Todas" ? (
                          <Button size="sm" variant="outline" onClick={() => setFilter("Todas")}>
                            Mostrar todas as OPs
                          </Button>
                        ) : undefined
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "arquivar"
                ? `Arquivar Ordem de Produção ${formatOPNumber(confirmAction?.opNumero || 0)}?`
                : `Cancelar Ordem de Produção ${formatOPNumber(confirmAction?.opNumero || 0)}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "arquivar"
                ? "Esta ação mudará o status da Ordem de Produção para Arquivada. O vínculo com os pedidos será mantido para fins de histórico."
                : "ATENÇÃO: Ao cancelar a Ordem de Produção, ela será inativada e todos os pedidos vinculados a ela serão desvinculados e retornarão para o status Aprovado no Kanban de produção."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={arquivarMutation.isPending || cancelarMutation.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmAction?.type === "cancelar"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
              disabled={arquivarMutation.isPending || cancelarMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!confirmAction) return;
                if (confirmAction.type === "arquivar") {
                  arquivarMutation.mutate(confirmAction.opId);
                } else {
                  cancelarMutation.mutate(confirmAction.opId);
                }
              }}
            >
              {arquivarMutation.isPending || cancelarMutation.isPending
                ? "Aguarde..."
                : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
