import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { produtosService } from "@/lib/services/produtos.service";
import { PRODUTO_TIPO_LABEL } from "@/types/erp";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Molduraria ERP" }] }),
  component: ProdutosPage,
});

function ProdutosPage() {
  const { data, isLoading } = useQuery({ queryKey: ["produtos"], queryFn: () => produtosService.list() });

  return (
    <AppShell title="Produtos">
      <PageHeader
        title="Catálogo de produtos"
        description="Insumos utilizados na fabricação de quadros."
        actions={<Button disabled><Plus className="mr-2 h-4 w-4" /> Novo produto</Button>}
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Un.</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead>Ativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {data?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.codigo ?? "—"}</TableCell>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>{PRODUTO_TIPO_LABEL[p.tipo]}</TableCell>
                <TableCell>{p.unidade}</TableCell>
                <TableCell className="text-right">{formatBRL(p.preco_custo)}</TableCell>
                <TableCell className="text-right">{formatBRL(p.preco_venda)}</TableCell>
                <TableCell className="text-right">{Number(p.estoque)}</TableCell>
                <TableCell>
                  <Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Sim" : "Não"}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum produto.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}
