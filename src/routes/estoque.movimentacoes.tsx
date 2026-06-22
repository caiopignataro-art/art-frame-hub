import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { estoqueService } from "@/lib/services/estoque.service";
import { ESTOQUE_MOV_LABEL } from "@/types/estoque";
import { produtosService } from "@/lib/services/produtos.service";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/estoque/movimentacoes")({
  component: MovimentacoesPage,
});

function MovimentacoesPage() {
  const { data: movs } = useQuery({
    queryKey: ["estoque", "movs"],
    queryFn: () => estoqueService.listarMovimentacoes(),
  });
  const { data: produtos } = useQuery({
    queryKey: ["produtos", "perfis"],
    queryFn: () => produtosService.list({ tipo: "perfil_moldura" }),
  });
  const prodMap = new Map((produtos ?? []).map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Movimentações de estoque"
        description="Auditoria completa de reservas, consumos, estornos e retalhos."
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Qtd (cm)</TableHead>
                <TableHead className="text-right">Barras</TableHead>
                <TableHead className="text-right">Saldo antes</TableHead>
                <TableHead className="text-right">Saldo depois</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Obs.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(movs ?? []).map((m) => {
                const prod = prodMap.get(m.produto_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs">{formatDate(m.created_at)}</TableCell>
                    <TableCell>
                      <div className="font-mono text-xs text-muted-foreground">{prod?.codigo}</div>
                      <div className="text-xs">{prod?.nome ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{ESTOQUE_MOV_LABEL[m.tipo]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{Number(m.quantidade_cm).toFixed(1)}</TableCell>
                    <TableCell className="text-right">{Number(m.quantidade_barras).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{Number(m.saldo_anterior_cm).toFixed(0)}</TableCell>
                    <TableCell className="text-right font-medium">{Number(m.saldo_posterior_cm).toFixed(0)}</TableCell>
                    <TableCell className="text-xs">{m.usuario ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.observacao ?? ""}</TableCell>
                  </TableRow>
                );
              })}
              {(movs ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                    Sem movimentações ainda.
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
