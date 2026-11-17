import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Scissors, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/erp/PageHeader";
import { PageToolbar } from "@/components/erp/PageToolbar";
import { EmptyState } from "@/components/erp/EmptyState";
import { TableLoadingRows } from "@/components/erp/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { RETALHO_STATUS_LABEL, type RetalhoStatus } from "@/types/estoque";
import { formatDate } from "@/lib/format";
import { produtosService } from "@/lib/services/produtos.service";

export const Route = createFileRoute("/estoque/retalhos")({
  component: RetalhosPage,
});

function RetalhosPage() {
  const qc = useQueryClient();
  const { data: retalhos, isLoading } = useQuery({
    queryKey: ["retalhos"],
    queryFn: () => estoqueService.listarRetalhos(),
  });
  const { data: produtos } = useQuery({
    queryKey: ["produtos", "perfis"],
    queryFn: () => produtosService.list({ tipo: "perfil_moldura" }),
  });
  const prodMap = useMemo(() => new Map((produtos ?? []).map((p) => [p.id, p])), [produtos]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RetalhoStatus | "todos">("todos");

  const descartar = useMutation({
    mutationFn: (id: string) => estoqueService.descartarRetalho(id),
    onSuccess: () => {
      toast.success("Retalho descartado");
      qc.invalidateQueries({ queryKey: ["retalhos"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const list = retalhos ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (statusFilter !== "todos" && r.status !== statusFilter) return false;
      if (!q) return true;
      const prod = prodMap.get(r.produto_id);
      return (
        (prod?.codigo ?? "").toLowerCase().includes(q) ||
        (prod?.nome ?? "").toLowerCase().includes(q)
      );
    });
  }, [retalhos, statusFilter, search, prodMap]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Aproveitamento de Retalhos"
        description="Sobras de cortes anteriores catalogadas por comprimento. São priorizadas automaticamente antes da abertura de novas barras."
      />

      <PageToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por código ou nome do perfil…"
        meta={
          <span>
            <strong className="text-foreground">{filtered.length}</strong> retalho(s)
          </span>
        }
      >
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as RetalhoStatus | "todos")}
        >
          <SelectTrigger className="h-8 w-full text-xs sm:w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {(Object.keys(RETALHO_STATUS_LABEL) as RetalhoStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {RETALHO_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageToolbar>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Perfil de Moldura</TableHead>
              <TableHead className="text-right">Comprimento (cm)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Data do Corte</TableHead>
              <TableHead>Data de Uso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableLoadingRows columns={7} rows={5} />}

            {!isLoading &&
              filtered.map((r) => {
                const prod = prodMap.get(r.produto_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-mono text-xs text-muted-foreground">
                        {prod?.codigo ?? "—"}
                      </div>
                      <div className="font-medium text-foreground">{prod?.nome ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                      {Number(r.comprimento_cm).toFixed(1)} cm
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          r.status === "disponivel"
                            ? "success"
                            : r.status === "usado"
                              ? "info"
                              : "secondary"
                        }
                      >
                        {RETALHO_STATUS_LABEL[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.origem_pedido_id ? "Pedido" : "Manual"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(r.data_corte)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.data_uso ? formatDate(r.data_uso) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "disponivel" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => descartar.mutate(r.id)}
                          disabled={descartar.isPending}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Descartar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="p-0">
                  <EmptyState
                    icon={Scissors}
                    title="Nenhum retalho registrado"
                    description="As sobras geradas pelo corte de barras nas ordens de produção aparecerão automaticamente aqui."
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
