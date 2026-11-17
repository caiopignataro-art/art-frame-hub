import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/erp/PageHeader";
import { PageToolbar } from "@/components/erp/PageToolbar";
import { EmptyState } from "@/components/erp/EmptyState";
import { TableLoadingRows } from "@/components/erp/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { estoqueService } from "@/lib/services/estoque.service";
import { OP_STATUS_LABEL } from "@/types/estoque";
import { produtosService } from "@/lib/services/produtos.service";
import { pedidosService } from "@/lib/services/pedidos.service";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/estoque/ordens")({
  component: OrdensProducaoEstoquePage,
});

function OrdensProducaoEstoquePage() {
  const { data: ops, isLoading } = useQuery({
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

  const prodMap = useMemo(() => new Map((produtos ?? []).map((p) => [p.id, p])), [produtos]);
  const pedMap = useMemo(() => new Map((pedidos ?? []).map((p) => [p.id, p])), [pedidos]);

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const list = ops ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((op) => {
      const ped = pedMap.get(op.pedido_id);
      const perfil = op.perfil_produto_id ? prodMap.get(op.perfil_produto_id) : null;
      return (
        String(op.numero_op).toLowerCase().includes(q) ||
        String(ped?.numero_pedido ?? "").includes(q) ||
        (ped?.cliente?.nome ?? "").toLowerCase().includes(q) ||
        (perfil?.codigo ?? "").toLowerCase().includes(q) ||
        (perfil?.nome ?? "").toLowerCase().includes(q)
      );
    });
  }, [ops, search, pedMap, prodMap]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Consumo de Insumos por Item de OP"
        description="Rastreabilidade técnica de consumo dimensional (moldura em cm e vidro em m²) vinculada a cada item de pedido aprovado."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/producao/ordens">
              <span>Ir para Lotes de Produção</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <PageToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por OP, nº do pedido, cliente ou código do perfil…"
        meta={
          <span>
            <strong className="text-foreground">{filtered.length}</strong> registro(s) de consumo
          </span>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>OP Item</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Perfil de Moldura</TableHead>
              <TableHead className="text-right">Arte (cm)</TableHead>
              <TableHead className="text-right">Final (cm)</TableHead>
              <TableHead className="text-right">Externa (cm)</TableHead>
              <TableHead className="text-right">Moldura (cm)</TableHead>
              <TableHead className="text-right">Vidro (m²)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableLoadingRows columns={11} rows={5} />}

            {!isLoading &&
              filtered.map((op) => {
                const ped = pedMap.get(op.pedido_id);
                const perfil = op.perfil_produto_id ? prodMap.get(op.perfil_produto_id) : null;
                return (
                  <TableRow key={op.id}>
                    <TableCell className="font-mono text-xs font-semibold text-foreground">
                      {op.numero_op}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary">
                      #{ped?.numero_pedido ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {ped?.cliente?.nome ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-mono text-muted-foreground">{perfil?.codigo ?? "—"}</div>
                      <div className="text-foreground">{perfil?.nome ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {op.largura_arte_cm}×{op.altura_arte_cm}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {op.largura_final_cm}×{op.altura_final_cm}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {Number(op.largura_externa_cm ?? 0).toFixed(1)}×
                      {Number(op.altura_externa_cm ?? 0).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                      {Number(op.consumo_moldura_cm).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {Number(op.consumo_vidro_m2).toFixed(3)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] font-normal">
                        {OP_STATUS_LABEL[op.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(op.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })}

            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="p-0">
                  <EmptyState
                    icon={ClipboardList}
                    title="Nenhum consumo de OP registrado"
                    description="Aprove um pedido para gerar automaticamente o cálculo de reserva e consumo de insumos."
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
