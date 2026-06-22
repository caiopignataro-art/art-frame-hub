import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { produtosService } from "@/lib/services/produtos.service";
import { PRODUTO_TIPO_LABEL } from "@/types/erp";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/produtos/")({
  component: ProdutosCatalogoPage,
});

function ProdutosCatalogoPage() {
  const { data, isLoading } = useQuery({ queryKey: ["produtos"], queryFn: () => produtosService.list() });

  return (
    <>
      <PageHeader
        title="Catálogo de produtos"
        description="Os produtos são alimentados exclusivamente via importação de planilhas XLSX."
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Fabricante</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Acabamento</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead>Ativo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">Carregando…</TableCell>
              </TableRow>
            )}
            {data?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">{p.codigo ?? "—"}</TableCell>
                <TableCell>{p.fabricante ?? "—"}</TableCell>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell>{PRODUTO_TIPO_LABEL[p.tipo]}</TableCell>
                <TableCell>{p.acabamento ?? "—"}</TableCell>
                <TableCell className="text-right">{formatBRL(p.preco_custo)}</TableCell>
                <TableCell className="text-right">{formatBRL(p.preco_venda)}</TableCell>
                <TableCell className="text-right">{Number(p.estoque)}</TableCell>
                <TableCell>
                  <Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Sim" : "Não"}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  Nenhum produto cadastrado. Use a aba <strong>Importação</strong> para carregar planilhas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
