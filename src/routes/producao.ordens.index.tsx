import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ordemProducaoService } from "@/lib/services/ordem-producao.service";
import { formatOPNumber, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrdemProducaoStatus } from "@/lib/constants/ordem-producao-status";
import { getOrdemProducaoStatusLabel, getOrdemProducaoStatusStyle } from "@/lib/constants/ordem-producao-status";
import { Skeleton } from "@/components/ui/skeleton";
import { productionKeys, productionCache } from "@/lib/services/production-cache";
import { ProductionErrorAlert } from "@/components/production/ProductionErrorAlert";
import { toast } from "sonner";
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
import { MoreHorizontal, Archive, Trash2 } from "lucide-react";

export const Route = createFileRoute("/producao/ordens/")({
  head: () => ({ meta: [{ title: "Ordens de Produção — Molduraria ERP" }] }),
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
  const [confirmAction, setConfirmAction] = useState<{
    type: "arquivar" | "cancelar";
    opId: string;
    opNumero: number;
  } | null>(null);

  const queryClient = useQueryClient();

  const { data: ops = [], isLoading, isError, refetch } = useQuery({
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
    onError: (err: any) => {
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
    onError: (err: any) => {
      toast.error(err.message || "Erro ao cancelar Ordem de Produção.");
      setConfirmAction(null);
    },
  });

  const filteredOps = ops.filter((op) => {
    if (filter === "Todas") return true;
    return op.status === filter;
  });

  return (
    <>
      <PageHeader
        title="Ordens de Produção"
        description="Gerenciamento de lotes de fabricação e ordens permanentes."
      />

      <div className="space-y-4">
        {/* Status Filters */}
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.value;
            return (
              <Button
                key={opt.value}
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(opt.value)}
              >
                {opt.label}
              </Button>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Listagem de Ordens
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {isLoading ? (
              <div className="overflow-x-auto" role="status" aria-busy="true" aria-label="Carregando ordens de produção">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                      <th className="p-4">Número</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Criado Em</th>
                      <th className="p-4">Para dia</th>
                      <th className="p-4">Criado Por</th>
                      <th className="p-4 text-center">Pedidos</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <tr key={i}>
                        <td className="p-4"><Skeleton className="h-4 w-16" /></td>
                        <td className="p-4"><Skeleton className="h-5 w-24 rounded-full" /></td>
                        <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="p-4"><Skeleton className="h-4 w-24" /></td>
                        <td className="p-4"><Skeleton className="h-4 w-16" /></td>
                        <td className="p-4 text-center"><Skeleton className="h-4 w-8 mx-auto" /></td>
                        <td className="p-4 text-right"><Skeleton className="h-8 w-16 ml-auto rounded" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : isError ? (
              <div className="p-8">
                <div className="max-w-md mx-auto">
                  <ProductionErrorAlert
                    title="Não foi possível carregar as ordens"
                    description="Ocorreu um erro ao buscar as ordens de produção. Por favor, tente novamente."
                    onRetry={refetch}
                  />
                </div>
              </div>
            ) : ops.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma ordem de produção cadastrada.
              </div>
            ) : filteredOps.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground space-y-3">
                <p>Nenhuma ordem de produção com o status selecionado encontrada.</p>
                <Button size="sm" variant="outline" onClick={() => setFilter("Todas")}>
                  Limpar Filtros
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 font-medium text-muted-foreground">
                      <th className="p-4">Número</th>
                      <th className="p-4">Status</th>
                      <th className="p-4">Criado Em</th>
                      <th className="p-4">Para dia</th>
                      <th className="p-4">Criado Por</th>
                      <th className="p-4 text-center">Pedidos</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOps.map((op) => (
                      <tr key={op.id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-0 font-mono font-bold text-primary">
                          <Link to="/producao/ordens/$id" params={{ id: op.id }} className="block p-4 focus:outline-none focus:ring-1 focus:ring-ring">
                            {formatOPNumber(op.numero)}
                          </Link>
                        </td>
                        <td className="p-0">
                          <Link to="/producao/ordens/$id" params={{ id: op.id }} className="block p-4 focus:outline-none focus:ring-1 focus:ring-ring">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
                                getOrdemProducaoStatusStyle(op.status)
                              )}
                            >
                              {getOrdemProducaoStatusLabel(op.status)}
                            </span>
                          </Link>
                        </td>
                        <td className="p-0 text-muted-foreground">
                          <Link to="/producao/ordens/$id" params={{ id: op.id }} className="block p-4 focus:outline-none focus:ring-1 focus:ring-ring">
                            {formatDate(op.criado_em)}
                          </Link>
                        </td>
                        <td className="p-0 font-medium text-foreground">
                          <Link to="/producao/ordens/$id" params={{ id: op.id }} className="block p-4 focus:outline-none focus:ring-1 focus:ring-ring">
                            {op.para_dia ? formatDate(op.para_dia) : "—"}
                          </Link>
                        </td>
                        <td className="p-0 text-muted-foreground">
                          <Link to="/producao/ordens/$id" params={{ id: op.id }} className="block p-4 focus:outline-none focus:ring-1 focus:ring-ring">
                            {op.criado_por ? "Usuário" : "Sistema"}
                          </Link>
                        </td>
                        <td className="p-0 text-center font-medium">
                          <Link to="/producao/ordens/$id" params={{ id: op.id }} className="block p-4 focus:outline-none focus:ring-1 focus:ring-ring">
                            {op.qtd_pedidos}
                          </Link>
                        </td>
                        <td className="p-4 text-right">
                          {op.status !== "cancelada" && op.status !== "arquivada" ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "arquivar"
                ? `Arquivar Ordem de Produção OP-${formatOPNumber(confirmAction?.opNumero || 0)}?`
                : `Cancelar Ordem de Produção OP-${formatOPNumber(confirmAction?.opNumero || 0)}?`}
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
              className={confirmAction?.type === "cancelar" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
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
              {arquivarMutation.isPending || cancelarMutation.isPending ? "Aguarde..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
