import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, User, FileText, ArrowLeft, Archive, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { ordemProducaoService } from "@/lib/services/ordem-producao.service";
import { formatOPNumber, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrdemProducaoStatus } from "@/lib/constants/ordem-producao-status";
import { getOrdemProducaoStatusLabel, getOrdemProducaoStatusStyle } from "@/lib/constants/ordem-producao-status";
import { ProductionTable } from "@/components/erp/ProductionTable";
import { Skeleton } from "@/components/ui/skeleton";
import { productionKeys, productionCache } from "@/lib/services/production-cache";
import { ProductionErrorAlert } from "@/components/production/ProductionErrorAlert";
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

export const Route = createFileRoute("/producao/ordens/$id")({
  head: ({ params }) => ({ meta: [{ title: `OP #${params.id} — Molduraria ERP` }] }),
  component: DetalheOrdemProducaoPage,
});

function DetalheOrdemProducaoPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<"concluir" | "arquivar" | "cancelar" | null>(null);

  const { data: opData, isLoading, isError, refetch } = useQuery({
    queryKey: productionKeys.ordem(id),
    queryFn: () => ordemProducaoService.get(id),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const concluirOp = useMutation({
    mutationFn: () => ordemProducaoService.concluir(id),
    onSuccess: () => {
      toast.success("Ordem de Produção concluída!");
      productionCache.invalidateAfterOPStatusChanged(qc, id);
      setConfirmAction(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmAction(null);
    },
  });

  const arquivarOp = useMutation({
    mutationFn: () => ordemProducaoService.arquivar(id),
    onSuccess: () => {
      toast.success("Ordem de Produção arquivada com sucesso!");
      productionCache.invalidateAfterOPStatusChanged(qc, id);
      setConfirmAction(null);
      navigate({ to: "/producao/ordens" });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmAction(null);
    },
  });

  const cancelarOp = useMutation({
    mutationFn: () => ordemProducaoService.cancelar(id),
    onSuccess: () => {
      toast.success("Ordem de Produção cancelada com sucesso!");
      productionCache.invalidateAfterOPCancelled(qc, id);
      setConfirmAction(null);
      navigate({ to: "/producao/ordens" });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmAction(null);
    },
  });

  if (isLoading) {
    return (
      <AppShell title="Produção">
        <div className="space-y-6 animate-pulse" role="status" aria-busy="true" aria-label="Carregando detalhes da ordem de produção">
          {/* Back button skeleton */}
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-36" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>

          {/* Cabeçalho Skeleton */}
          <Card className="border-l-4 border-l-primary/40">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-8 w-44" />
                </div>
                <Skeleton className="h-7 w-24 rounded-full" />
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Resumo/Métricas Cards Skeletons */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-3 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabela Interativa Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-9 w-64" />
                <Skeleton className="h-9 w-40" />
              </div>
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Histórico Cronológico Skeleton */}
          <Card>
            <CardHeader className="border-b border-border">
              <Skeleton className="h-5 w-36" />
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-4">
                  <Skeleton className="h-4 w-4 rounded-full mt-1" />
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell title="Produção">
        <div className="space-y-4">
          <Button asChild size="sm" variant="ghost">
            <Link to="/producao/ordens">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a lista
            </Link>
          </Button>
          <div className="max-w-md mx-auto">
            <ProductionErrorAlert
              title="Erro de Conexão"
              description="Não foi possível carregar os dados desta Ordem de Produção."
              onRetry={refetch}
            />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!opData) {
    return (
      <AppShell title="Produção">
        <div className="space-y-4" role="alert">
          <Button asChild size="sm" variant="ghost">
            <Link to="/producao/ordens">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a lista
            </Link>
          </Button>
          <div className="rounded-lg border border-muted bg-muted/10 p-6 text-center space-y-3 max-w-md mx-auto">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold text-foreground">Ordem de Produção não encontrada.</p>
            <p className="text-xs text-muted-foreground">Ela pode ter sido removida ou o link está incorreto.</p>
            <Button asChild size="sm" variant="default" className="mt-2">
              <Link to="/producao/ordens">Voltar para Lista</Link>
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  const { op, pedidos, opItens, itensCount, quantidadesCount, historico } = opData;

  const preparadosCount = opItens?.filter((oi: any) => oi.preparado).length ?? 0;
  const problemasCount = opItens?.filter((oi: any) => oi.possui_problema).length ?? 0;

  const isPending = concluirOp.isPending || arquivarOp.isPending || cancelarOp.isPending;

  return (
    <>
      <div className="space-y-6">
        {/* Back and Action Buttons */}
        <div className="flex items-center justify-between">
          <Button asChild size="sm" variant="ghost">
            <Link to="/producao/ordens">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a lista
            </Link>
          </Button>

          <div className="flex gap-2">
            {op.status === "aberta" && (
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                onClick={() => setConfirmAction("concluir")}
                disabled={isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir OP
              </Button>
            )}
            {op.status !== "cancelada" && op.status !== "arquivada" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmAction("arquivar")}
                  disabled={isPending}
                >
                  <Archive className="mr-2 h-4 w-4" /> Arquivar OP
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmAction("cancelar")}
                  disabled={isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Cancelar OP
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Cabeçalho */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ordem de Produção</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">{formatOPNumber(op.numero)}</h1>
              </div>
              <div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
                    getOrdemProducaoStatusStyle(op.status as OrdemProducaoStatus)
                  )}
                >
                  {getOrdemProducaoStatusLabel(op.status as OrdemProducaoStatus)}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">Criado em</span>
                <span className="text-sm font-medium text-foreground">{formatDate(op.criado_em)}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3 border border-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-primary">Para dia</span>
                <span className="text-sm font-bold text-foreground">{op.para_dia ? formatDate(op.para_dia) : "—"}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">Criado por</span>
                <span className="text-sm font-medium text-foreground">{op.criado_por ? "Usuário" : "Sistema"}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">Pedidos vinculados</span>
                <span className="text-sm font-medium text-foreground">{pedidos.length} pedido(s)</span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">Última atualização</span>
                <span className="text-sm font-medium text-foreground">{formatDateTime(op.atualizado_em)}</span>
              </div>
            </div>

            {op.observacoes && (
              <div className="col-span-full rounded-md border border-border bg-muted/20 p-3 text-sm">
                <span className="block text-xs font-semibold text-muted-foreground mb-1">Observações</span>
                <p className="text-foreground">{op.observacoes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resumo */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Total de pedidos</span>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{pedidos.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Total de itens</span>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{itensCount}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Total de quantidades</span>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{quantidadesCount}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Itens preparados</span>
            </CardHeader>
            <CardContent>
              <span className={`text-2xl font-bold ${preparadosCount > 0 ? "text-green-600" : "text-muted-foreground"}`}>{preparadosCount}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Itens c/ apontamentos</span>
            </CardHeader>
            <CardContent>
              <span className={`text-2xl font-bold ${problemasCount > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{problemasCount}</span>
            </CardContent>
          </Card>
        </div>

        {/* Tabela Interativa */}
        <ProductionTable ordemData={opData} />

        {/* Histórico Cronológico */}
        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base font-semibold">Histórico de Eventos</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {historico.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">Nenhum evento registrado no histórico.</p>
            ) : (
              <div className="relative border-l border-border pl-6 space-y-6">
                {historico.map((log) => {
                  const date = new Date(log.created_at);
                  const formattedDate = date.toLocaleDateString("pt-BR");
                  const formattedTime = date.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div key={log.id} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[31px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-primary bg-background">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="font-medium text-foreground">{log.descricao}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-semibold">{log.usuario || "sistema"}</span>
                          <span>•</span>
                          <span>{formattedDate} {formattedTime}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "concluir" && "Concluir Ordem de Produção?"}
              {confirmAction === "arquivar" && "Arquivar Ordem de Produção?"}
              {confirmAction === "cancelar" && "Cancelar Ordem de Produção?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "concluir" && "Esta ação mudará o status desta OP para Concluída. Todos os pedidos vinculados permanecerão associados a ela."}
              {confirmAction === "arquivar" && "Esta ação mudará o status desta OP para Arquivada. O vínculo com os pedidos será mantido para fins de histórico."}
              {confirmAction === "cancelar" && "ATENÇÃO: Ao cancelar a Ordem de Produção, todos os pedidos vinculados retornarão para o status Aprovado no Kanban e a OP será inativada permanentemente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction === "cancelar" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmAction === "concluir") concluirOp.mutate();
                if (confirmAction === "arquivar") arquivarOp.mutate();
                if (confirmAction === "cancelar") cancelarOp.mutate();
              }}
            >
              {isPending ? "Aguarde..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
