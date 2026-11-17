import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { PageHeader } from "@/components/erp/PageHeader";
import { PageToolbar } from "@/components/erp/PageToolbar";
import { EmptyState } from "@/components/erp/EmptyState";
import { TableLoadingRows } from "@/components/erp/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { estoqueService } from "@/lib/services/estoque.service";
import { ESTOQUE_MOV_LABEL, type EstoqueMovimentoTipo } from "@/types/estoque";
import { produtosService } from "@/lib/services/produtos.service";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/estoque/movimentacoes")({
  component: MovimentacoesPage,
});

function MovimentacoesPage() {
  const { data: movs, isLoading } = useQuery({
    queryKey: ["estoque", "movs"],
    queryFn: () => estoqueService.listarMovimentacoes(),
  });
  const { data: produtos } = useQuery({
    queryKey: ["produtos", "perfis"],
    queryFn: () => produtosService.list({ tipo: "perfil_moldura" }),
  });
  const prodMap = useMemo(() => new Map((produtos ?? []).map((p) => [p.id, p])), [produtos]);

  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<EstoqueMovimentoTipo | "todos">("todos");

  const filtered = useMemo(() => {
    const list = movs ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((m) => {
      if (tipoFilter !== "todos" && m.tipo !== tipoFilter) return false;
      if (!q) return true;
      const prod = prodMap.get(m.produto_id);
      return (
        (prod?.codigo ?? "").toLowerCase().includes(q) ||
        (prod?.nome ?? "").toLowerCase().includes(q) ||
        (m.observacao ?? "").toLowerCase().includes(q) ||
        (m.usuario ?? "").toLowerCase().includes(q)
      );
    });
  }, [movs, tipoFilter, search, prodMap]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Movimentações de Estoque"
        description="Trilha de auditoria completa de reservas, consumos, entradas, estornos e geração de retalhos."
      />

      <PageToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por código, perfil, usuário ou observação…"
        meta={
          <span>
            <strong className="text-foreground">{filtered.length}</strong> movimentação(ões)
          </span>
        }
      >
        <Select
          value={tipoFilter}
          onValueChange={(v) => setTipoFilter(v as EstoqueMovimentoTipo | "todos")}
        >
          <SelectTrigger className="h-8 w-full text-xs sm:w-48">
            <SelectValue placeholder="Tipo de movimentação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {(Object.keys(ESTOQUE_MOV_LABEL) as EstoqueMovimentoTipo[]).map((t) => (
              <SelectItem key={t} value={t}>
                {ESTOQUE_MOV_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageToolbar>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Operação</TableHead>
              <TableHead className="text-right">Qtd (cm)</TableHead>
              <TableHead className="text-right">Barras</TableHead>
              <TableHead className="text-right">Saldo Antes</TableHead>
              <TableHead className="text-right">Saldo Depois</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Observação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableLoadingRows columns={9} rows={6} />}

            {!isLoading &&
              filtered.map((m) => {
                const prod = prodMap.get(m.produto_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(m.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-xs text-muted-foreground">
                        {prod?.codigo ?? "—"}
                      </div>
                      <div className="text-xs font-medium text-foreground">{prod?.nome ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] font-normal">
                        {ESTOQUE_MOV_LABEL[m.tipo]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {Number(m.quantidade_cm).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {Number(m.quantidade_barras).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {Number(m.saldo_anterior_cm).toFixed(0)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold tabular-nums text-foreground">
                      {Number(m.saldo_posterior_cm).toFixed(0)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.usuario ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {m.observacao ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}

            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <EmptyState
                    icon={History}
                    title="Sem movimentações registradas"
                    description="As movimentações de reserva e consumo aparecerão aqui conforme os pedidos avançarem."
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
