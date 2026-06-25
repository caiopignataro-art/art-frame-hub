import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { historicoService } from "@/lib/services/historico.service";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/historico")({
  head: () => ({ meta: [{ title: "Histórico — Molduraria ERP" }] }),
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

  const entidades = useMemo(
    () => Array.from(new Set((data ?? []).map((h) => h.entidade))).sort(),
    [data],
  );
  const usuarios = useMemo(
    () => Array.from(new Set((data ?? []).map((h) => h.usuario).filter(Boolean) as string[])).sort(),
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
          h.entidade_id.toLowerCase().includes(q),
      );
    }
    return rows;
  }, [data, entidade, usuario, dataIni, dataFim, search]);

  return (
    <AppShell title="Histórico">
      <PageHeader
        title="Histórico de alterações"
        description="Auditoria automática: produto, data, usuário, campo alterado, valor anterior e valor novo."
      />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Input placeholder="Buscar descrição/ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={entidade} onValueChange={setEntidade}>
            <SelectTrigger><SelectValue placeholder="Entidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as entidades</SelectItem>
              {entidades.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={usuario} onValueChange={setUsuario}>
            <SelectTrigger><SelectValue placeholder="Usuário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os usuários</SelectItem>
              {usuarios.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dataIni} onChange={(e) => setDataIni(e.target.value)} />
          <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Quando</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Alterações</TableHead>
              <TableHead>Usuário</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>}
            {filtered.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(h.created_at)}</TableCell>
                <TableCell><Badge variant="outline">{h.entidade}</Badge></TableCell>
                <TableCell><Badge variant="secondary">{h.acao}</Badge></TableCell>
                <TableCell className="text-sm">{h.descricao ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  <FieldDiff antes={h.dados_antes} depois={h.dados_depois} />
                </TableCell>
                <TableCell className="text-xs">{h.usuario ?? "—"}</TableCell>
              </TableRow>
            ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum registro.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}

function FieldDiff({ antes, depois }: { antes: unknown; depois: unknown }) {
  if (!antes || !depois || typeof antes !== "object" || typeof depois !== "object") return <span className="text-muted-foreground">—</span>;
  const a = antes as Record<string, unknown>;
  const b = depois as Record<string, unknown>;
  const diffs: Array<{ campo: string; de: unknown; para: unknown }> = [];
  for (const k of Object.keys(b)) {
    if (k === "updated_at") continue;
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) {
      diffs.push({ campo: k, de: a[k], para: b[k] });
    }
  }
  if (diffs.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="space-y-0.5">
      {diffs.slice(0, 4).map((d) => (
        <div key={d.campo}>
          <span className="font-medium">{d.campo}:</span>{" "}
          <span className="text-red-600 line-through">{String(d.de ?? "—")}</span>{" → "}
          <span className="text-emerald-600">{String(d.para ?? "—")}</span>
        </div>
      ))}
      {diffs.length > 4 && <div className="text-muted-foreground">+{diffs.length - 4} campo(s)</div>}
    </div>
  );
}
