import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  User,
  FileText,
  ArrowLeft,
  Archive,
  CheckCircle2,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { ordemProducaoService } from "@/lib/services/ordem-producao.service";
import { formatOPNumber, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrdemProducaoStatus } from "@/lib/constants/ordem-producao-status";
import {
  getOrdemProducaoStatusLabel,
  getOrdemProducaoStatusStyle,
} from "@/lib/constants/ordem-producao-status";
import { ProductionTable } from "@/components/erp/ProductionTable";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  head: ({ params }) => ({ meta: [{ title: `OP #${params.id} — Art Frame Hub` }] }),
  component: DetalheOrdemProducaoPage,
});

function DetalheOrdemProducaoPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [confirmAction, setConfirmAction] = useState<"concluir" | "arquivar" | "cancelar" | null>(
    null,
  );

  const {
    data: opData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
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
      void navigate({ to: "/producao/ordens" });
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
      void navigate({ to: "/producao/ordens" });
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmAction(null);
    },
  });

  if (isLoading) {
    return (
      <div
        className="space-y-6 animate-pulse"
        role="status"
        aria-busy="true"
        aria-label="Carregando detalhes da ordem de produção"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-36" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

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

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
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
    );
  }

  if (!opData) {
    return (
      <div className="space-y-4" role="alert">
        <Button asChild size="sm" variant="ghost">
          <Link to="/producao/ordens">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a lista
          </Link>
        </Button>
        <div className="rounded-lg border border-muted bg-muted/10 p-6 text-center space-y-3 max-w-md mx-auto">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
          <p className="text-sm font-semibold text-foreground">Ordem de Produção não encontrada.</p>
          <p className="text-xs text-muted-foreground">
            Ela pode ter sido removida ou o link está incorreto.
          </p>
          <Button asChild size="sm" variant="default" className="mt-2">
            <Link to="/producao/ordens">Voltar para Lista</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { op, pedidos, opItens, itensCount, quantidadesCount, historico } = opData;

  const preparadosCount = opItens?.filter((oi) => oi.preparado).length ?? 0;
  const problemasCount = opItens?.filter((oi) => oi.possui_problema).length ?? 0;

  const isPending = concluirOp.isPending || arquivarOp.isPending || cancelarOp.isPending;

  return (
    <div className="space-y-5">
      {/* Barra de retorno e ações da OP */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild size="sm" variant="outline">
          <Link to="/producao/ordens">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Ordens de Produção
          </Link>
        </Button>

        {op.status !== "cancelada" && op.status !== "arquivada" && (
          <div className="flex flex-wrap items-center gap-2">
            {op.status === "aberta" && (
              <Button size="sm" onClick={() => setConfirmAction("concluir")} disabled={isPending}>
                <CheckCircle2 className="h-4 w-4" />
                Concluir OP
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmAction("arquivar")}
              disabled={isPending}
            >
              <Archive className="h-4 w-4" />
              Arquivar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmAction("cancelar")}
              disabled={isPending}
            >
              <Trash2 className="h-4 w-4" />
              Cancelar OP
            </Button>
          </div>
        )}
      </div>

      {/* Cabeçalho da OP */}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Lote Operacional de Fabricação
              </span>
              <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {formatOPNumber(op.numero)}
              </h1>
            </div>
            <div>
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-3 py-1 text-xs font-semibold transition-colors",
                  getOrdemProducaoStatusStyle(op.status as OrdemProducaoStatus),
                )}
              >
                {getOrdemProducaoStatusLabel(op.status as OrdemProducaoStatus)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/25 p-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                Criado em
              </span>
              <span className="text-xs font-medium text-foreground">
                {formatDate(op.criado_em)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-primary/20 bg-primary/[0.03] p-3">
            <Calendar className="h-4 w-4 text-primary" />
            <div>
              <span className="block text-[10px] font-semibold uppercase text-primary">
                Para dia
              </span>
              <span className="text-xs font-bold text-foreground">
                {op.para_dia ? formatDate(op.para_dia) : "—"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/25 p-3">
            <User className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                Criado por
              </span>
              <span className="text-xs font-medium text-foreground">
                {op.criado_por ? "Usuário" : "Sistema"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/25 p-3">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                Pedidos vinculados
              </span>
              <span className="text-xs font-medium text-foreground">
                {pedidos.length} pedido(s)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/25 p-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground">
                Última atualização
              </span>
              <span className="text-xs font-medium text-foreground">
                {formatDateTime(op.atualizado_em)}
              </span>
            </div>
          </div>

          {op.observacoes && (
            <div className="col-span-full rounded-md border border-border bg-muted/20 p-3 text-xs">
              <span className="mb-1 block font-semibold text-muted-foreground">Observações</span>
              <p className="text-foreground">{op.observacoes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo de métricas da OP */}
      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Total de pedidos
            </span>
          </CardHeader>
          <CardContent>
            <span className="font-mono text-2xl font-semibold tabular-nums">{pedidos.length}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Total de itens
            </span>
          </CardHeader>
          <CardContent>
            <span className="font-mono text-2xl font-semibold tabular-nums">{itensCount}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Peças / Quantidades
            </span>
          </CardHeader>
          <CardContent>
            <span className="font-mono text-2xl font-semibold tabular-nums">
              {quantidadesCount}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Itens preparados
            </span>
          </CardHeader>
          <CardContent>
            <span
              className={`font-mono text-2xl font-semibold tabular-nums ${
                preparadosCount > 0 ? "text-emerald-600" : "text-muted-foreground"
              }`}
            >
              {preparadosCount}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Itens c/ apontamentos
            </span>
          </CardHeader>
          <CardContent>
            <span
              className={`font-mono text-2xl font-semibold tabular-nums ${
                problemasCount > 0 ? "text-amber-600" : "text-muted-foreground"
              }`}
            >
              {problemasCount}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Interativa de Produção */}
      <ProductionTable ordemData={opData} />

      {/* Histórico Cronológico em Accordion */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem
          value="historico"
          className="rounded-lg border border-border/85 bg-card px-5"
        >
          <AccordionTrigger className="text-sm font-semibold hover:no-underline">
            Histórico de Eventos da OP ({historico.length})
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-5">
            {historico.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Nenhum evento registrado no histórico.
              </p>
            ) : (
              <div className="relative mt-3 space-y-5 border-l border-border pl-6">
                {historico.map((log) => {
                  const date = new Date(log.created_at);
                  const formattedDate = date.toLocaleDateString("pt-BR");
                  const formattedTime = date.toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div key={log.id} className="relative">
                      <span className="absolute -left-[31px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-primary bg-background">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                      <div className="flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <div className="font-medium text-foreground">{log.descricao}</div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="font-semibold">{log.usuario || "sistema"}</span>
                          <span>·</span>
                          <span className="font-mono">
                            {formattedDate} {formattedTime}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "concluir" && "Concluir Ordem de Produção?"}
              {confirmAction === "arquivar" && "Arquivar Ordem de Produção?"}
              {confirmAction === "cancelar" && "Cancelar Ordem de Produção?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "concluir" &&
                "Esta ação mudará o status desta OP para Concluída. Todos os pedidos vinculados permanecerão associados a ela."}
              {confirmAction === "arquivar" &&
                "Esta ação mudará o status desta OP para Arquivada. O vínculo com os pedidos será mantido para fins de histórico."}
              {confirmAction === "cancelar" &&
                "ATENÇÃO: Ao cancelar a Ordem de Produção, todos os pedidos vinculados retornarão para o status Aprovado no Kanban e a OP será inativada permanentemente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmAction === "cancelar"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
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
    </div>
  );
}
