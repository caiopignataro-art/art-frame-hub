import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Edit, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { produtosService } from "@/lib/services/produtos.service";
import {
  PRODUTO_TIPO_LABEL,
  PRODUTO_CATEGORIAS_ESSENCIAIS,
  type Produto,
  type ProdutoCategoriaEssencial,
} from "@/types/erp";
import { formatBRL } from "@/lib/format";
import { ProdutoEditDialog } from "@/components/produtos/ProdutoEditDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produtos/essenciais")({
  head: () => ({ meta: [{ title: "Produtos Essenciais — Molduraria ERP" }] }),
  component: EssenciaisPage,
});

function EssenciaisPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<ProdutoCategoriaEssencial>("protecao_frontal");
  const [editing, setEditing] = useState<Produto | null>(null);
  const [criando, setCriando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => produtosService.list(),
  });

  const rows = useMemo(
    () => (data ?? []).filter((p) => p.tipo === tab).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [data, tab],
  );

  const alertas = useMemo(
    () =>
      rows.filter(
        (p) =>
          p.ativo &&
          Number(p.estoque_minimo ?? 0) > 0 &&
          Number(p.estoque) <= Number(p.estoque_minimo),
      ),
    [rows],
  );

  const inlineMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Produto> }) =>
      produtosService.update(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["alertas-essenciais"] });
    },
    onError: (err) => toast.error(`Erro: ${(err as Error).message}`),
  });

  const openCriar = () => {
    setEditing(null);
    setCriando(true);
  };

  return (
    <>
      <PageHeader
        title="Produtos Essenciais"
        description="Cadastro manual de Proteção Frontal, Fundo, Impressão e Chassi. Códigos de 4 dígitos gerados automaticamente."
        actions={
          <Button onClick={openCriar}>
            <Plus className="mr-2 h-4 w-4" />
            Novo produto
          </Button>
        }
      />

      <div className="mb-4 flex gap-1 border-b border-border overflow-x-auto">
        {PRODUTO_CATEGORIAS_ESSENCIAIS.map((c) => (
          <button
            key={c}
            onClick={() => setTab(c)}
            className={cn(
              "border-b-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              tab === c
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {PRODUTO_TIPO_LABEL[c]}
          </button>
        ))}
      </div>

      {alertas.length > 0 && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>🔴 Estoque crítico</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5 text-sm">
              {alertas.map((p) => (
                <li key={p.id}>
                  <strong>{p.nome}</strong> — {Number(p.estoque)} {p.unidade_estoque ?? p.unidade} restante(s) (mínimo{" "}
                  {Number(p.estoque_minimo)})
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Un. venda</TableHead>
              <TableHead>Un. estoque</TableHead>
              <TableHead className="text-right">Preço compra</TableHead>
              <TableHead className="text-right">Preço venda</TableHead>
              {tab === "chassi" && <TableHead className="text-right">Acima limite/m²</TableHead>}
              {(tab === "protecao_frontal" || tab === "fundo") && (
                <TableHead className="text-right">Chapa</TableHead>
              )}
              <TableHead className="text-right">Estoque real</TableHead>
              <TableHead className="text-right">Mín.</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="text-center text-muted-foreground py-8">
                  Nenhum produto cadastrado. Clique em <strong>Novo produto</strong> para começar.
                </TableCell>
              </TableRow>
            )}
            {rows.map((p) => {
              const critico =
                p.ativo &&
                Number(p.estoque_minimo ?? 0) > 0 &&
                Number(p.estoque) <= Number(p.estoque_minimo);
              return (
                <TableRow key={p.id} className={critico ? "bg-destructive/5" : undefined}>
                  <TableCell className="font-mono text-xs">{p.codigo ?? "—"}</TableCell>
                  <TableCell className="font-medium">
                    {critico && <span className="mr-1">🔴</span>}
                    {p.nome}
                  </TableCell>
                  <TableCell className="text-xs">{p.unidade_venda ?? p.unidade}</TableCell>
                  <TableCell className="text-xs">{p.unidade_estoque ?? "—"}</TableCell>
                  <TableCell className="text-right">{formatBRL(p.preco_custo)}</TableCell>
                  <TableCell className="text-right">{formatBRL(p.preco_venda)}</TableCell>
                  {tab === "chassi" && (
                    <TableCell className="text-right">
                      {p.preco_venda_acima_m2 != null ? formatBRL(p.preco_venda_acima_m2) : "—"}
                    </TableCell>
                  )}
                  {(tab === "protecao_frontal" || tab === "fundo") && (
                    <TableCell className="text-right text-xs">
                      {p.chapa_largura_cm && p.chapa_altura_cm
                        ? `${p.chapa_largura_cm}×${p.chapa_altura_cm} cm`
                        : "—"}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <InlineNumber
                      value={Number(p.estoque)}
                      onSave={(v) => inlineMutation.mutate({ id: p.id, patch: { estoque: v } })}
                    />
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {Number(p.estoque_minimo ?? 0)}
                  </TableCell>
                  <TableCell className="text-xs">{p.fornecedor ?? "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={p.ativo}
                      onCheckedChange={(v) => inlineMutation.mutate({ id: p.id, patch: { ativo: v } })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => { setCriando(false); setEditing(p); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <ProdutoEditDialog
        produto={editing}
        criandoTipo={criando ? tab : undefined}
        open={!!editing || criando}
        onOpenChange={(v) => {
          if (!v) {
            setEditing(null);
            setCriando(false);
          }
        }}
      />
    </>
  );
}

function InlineNumber({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(String(value));
  if (!edit) {
    return (
      <button
        className="hover:underline text-sm"
        onClick={() => { setV(String(value)); setEdit(true); }}
      >
        {value}
      </button>
    );
  }
  return (
    <Input
      autoFocus
      type="number"
      step="0.001"
      className="h-7 w-24 text-right text-sm"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { setEdit(false); const n = Number(v); if (!isNaN(n) && n !== value) onSave(n); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEdit(false);
      }}
    />
  );
}
