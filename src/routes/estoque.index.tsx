import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Boxes, DollarSign, Scissors } from "lucide-react";
import { PageHeader } from "@/components/erp/PageHeader";
import { PageToolbar } from "@/components/erp/PageToolbar";
import { EmptyState } from "@/components/erp/EmptyState";
import { TableLoadingRows } from "@/components/erp/LoadingState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { estoqueService } from "@/lib/services/estoque.service";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/estoque/")({
  component: EstoqueDashboardPage,
});

function EstoqueDashboardPage() {
  const { data: perfis, isLoading } = useQuery({
    queryKey: ["estoque", "perfis"],
    queryFn: () => estoqueService.listarPerfis(),
  });
  const { data: resumo } = useQuery({
    queryKey: ["estoque", "resumo"],
    queryFn: () => estoqueService.resumo(),
  });

  const [search, setSearch] = useState("");
  const [apenasBaixos, setApenasBaixos] = useState(false);

  const baixos = useMemo(() => (perfis ?? []).filter((p) => p.abaixo_minimo), [perfis]);

  const filtered = useMemo(() => {
    let list = perfis ?? [];
    if (apenasBaixos) {
      list = list.filter((p) => p.abaixo_minimo);
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (p) =>
        (p.produto.codigo ?? "").toLowerCase().includes(q) ||
        p.produto.nome.toLowerCase().includes(q),
    );
  }, [perfis, apenasBaixos, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Estoque de Perfis de Moldura"
        description="Controle dimensional em barras e centímetros: saldo físico, retalhos reaproveitáveis, reservas ativas e alertas de reposição."
      />

      {/* KPIs de Estoque */}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<Boxes className="h-4 w-4" />}
          label="Barras em estoque"
          value={resumo?.total_barras?.toFixed(1) ?? "—"}
          hint="Saldo equivalente em barras"
        />
        <KpiCard
          icon={<Scissors className="h-4 w-4" />}
          label="Retalhos disponíveis"
          value={resumo?.total_retalhos != null ? `${resumo.total_retalhos.toFixed(0)} cm` : "—"}
          hint="Sobras prontas para reaproveitamento"
        />
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Perfis abaixo do mínimo"
          value={String(resumo?.perfis_baixo_estoque ?? 0)}
          hint="Itens que requerem reposição"
          alert={(resumo?.perfis_baixo_estoque ?? 0) > 0}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Valor estimado em estoque"
          value={resumo ? formatBRL(resumo.valor_estoque) : "—"}
          hint="Custo imobilizado em perfis"
        />
      </div>

      {/* Banner compacto de alerta de estoque mínimo */}
      {baixos.length > 0 && (
        <Alert className="border-amber-500/35 bg-amber-500/[0.04]">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <span>{baixos.length} perfil(is) abaixo do estoque mínimo configurado</span>
            <Button
              type="button"
              size="sm"
              variant={apenasBaixos ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setApenasBaixos((prev) => !prev)}
            >
              {apenasBaixos ? "Mostrar todos os perfis" : "Filtrar apenas críticos"}
            </Button>
          </AlertTitle>
          <AlertDescription className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
            {baixos.slice(0, 8).map((p) => (
              <span
                key={p.produto.id}
                className="inline-flex items-center gap-1 rounded border border-amber-500/25 bg-background px-2 py-0.5 font-mono text-[11px]"
              >
                <strong>{p.produto.codigo}</strong>: {p.barras.toFixed(1)} / mín{" "}
                {p.estoque_minimo_barras.toFixed(1)} br
              </span>
            ))}
            {baixos.length > 8 && (
              <span className="self-center text-[11px] text-muted-foreground">
                +{baixos.length - 8} mais
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <PageToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por código ou nome do perfil…"
        meta={
          <span>
            Exibindo <strong className="text-foreground">{filtered.length}</strong> de{" "}
            {perfis?.length ?? 0} perfil(is)
          </span>
        }
      >
        <Button
          type="button"
          size="sm"
          variant={apenasBaixos ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => setApenasBaixos((prev) => !prev)}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Apenas abaixo do mínimo ({baixos.length})
        </Button>
      </PageToolbar>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Código</TableHead>
              <TableHead>Perfil de Moldura</TableHead>
              <TableHead className="text-right">Barras</TableHead>
              <TableHead className="text-right">Total (cm)</TableHead>
              <TableHead className="text-right">Retalhos (cm)</TableHead>
              <TableHead className="text-right">Reservado (cm)</TableHead>
              <TableHead className="text-right">Disponível (cm)</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableLoadingRows columns={8} rows={6} />}

            {!isLoading &&
              filtered.map((p) => (
                <TableRow
                  key={p.produto.id}
                  className={p.abaixo_minimo ? "bg-amber-500/[0.03]" : undefined}
                >
                  <TableCell className="font-mono text-xs font-medium text-muted-foreground">
                    {p.produto.codigo ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{p.produto.nome}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {p.barras.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {p.total_cm_barras.toFixed(0)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {p.retalhos_cm.toFixed(0)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-amber-700 dark:text-amber-400">
                    {p.reservado_cm.toFixed(0)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                    {p.disponivel_cm.toFixed(0)}
                  </TableCell>
                  <TableCell>
                    {p.abaixo_minimo ? (
                      <Badge variant="warning">Abaixo do mín.</Badge>
                    ) : (
                      <Badge variant="success">Regular</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <EmptyState
                    icon={Boxes}
                    title="Nenhum perfil encontrado"
                    description="Ajuste a busca ou importe a planilha XLSX de perfis de moldura no módulo de Produtos."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? "border-amber-500/35 bg-amber-500/[0.02]" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-md ${
              alert ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground"
            }`}
          >
            {icon}
          </div>
        </div>
        <div className="mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums text-foreground">
          {value}
        </div>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
