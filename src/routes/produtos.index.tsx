import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpDown, Download, Edit, Package, Wand2 } from "lucide-react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/erp/PageHeader";
import { PageToolbar } from "@/components/erp/PageToolbar";
import { EmptyState } from "@/components/erp/EmptyState";
import { TableLoadingRows } from "@/components/erp/LoadingState";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { produtosService } from "@/lib/services/produtos.service";
import {
  PRODUTO_TIPO_LABEL,
  PRODUTO_CATEGORIAS_IMPORTACAO,
  type Produto,
  type ProdutoTipo,
} from "@/types/erp";
import { formatBRL } from "@/lib/format";
import { ProdutoEditDialog } from "@/components/produtos/ProdutoEditDialog";
import { BulkPriceDialog } from "@/components/produtos/BulkPriceDialog";

export const Route = createFileRoute("/produtos/")({
  component: ProdutosPage,
});

type SortKey =
  "codigo" | "nome" | "tipo" | "fabricante" | "preco_custo" | "preco_venda" | "estoque" | "ativo";

function ProdutosPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => produtosService.list(),
  });

  const [search, setSearch] = useState("");
  const [filtroCat, setFiltroCat] = useState<string>("todas");
  const [filtroFab, setFiltroFab] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [sortKey, setSortKey] = useState<SortKey>("nome");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Produto | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const fabricantes = useMemo(
    () =>
      Array.from(new Set((data ?? []).map((p) => p.fabricante).filter(Boolean) as string[])).sort(),
    [data],
  );

  const filtered = useMemo(() => {
    let rows = (data ?? []).filter((p) =>
      (PRODUTO_CATEGORIAS_IMPORTACAO as readonly ProdutoTipo[]).includes(p.tipo),
    );
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (p) =>
          (p.codigo ?? "").toLowerCase().includes(q) ||
          p.nome.toLowerCase().includes(q) ||
          (p.descricao ?? "").toLowerCase().includes(q),
      );
    }
    if (filtroCat !== "todas") rows = rows.filter((p) => p.tipo === filtroCat);
    if (filtroFab !== "todos") rows = rows.filter((p) => p.fabricante === filtroFab);
    if (filtroStatus !== "todos")
      rows = rows.filter((p) => (filtroStatus === "ativo" ? p.ativo : !p.ativo));

    const dir = sortAsc ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const va = (a as Record<string, unknown>)[sortKey];
      const vb = (b as Record<string, unknown>)[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "pt-BR", { numeric: true }) * dir;
    });
    return rows;
  }, [data, search, filtroCat, filtroFab, filtroStatus, sortKey, sortAsc]);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc);
    else {
      setSortKey(k);
      setSortAsc(true);
    }
  };

  const allChecked = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allChecked) filtered.forEach((p) => next.delete(p.id));
    else filtered.forEach((p) => next.add(p.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const inlineMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Produto> }) =>
      produtosService.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
    onError: (err) => toast.error(`Erro: ${(err as Error).message}`),
  });

  const exportar = (formato: "xlsx" | "csv", escopo: "todos" | "filtrados" | "selecionados") => {
    let rows: Produto[] = [];
    if (escopo === "todos") rows = data ?? [];
    else if (escopo === "filtrados") rows = filtered;
    else rows = (data ?? []).filter((p) => selected.has(p.id));
    if (rows.length === 0) {
      toast.error("Nenhum produto para exportar");
      return;
    }
    const sheet = rows.map((p) => ({
      Codigo: p.codigo ?? "",
      Descricao: p.descricao ?? p.nome,
      Nome: p.nome,
      Categoria: PRODUTO_TIPO_LABEL[p.tipo],
      Fabricante: p.fabricante ?? "",
      Perfil: p.perfil ?? "",
      Acabamento: p.acabamento ?? "",
      AlturaCm: p.altura_cm ?? "",
      LarguraCm: p.largura_cm ?? "",
      PrecoCompra: Number(p.preco_custo),
      PrecoVenda: Number(p.preco_venda),
      Quantidade: Number(p.estoque),
      Status: p.ativo ? "Ativo" : "Inativo",
    }));
    const ws = XLSX.utils.json_to_sheet(sheet);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    const filename = `produtos-${escopo}-${new Date().toISOString().slice(0, 10)}.${formato}`;
    XLSX.writeFile(wb, filename, { bookType: formato === "csv" ? "csv" : "xlsx" });
    toast.success(`${rows.length} produto(s) exportado(s)`);
  };

  return (
    <>
      <PageHeader
        title="Catálogo de Produtos"
        description="Gerencie perfis de moldura e passe-partout importados: edição inline, reajuste em massa e exportação."
        badge={
          <Badge variant="secondary" className="font-mono text-xs tabular-nums">
            {filtered.length}
          </Badge>
        }
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportar("xlsx", "todos")}>
                  XLSX — Todos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportar("xlsx", "filtrados")}>
                  XLSX — Filtrados ({filtered.length})
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => exportar("xlsx", "selecionados")}
                  disabled={selected.size === 0}
                >
                  XLSX — Selecionados ({selected.size})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportar("csv", "filtrados")}>
                  CSV — Filtrados ({filtered.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" onClick={() => setBulkOpen(true)}>
              <Wand2 className="h-3.5 w-3.5" />
              Atualização em massa
            </Button>
          </>
        }
      />

      <PageToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por código, nome ou descrição…"
        meta={
          <span>
            <strong className="text-foreground">{filtered.length}</strong> exibido(s)
            {selected.size > 0 && (
              <>
                {" · "}
                <strong className="text-primary">{selected.size}</strong> selecionado(s)
              </>
            )}
          </span>
        }
      >
        <Select value={filtroCat} onValueChange={setFiltroCat}>
          <SelectTrigger className="h-8 w-full text-xs sm:w-52">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {(PRODUTO_CATEGORIAS_IMPORTACAO as readonly ProdutoTipo[]).map((t) => (
              <SelectItem key={t} value={t}>
                {PRODUTO_TIPO_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroFab} onValueChange={setFiltroFab}>
          <SelectTrigger className="h-8 w-full text-xs sm:w-44">
            <SelectValue placeholder="Fabricante" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os fabricantes</SelectItem>
            {fabricantes.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="h-8 w-full text-xs sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="inativo">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </PageToolbar>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
              </TableHead>
              <SortHead
                label="Código"
                k="codigo"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onClick={toggleSort}
              />
              <SortHead
                label="Descrição"
                k="nome"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onClick={toggleSort}
              />
              <SortHead
                label="Categoria"
                k="tipo"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onClick={toggleSort}
              />
              <SortHead
                label="Fábrica"
                k="fabricante"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onClick={toggleSort}
              />
              <SortHead
                label="Custo"
                k="preco_custo"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onClick={toggleSort}
                align="right"
              />
              <SortHead
                label="Venda"
                k="preco_venda"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onClick={toggleSort}
                align="right"
              />
              <SortHead
                label="Estoque"
                k="estoque"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onClick={toggleSort}
                align="right"
              />
              <SortHead
                label="Ativo"
                k="ativo"
                sortKey={sortKey}
                sortAsc={sortAsc}
                onClick={toggleSort}
              />
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableLoadingRows columns={10} rows={8} />}

            {!isLoading &&
              filtered.map((p) => (
                <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggleOne(p.id)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs font-medium text-muted-foreground">
                    {p.codigo ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {p.descricao ?? p.nome}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={p.tipo === "perfil_moldura" ? "secondary" : "outline"}
                      className="text-[11px] font-normal"
                    >
                      {PRODUTO_TIPO_LABEL[p.tipo]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.fabricante ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {formatBRL(p.preco_custo)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                    <InlineNumber
                      value={Number(p.preco_venda)}
                      onSave={(v) => inlineMutation.mutate({ id: p.id, patch: { preco_venda: v } })}
                      format={formatBRL}
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    <InlineNumber
                      value={Number(p.estoque)}
                      onSave={(v) => inlineMutation.mutate({ id: p.id, patch: { estoque: v } })}
                    />
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
                      onClick={() => setEditing(p)}
                    >
                      <Edit className="mr-1 h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="p-0">
                  <EmptyState
                    icon={Package}
                    title="Nenhum produto encontrado"
                    description="Ajuste os filtros de busca ou importe uma planilha XLSX na aba Importação."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <ProdutoEditDialog
        produto={editing}
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
      />
      <BulkPriceDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        selectedIds={Array.from(selected)}
        fabricantes={fabricantes}
      />
    </>
  );
}

function SortHead({
  label,
  k,
  sortKey,
  sortAsc,
  onClick,
  align,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortAsc: boolean;
  onClick: (k: SortKey) => void;
  align?: "right";
}) {
  const active = sortKey === k;
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${
          active ? "font-semibold text-foreground" : ""
        }`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
        {active && <span className="text-[10px]">{sortAsc ? "↑" : "↓"}</span>}
      </button>
    </TableHead>
  );
}

function InlineNumber({
  value,
  onSave,
  format,
}: {
  value: number;
  onSave: (v: number) => void;
  format?: (v: number) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (!editing) {
    return (
      <button
        type="button"
        title="Clique para editar"
        className="rounded px-1.5 py-0.5 transition-colors hover:bg-muted"
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
        }}
      >
        {format ? format(value) : value}
      </button>
    );
  }
  const commit = () => {
    const n = Number(draft);
    if (!Number.isNaN(n) && n !== value) onSave(n);
    setEditing(false);
  };
  return (
    <Input
      type="number"
      step="0.01"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="ml-auto h-7 w-24 text-right font-mono text-xs"
    />
  );
}
