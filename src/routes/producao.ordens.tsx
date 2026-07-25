import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ordemProducaoService } from "@/lib/services/ordem-producao.service";
import { formatOPNumber, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrdemProducaoStatus } from "@/lib/constants/ordem-producao-status";
import { getOrdemProducaoStatusLabel } from "@/lib/constants/ordem-producao-status";

export const Route = createFileRoute("/producao/ordens")({
  head: () => ({ meta: [{ title: "Ordens de Produção — Molduraria ERP" }] }),
  component: OrdensProducaoPage,
});

type FilterType = "Todas" | OrdemProducaoStatus;

function OrdensProducaoPage() {
  const [filter, setFilter] = useState<FilterType>("Todas");
  const { data: ops = [], isLoading } = useQuery({
    queryKey: ["ordens_producao"],
    queryFn: () => ordemProducaoService.list(),
  });

  const filteredOps = ops.filter((op) => {
    if (filter === "Todas") return true;
    return op.status === filter;
  });

  const getStatusStyle = (status: OrdemProducaoStatus) => {
    switch (status) {
      case "aberta":
        return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900";
      case "em_andamento":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900";
      case "concluida":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900";
      case "cancelada":
        return "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800";
      default:
        return "bg-zinc-50 text-zinc-600 border-zinc-200";
    }
  };

  return (
    <AppShell title="Produção">
      <nav className="-mt-2 mb-4 flex gap-1 border-b border-border">
        <Link
          to="/producao"
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Fluxo de Produção
        </Link>
        <Link
          to="/producao/ordens"
          className={cn(
            "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            "border-primary text-foreground"
          )}
        >
          Ordens de Produção
        </Link>
      </nav>

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
              <div className="p-8 text-center text-sm text-muted-foreground">
                Carregando ordens de produção...
              </div>
            ) : filteredOps.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma ordem de produção encontrada.
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
                              getStatusStyle(op.status)
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
    </AppShell>
  );
}
