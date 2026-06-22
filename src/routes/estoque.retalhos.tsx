import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { estoqueService } from "@/lib/services/estoque.service";
import { RETALHO_STATUS_LABEL } from "@/types/estoque";
import { formatDate } from "@/lib/format";
import { produtosService } from "@/lib/services/produtos.service";

export const Route = createFileRoute("/estoque/retalhos")({
  component: RetalhosPage,
});

function RetalhosPage() {
  const qc = useQueryClient();
  const { data: retalhos } = useQuery({
    queryKey: ["retalhos"],
    queryFn: () => estoqueService.listarRetalhos(),
  });
  const { data: produtos } = useQuery({
    queryKey: ["produtos", "perfis"],
    queryFn: () => produtosService.list({ tipo: "perfil_moldura" }),
  });
  const prodMap = new Map((produtos ?? []).map((p) => [p.id, p]));

  const descartar = useMutation({
    mutationFn: (id: string) => estoqueService.descartarRetalho(id),
    onSuccess: () => {
      toast.success("Retalho descartado");
      qc.invalidateQueries({ queryKey: ["retalhos"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Aproveitamento de retalhos"
        description="Sobras de cortes anteriores. São consumidas automaticamente antes de novas barras."
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-right">Comprimento (cm)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Data corte</TableHead>
                <TableHead>Data uso</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(retalhos ?? []).map((r) => {
                const prod = prodMap.get(r.produto_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-mono text-xs text-muted-foreground">{prod?.codigo}</div>
                      <div>{prod?.nome ?? "—"}</div>
                    </TableCell>
                    <TableCell className="text-right">{Number(r.comprimento_cm).toFixed(1)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "disponivel" ? "secondary" : "outline"}>
                        {RETALHO_STATUS_LABEL[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.origem_pedido_id ? "Pedido" : "Manual"}
                    </TableCell>
                    <TableCell>{formatDate(r.data_corte)}</TableCell>
                    <TableCell>{r.data_uso ? formatDate(r.data_uso) : "—"}</TableCell>
                    <TableCell className="text-right">
                      {r.status === "disponivel" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => descartar.mutate(r.id)}
                          disabled={descartar.isPending}
                        >
                          Descartar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(retalhos ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    Nenhum retalho registrado.
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
