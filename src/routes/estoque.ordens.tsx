import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { estoqueService } from "@/lib/services/estoque.service";
import { OP_STATUS_LABEL } from "@/types/estoque";
import { produtosService } from "@/lib/services/produtos.service";
import { pedidosService } from "@/lib/services/pedidos.service";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/estoque/ordens")({
  component: OrdensProducaoPage,
});

function OrdensProducaoPage() {
  const { data: ops } = useQuery({
    queryKey: ["ops"],
    queryFn: () => estoqueService.listarOrdensProducao(),
  });
  const { data: produtos } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => produtosService.list(),
  });
  const { data: pedidos } = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => pedidosService.list(),
  });
  const prodMap = new Map((produtos ?? []).map((p) => [p.id, p]));
  const pedMap = new Map((pedidos ?? []).map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ordens de Produção"
        description="Cada item de pedido aprovado gera uma OP com consumo de moldura, vidro e fundo."
      />
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OP</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-right">Arte (cm)</TableHead>
                <TableHead className="text-right">Final (cm)</TableHead>
                <TableHead className="text-right">Externa (cm)</TableHead>
                <TableHead className="text-right">Moldura (cm)</TableHead>
                <TableHead className="text-right">Vidro (m²)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quando</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(ops ?? []).map((op) => {
                const ped = pedMap.get(op.pedido_id);
                const perfil = op.perfil_produto_id ? prodMap.get(op.perfil_produto_id) : null;
                return (
                  <TableRow key={op.id}>
                    <TableCell className="font-mono text-xs">{op.numero_op}</TableCell>
                    <TableCell className="font-mono text-xs">#{ped?.numero_pedido ?? "—"}</TableCell>
                    <TableCell>{ped?.cliente?.nome ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      <div className="font-mono">{perfil?.codigo}</div>
                      <div className="text-muted-foreground">{perfil?.nome}</div>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {op.largura_arte_cm}×{op.altura_arte_cm}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {op.largura_final_cm}×{op.altura_final_cm}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {Number(op.largura_externa_cm ?? 0).toFixed(1)}×{Number(op.altura_externa_cm ?? 0).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">{Number(op.consumo_moldura_cm).toFixed(1)}</TableCell>
                    <TableCell className="text-right">{Number(op.consumo_vidro_m2).toFixed(3)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{OP_STATUS_LABEL[op.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatDate(op.created_at)}</TableCell>
                  </TableRow>
                );
              })}
              {(ops ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">
                    Nenhuma ordem de produção. Aprove um pedido para gerar automaticamente.
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
