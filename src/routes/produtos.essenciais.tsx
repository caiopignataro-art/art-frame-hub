import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Edit, Layers, Plus } from "lucide-react";
import { PageHeader } from "@/components/erp/PageHeader";
import { EmptyState } from "@/components/erp/EmptyState";
import { TableLoadingRows } from "@/components/erp/LoadingState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  head: () => ({ meta: [{ title: "Produtos Essenciais — Art Frame Hub" }] }),
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
    () =>
      (data ?? [])
        .filter((p) => p.tipo === tab)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [data, tab],
  );

  const countByCat = useMemo(() => {
    const map = new Map<ProdutoCategoriaEssencial, number>();
    for (const c of PRODUTO_CATEGORIAS_ESSENCIAIS) {
      map.set(c, (data ?? []).filter((p) => p.tipo === c).length);
    }
    return map;
  }, [data]);

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
        description="Cadastro de Proteção Frontal, Fundo, Impressão, Chassi e Serviços com código automático de 4 dígitos."
        actions={
          <Button size="sm" onClick={openCriar}>
            <Plus className="h-4 w-4" />
            Novo {PRODUTO_TIPO_LABEL[tab].toLowerCase()}
          </Button>
        }
      />

      {/* Seletor de categoria essencial */}
      <div className="mb-4 flex flex-wrap gap-1.5 rounded-lg border border-border/80 bg-muted/40 p-1">
        {PRODUTO_CATEGORIAS_ESSENCIAIS.map((c) => {
          const active = tab === c;
          const cnt = countByCat.get(c) ?? 0;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setTab(c)}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                active
                  ? "bg-background text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span>{PRODUTO_TIPO_LABEL[c]}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0 text-[10px] font-mono tabular-nums",
                  active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {cnt}
              </span>
            </button>
          );
        })}
      </div>

      {alertas.length > 0 && (
        <Alert variant="destructive" className="mb-4 border-destructive/30 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">
            Estoque crítico em {PRODUTO_TIPO_LABEL[tab]} ({alertas.length})
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5 text-xs">
              {alertas.map((p) => (
                <li key={p.id}>
                  <strong>{p.nome}</strong> — {Number(p.estoque)} {p.unidade_estoque ?? p.unidade}{" "}
                  restante(s) (mínimo {Number(p.estoque_minimo)})
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
              <TableHead>Un. Venda</TableHead>
              <TableHead>Un. Estoque</TableHead>
              <TableHead className="text-right">Custo</TableHead>
              <TableHead className="text-right">Venda</TableHead>
              {tab === "chassi" && <TableHead className="text-right">Acima limite/m²</TableHead>}
              {(tab === "protecao_frontal" || tab === "fundo") && (
                <TableHead className="text-right">Chapa</TableHead>
              )}
              <TableHead className="text-right">Estoque Real</TableHead>
              <TableHead className="text-right">Mín.</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableLoadingRows columns={13} rows={5} />}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={13} className="p-0">
                  <EmptyState
                    icon={Layers}
                    title={`Nenhum item em ${PRODUTO_TIPO_LABEL[tab]}`}
                    description="Cadastre itens essenciais para disponibilizá-los imediatamente na calculadora de orçamento."
                    action={
                      <Button size="sm" onClick={openCriar}>
                        <Plus className="h-4 w-4" />
                        Novo produto
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              rows.map((p) => {
                const critico =
                  p.ativo &&
                  Number(p.estoque_minimo ?? 0) > 0 &&
                  Number(p.estoque) <= Number(p.estoque_minimo);
                return (
                  <TableRow key={p.id} className={critico ? "bg-destructive/[0.04]" : undefined}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.codigo ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <span>{p.nome}</span>
                        {critico && (
                          <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                            Baixo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.unidade_venda ?? p.unidade}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.unidade_estoque ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {formatBRL(p.preco_custo)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                      {formatBRL(p.preco_venda)}
                    </TableCell>
                    {tab === "chassi" && (
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {p.preco_venda_acima_m2 != null ? formatBRL(p.preco_venda_acima_m2) : "—"}
                      </TableCell>
                    )}
                    {(tab === "protecao_frontal" || tab === "fundo") && (
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {p.chapa_largura_cm && p.chapa_altura_cm
                          ? `${p.chapa_largura_cm}×${p.chapa_altura_cm} cm`
                          : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      <InlineNumber
                        value={Number(p.estoque)}
                        onSave={(v) => inlineMutation.mutate({ id: p.id, patch: { estoque: v } })}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {Number(p.estoque_minimo ?? 0)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.fornecedor ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={p.ativo}
                        onCheckedChange={(v) =>
                          inlineMutation.mutate({ id: p.id, patch: { ativo: v } })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setCriando(false);
                          setEditing(p);
                        }}
                      >
                        <Edit className="mr-1 h-3.5 w-3.5" />
                        Editar
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

function InlineNumber({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(String(value));
  if (!edit) {
    return (
      <button
        type="button"
        title="Clique para editar"
        className="rounded px-1.5 py-0.5 transition-colors hover:bg-muted"
        onClick={() => {
          setV(String(value));
          setEdit(true);
        }}
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
      className="ml-auto h-7 w-24 text-right font-mono text-xs"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        setEdit(false);
        const n = Number(v);
        if (!isNaN(n) && n !== value) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEdit(false);
      }}
    />
  );
}
