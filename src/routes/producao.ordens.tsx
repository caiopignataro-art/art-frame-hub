import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { productionKeys } from "@/lib/services/production-cache";
import { ProductionErrorAlert } from "@/components/production/ProductionErrorAlert";

export const Route = createFileRoute("/producao/ordens")({
  head: () => ({ meta: [{ title: "Ordens de Produção — Molduraria ERP" }] }),
  component: OrdensProducaoPage,
});

type FilterType = "Todas" | OrdemProducaoStatus;

function OrdensProducaoPage() {
  const [filter, setFilter] = useState<FilterType>("Todas");
  const { data: ops = [], isLoading, isError, refetch } = useQuery({
    queryKey: productionKeys.ordens,
    queryFn: () => ordemProducaoService.list(),
    staleTime: 30000,
    refetchOnWindowFocus: false,
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
          {(["Todas", "aberta", "em_andamento", "concluida", "cancelada"] as const).map((status) => {
            const label = status === "Todas" ? "Todas" : getOrdemProducaoStatusLabel(status);
            const active = filter === status;

            return (
              <Button
                key={status}
                variant={active ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(status)}
              >
                {label}
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
                      <th className="p-4">Criado Por</th>
                      <th className="p-4 text-center">Pedidos</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOps.map((op) => (
                      <tr key={op.id} className="hover:bg-muted/10">
                        <td className="p-4 font-mono font-bold text-primary">
                          {formatOPNumber(op.numero)}
                        </td>
                        <td className="p-4">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
                              getOrdemProducaoStatusStyle(op.status)
                            )}
                          >
                            {getOrdemProducaoStatusLabel(op.status)}
                          </span>
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {formatDate(op.criado_em)}
                        </td>
                        <td className="p-4 text-muted-foreground">
                          {op.criado_por ? "Usuário" : "Sistema"}
                        </td>
                        <td className="p-4 text-center font-medium">
                          {op.qtd_pedidos}
                        </td>
                        <td className="p-4 text-right">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to="/producao/ordens/$id"
                              params={{ id: op.id }}
                              onClick={() => {
                                console.log("[OP] Link clicado", op.id);
                              }}
                            >
                              Abrir
                            </Link>
                          </Button>
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
    </>
  );
}
