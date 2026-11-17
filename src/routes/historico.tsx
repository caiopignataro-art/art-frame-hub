import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, History, List, Table2, User } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { PageToolbar } from "@/components/erp/PageToolbar";
import { EmptyState } from "@/components/erp/EmptyState";
import { TableLoadingRows } from "@/components/erp/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { historicoService } from "@/lib/services/historico.service";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/historico")({
  head: () => ({ meta: [{ title: "Histórico — Art Frame Hub" }] }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["historico"],
    queryFn: () => historicoService.list({ limit: 500 }),
  });

  const [search, setSearch] = useState("");
  const [entidade, setEntidade] = useState("todas");
  const [usuario, setUsuario] = useState("todos");
  const [dataIni, setDataIni] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [viewMode, setViewMode] = useState<"timeline" | "table">("timeline");

  const entidades = useMemo(
    () => Array.from(new Set((data ?? []).map((h) => h.entidade))).sort(),
    [data],
  );
  const usuarios = useMemo(
    () =>
      Array.from(new Set((data ?? []).map((h) => h.usuario).filter(Boolean) as string[])).sort(),
    [data],
  );

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (entidade !== "todas") rows = rows.filter((h) => h.entidade === entidade);
    if (usuario !== "todos") rows = rows.filter((h) => h.usuario === usuario);
    if (dataIni) rows = rows.filter((h) => h.created_at >= dataIni);
    if (dataFim) rows = rows.filter((h) => h.created_at <= dataFim + "T23:59:59");
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (h) =>
          (h.descricao ?? "").toLowerCase().includes(q) ||
          h.entidade_id.toLowerCase().includes(q) ||
          h.entidade.toLowerCase().includes(q) ||
          h.acao.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data, entidade, usuario, dataIni, dataFim, search]);

  return (
    <AppShell title="Histórico">
      <PageHeader
        title="Histórico e Trilha de Auditoria"
        description="Registro cronológico automático de todas as operações: entidade, ação, usuário, valores anteriores e novos."
        badge={
          data ? (
            <Badge variant="secondary" className="font-mono text-xs tabular-nums">
              {filtered.length}
            </Badge>
          ) : undefined
        }
        actions={
          <div className="inline-flex rounded-md border border-border/80 bg-muted/40 p-0.5">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "timeline" ? "default" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setViewMode("timeline")}
            >
              <List className="h-3.5 w-3.5" />
              Timeline
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "table" ? "default" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setViewMode("table")}
            >
              <Table2 className="h-3.5 w-3.5" />
              Tabela
            </Button>
          </div>
        }
      />

      <PageToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por descrição, entidade ou ID…"
        meta={
          <span>
            <strong className="text-foreground">{filtered.length}</strong> evento(s)
          </span>
        }
      >
        <Select value={entidade} onValueChange={setEntidade}>
          <SelectTrigger className="h-8 w-full text-xs sm:w-44">
            <SelectValue placeholder="Entidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as entidades</SelectItem>
            {entidades.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={usuario} onValueChange={setUsuario}>
          <SelectTrigger className="h-8 w-full text-xs sm:w-44">
            <SelectValue placeholder="Usuário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os usuários</SelectItem>
            {usuarios.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={dataIni}
            onChange={(e) => setDataIni(e.target.value)}
            className="h-8 w-36 text-xs"
            aria-label="Data inicial"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="h-8 w-36 text-xs"
            aria-label="Data final"
          />
        </div>
      </PageToolbar>

      {viewMode === "timeline" ? (
        <Card>
          <CardContent className="p-5">
            {isLoading && (
              <div className="space-y-4 py-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-md bg-muted/50" />
                ))}
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <EmptyState
                icon={History}
                title="Nenhum evento encontrado"
                description="Ajuste os filtros de período, entidade ou busca para visualizar registros de auditoria."
              />
            )}

            {!isLoading && filtered.length > 0 && (
              <div className="relative ml-2 space-y-4 border-l border-border/80 pl-5">
                {filtered.map((h) => (
                  <div
                    key={h.id}
                    className="relative rounded-lg border border-border/70 bg-background/60 p-3.5 transition-colors hover:border-border hover:bg-card"
                  >
                    <span className="absolute -left-[25px] top-4 flex h-2.5 w-2.5 items-center justify-center rounded-full border border-primary bg-background">
                      <span className="h-1 w-1 rounded-full bg-primary" />
                    </span>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {h.entidade}
                        </Badge>
                        <Badge
                          variant={
                            h.acao.includes("delete") || h.acao.includes("cancel")
                              ? "destructive"
                              : h.acao.includes("create") || h.acao.includes("insert")
                                ? "success"
                                : "secondary"
                          }
                          className="text-[11px]"
                        >
                          {h.acao}
                        </Badge>
                        <span className="text-xs font-medium text-foreground">
                          {h.descricao ?? "Operação registrada"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {h.usuario ?? "sistema"}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(h.created_at)}
                        </span>
                      </div>
                    </div>

                    <FieldDiff
                      antes={h.dados_antes}
                      depois={h.dados_depois}
                      className="mt-2.5 border-t border-border/50 pt-2"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data / Hora</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Alterações (Antes → Depois)</TableHead>
                <TableHead>Usuário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableLoadingRows columns={6} rows={6} />}
              {!isLoading &&
                filtered.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                      {formatDateTime(h.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {h.entidade}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[11px]">
                        {h.acao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-foreground">
                      {h.descricao ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <FieldDiff antes={h.dados_antes} depois={h.dados_depois} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {h.usuario ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={History}
                      title="Nenhum registro encontrado"
                      description="Ajuste os filtros informados para visualizar eventos."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </AppShell>
  );
}

function FieldDiff({
  antes,
  depois,
  className,
}: {
  antes: unknown;
  depois: unknown;
  className?: string;
}) {
  if (!antes || !depois || typeof antes !== "object" || typeof depois !== "object") {
    return null;
  }
  const a = antes as Record<string, unknown>;
  const b = depois as Record<string, unknown>;
  const diffs: Array<{ campo: string; de: unknown; para: unknown }> = [];
  for (const k of Object.keys(b)) {
    if (k === "updated_at") continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      diffs.push({ campo: k, de: a[k], para: b[k] });
    }
  }
  if (diffs.length === 0) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 text-xs ${className ?? ""}`}>
      {diffs.slice(0, 4).map((d) => (
        <span
          key={d.campo}
          className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/40 px-2 py-0.5 font-mono text-[11px]"
        >
          <span className="font-semibold text-foreground">{d.campo}:</span>
          <span className="text-destructive line-through">{String(d.de ?? "—")}</span>
          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            {String(d.para ?? "—")}
          </span>
        </span>
      ))}
      {diffs.length > 4 && (
        <span className="self-center text-[11px] text-muted-foreground">
          +{diffs.length - 4} campo(s)
        </span>
      )}
    </div>
  );
}
