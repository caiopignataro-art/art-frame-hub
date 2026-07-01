import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpDown, Download, Edit, Wand2 } from "lucide-react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { PRODUTO_TIPO_LABEL, PRODUTO_CATEGORIAS_IMPORTACAO, type Produto, type ProdutoTipo } from "@/types/erp";
import { formatBRL } from "@/lib/format";
import { ProdutoEditDialog } from "@/components/produtos/ProdutoEditDialog";
import { BulkPriceDialog } from "@/components/produtos/BulkPriceDialog";

export const Route = createFileRoute("/produtos/")({
  component: ProdutosPage,
});

type SortKey =
  | "codigo" | "nome" | "tipo" | "fabricante"
  | "preco_custo" | "preco_venda" | "estoque" | "ativo";

function ProdutosPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["produtos"], queryFn: () => produtosService.list() });

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
    () => Array.from(new Set((data ?? []).map((p) => p.fabricante).filter(Boolean) as string[])).sort(),
    [data],
  );

  const filtered = useMemo(() => {
    // Catálogo mostra apenas Molduras e Passe-partout (importadas via XLSX)
    let rows = (data ?? []).filter((p) => (PRODUTO_CATEGORIAS_IMPORTACAO as readonly ProdutoTipo[]).includes(p.tipo));
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
    if (filtroStatus !== "todos") rows = rows.filter((p) => (filtroStatus === "ativo" ? p.ativo : !p.ativo));

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

  // Inline edit
  const inlineMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Produto> }) =>
      produtosService.update(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["produtos"] }),
    onError: (err) => toast.error(`Erro: ${(err as Error).message}`),
  });

  // Export
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
        title="Produtos"
        description="Gerencie o catálogo importado: edição individual, atualização em massa e exportação."
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline"><Download className="mr-2 h-4 w-4" />Exportar</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportar("xlsx", "todos")}>XLSX — todos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportar("xlsx", "filtrados")}>XLSX — filtrados</DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportar("xlsx", "selecionados")} disabled={selected.size === 0}>
                  XLSX — selecionados ({selected.size})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportar("csv", "filtrados")}>CSV — filtrados</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => setBulkOpen(true)}>
              <Wand2 className="mr-2 h-4 w-4" />Atualização em massa
            </Button>
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <Input
            placeholder="Buscar por código, nome ou descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={filtroCat} onValueChange={setFiltroCat}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as categorias</SelectItem>
              {(Object.keys(PRODUTO_TIPO_LABEL) as ProdutoTipo[]).map((t) => (
                <SelectItem key={t} value={t}>{PRODUTO_TIPO_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroFab} onValueChange={setFiltroFab}>
            <SelectTrigger><SelectValue placeholder="Fabricante" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os fabricantes</SelectItem>
              {fabricantes.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativo</SelectItem>
              <SelectItem value="inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {filtered.length} produto(s) exibido(s) · {selected.size} selecionado(s)
        </p>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
              </TableHead>
              <SortHead label="Código" k="codigo" sortKey={sortKey} sortAsc={sortAsc} onClick={toggleSort} />
              <SortHead label="Descrição" k="nome" sortKey={sortKey} sortAsc={sortAsc} onClick={toggleSort} />
              <SortHead label="Categoria" k="tipo" sortKey={sortKey} sortAsc={sortAsc} onClick={toggleSort} />
              <SortHead label="Fábrica" k="fabricante" sortKey={sortKey} sortAsc={sortAsc} onClick={toggleSort} />
              <SortHead label="Preço Compra" k="preco_custo" sortKey={sortKey} sortAsc={sortAsc} onClick={toggleSort} align="right" />
              <SortHead label="Preço Venda" k="preco_venda" sortKey={sortKey} sortAsc={sortAsc} onClick={toggleSort} align="right" />
              <SortHead label="Qtd." k="estoque" sortKey={sortKey} sortAsc={sortAsc} onClick={toggleSort} align="right" />
              <SortHead label="Status" k="ativo" sortKey={sortKey} sortAsc={sortAsc} onClick={toggleSort} />
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell><Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggleOne(p.id)} /></TableCell>
                <TableCell className="font-mono text-xs">{p.codigo ?? "—"}</TableCell>
                <TableCell className="font-medium">{p.descricao ?? p.nome}</TableCell>
                <TableCell><Badge variant="outline">{PRODUTO_TIPO_LABEL[p.tipo]}</Badge></TableCell>
                <TableCell>{p.fabricante ?? "—"}</TableCell>
                <TableCell className="text-right">{formatBRL(p.preco_custo)}</TableCell>
                <TableCell className="text-right">
                  <InlineNumber
                    value={Number(p.preco_venda)}
                    onSave={(v) => inlineMutation.mutate({ id: p.id, patch: { preco_venda: v } })}
                    format={formatBRL}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <InlineNumber
                    value={Number(p.estoque)}
                    onSave={(v) => inlineMutation.mutate({ id: p.id, patch: { estoque: v } })}
                  />
                </TableCell>
                <TableCell>
                  <Switch
                    checked={p.ativo}
                    onCheckedChange={(v) => inlineMutation.mutate({ id: p.id, patch: { ativo: v } })}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                    <Edit className="mr-1 h-4 w-4" />Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">
                Nenhum produto encontrado.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <ProdutoEditDialog produto={editing} open={!!editing} onOpenChange={(o) => !o && setEditing(null)} />
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
  label, k, sortKey, sortAsc, onClick, align,
}: {
  label: string; k: SortKey; sortKey: SortKey; sortAsc: boolean;
  onClick: (k: SortKey) => void; align?: "right";
}) {
  const active = sortKey === k;
  return (
    <TableHead className={align === "right" ? "text-right" : ""}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
        {active && <span className="text-xs">{sortAsc ? "↑" : "↓"}</span>}
      </button>
    </TableHead>
  );
}

function InlineNumber({
  value, onSave, format,
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
        className="rounded px-1 py-0.5 hover:bg-muted"
        onClick={() => { setDraft(String(value)); setEditing(true); }}
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
      className="h-8 w-24 text-right"
    />
  );
}
