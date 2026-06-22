import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Boxes, Scissors, AlertTriangle, DollarSign } from "lucide-react";
import { estoqueService } from "@/lib/services/estoque.service";
import { formatCurrency } from "@/lib/format";

export const Route = createFileRoute("/estoque/")({
  component: EstoqueDashboardPage,
});

function EstoqueDashboardPage() {
  const { data: perfis } = useQuery({
    queryKey: ["estoque", "perfis"],
    queryFn: () => estoqueService.listarPerfis(),
  });
  const { data: resumo } = useQuery({
    queryKey: ["estoque", "resumo"],
    queryFn: () => estoqueService.resumo(),
  });

  const baixos = (perfis ?? []).filter((p) => p.abaixo_minimo);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Estoque de Molduras"
        description="Saldo em barras, retalhos disponíveis e alertas de reposição."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={<Boxes className="h-4 w-4" />} label="Barras em estoque" value={resumo?.total_barras?.toFixed(1) ?? "—"} />
        <KpiCard icon={<Scissors className="h-4 w-4" />} label="Retalhos (cm)" value={resumo?.total_retalhos?.toFixed(0) ?? "—"} />
        <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Perfis abaixo do mínimo" value={String(resumo?.perfis_baixo_estoque ?? 0)} />
        <KpiCard icon={<DollarSign className="h-4 w-4" />} label="Valor do estoque" value={resumo ? formatCurrency(resumo.valor_estoque) : "—"} />
      </div>

      {baixos.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base text-amber-700">
              Alertas de estoque mínimo ({baixos.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="text-right">Barras</TableHead>
                  <TableHead className="text-right">Mínimo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {baixos.map((p) => (
                  <TableRow key={p.produto.id}>
                    <TableCell className="font-mono text-xs">{p.produto.codigo}</TableCell>
                    <TableCell>{p.produto.nome}</TableCell>
                    <TableCell className="text-right">{p.barras.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{p.estoque_minimo_barras.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfis de moldura</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-right">Barras</TableHead>
                <TableHead className="text-right">Total (cm)</TableHead>
                <TableHead className="text-right">Retalhos (cm)</TableHead>
                <TableHead className="text-right">Reservado (cm)</TableHead>
                <TableHead className="text-right">Disponível (cm)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(perfis ?? []).map((p) => (
                <TableRow key={p.produto.id}>
                  <TableCell className="font-mono text-xs">{p.produto.codigo}</TableCell>
                  <TableCell>{p.produto.nome}</TableCell>
                  <TableCell className="text-right">{p.barras.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{p.total_cm_barras.toFixed(0)}</TableCell>
                  <TableCell className="text-right">{p.retalhos_cm.toFixed(0)}</TableCell>
                  <TableCell className="text-right">{p.reservado_cm.toFixed(0)}</TableCell>
                  <TableCell className="text-right font-medium">{p.disponivel_cm.toFixed(0)}</TableCell>
                  <TableCell>
                    {p.abaixo_minimo ? (
                      <Badge variant="destructive">Baixo</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(perfis ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    Nenhum perfil cadastrado. Importe a planilha XLSX de molduras.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
        <div className="rounded-md bg-muted p-2 text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}
