import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, User, FileText, ArrowLeft, Archive, CheckCircle2 } from "lucide-react";
import { ordemProducaoService } from "@/lib/services/ordem-producao.service";
import { formatOPNumber, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrdemProducaoStatus } from "@/types/erp";
import { ProductionTable } from "@/components/erp/ProductionTable";

export const Route = createFileRoute("/producao/ordens/$id")({
  head: ({ params }) => ({ meta: [{ title: `OP #${params.id} — Molduraria ERP` }] }),
  component: DetalheOrdemProducaoPage,
});

function DetalheOrdemProducaoPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: opData, isLoading, error } = useQuery({
    queryKey: ["ordem_producao", id],
    queryFn: () => ordemProducaoService.get(id),
  });

  const concluirOp = useMutation({
    mutationFn: () => ordemProducaoService.concluir(id),
    onSuccess: () => {
      toast.success("Ordem de Produção concluída!");
      qc.invalidateQueries({ queryKey: ["ordem_producao", id] });
      qc.invalidateQueries({ queryKey: ["ordens_producao"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const arquivarOp = useMutation({
    mutationFn: () => ordemProducaoService.arquivar(id),
    onSuccess: () => {
      toast.success("Ordem de Produção arquivada com sucesso!");
      qc.invalidateQueries({ queryKey: ["ordem_producao", id] });
      qc.invalidateQueries({ queryKey: ["ordens_producao"] });
      navigate({ to: "/producao/ordens" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AppShell title="Produção">
        <div className="flex h-64 items-center justify-center">
          <p className="text-sm text-muted-foreground">Carregando detalhes da Ordem de Produção...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !opData) {
    return (
      <AppShell title="Produção">
        <div className="space-y-4">
          <Button asChild size="sm" variant="ghost">
            <Link to="/producao/ordens">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a lista
            </Link>
          </Button>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-center">
            <p className="text-sm font-semibold text-destructive">Ordem de Produção não encontrada ou erro na consulta.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const { op, pedidos, itensCount, quantidadesCount, historico } = opData;

  const getStatusStyle = (status: OrdemProducaoStatus) => {
    switch (status) {
      case "Em Preparação":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900";
      case "Concluída":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900";
      case "Arquivada":
        return "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800";
      default:
        return "bg-zinc-50 text-zinc-600 border-zinc-200";
    }
  };

  return (
    <AppShell title="Produção">
      <div className="space-y-6">
        {/* Back and Action Buttons */}
        <div className="flex items-center justify-between">
          <Button asChild size="sm" variant="ghost">
            <Link to="/producao/ordens">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para a lista
            </Link>
          </Button>

          <div className="flex gap-2">
            {op.status === "Em Preparação" && (
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                onClick={() => concluirOp.mutate()}
                disabled={concluirOp.isPending}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir OP
              </Button>
            )}
            {op.status !== "Arquivada" && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => arquivarOp.mutate()}
                disabled={arquivarOp.isPending}
              >
                <Archive className="mr-2 h-4 w-4" /> Arquivar OP
              </Button>
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
                    getStatusStyle(op.status as OrdemProducaoStatus)
                  )}
                >
                  {op.status}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-md bg-muted/30 p-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <span className="block text-[10px] uppercase font-bold text-muted-foreground">Criado em</span>
                <span className="text-sm font-medium text-foreground">{formatDate(op.criado_em)}</span>
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
              <span className="text-2xl font-bold text-muted-foreground">0</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Itens c/ apontamentos</span>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-muted-foreground">0</span>
            </CardContent>
          </Card>
        </div>

        {/* Tabela Interativa */}
        <ProductionTable pedidos={pedidos} />

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
    </AppShell>
  );
}
