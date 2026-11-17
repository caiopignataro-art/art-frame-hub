import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload, XCircle } from "lucide-react";
import { PageHeader } from "@/components/erp/PageHeader";
import { EmptyState } from "@/components/erp/EmptyState";
import { TableLoadingRows } from "@/components/erp/LoadingState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  PRODUTO_CATEGORIAS_IMPORTACAO,
  PRODUTO_TIPO_LABEL,
  type ProdutoCategoriaImportacao,
} from "@/types/erp";
import { parsePlanilha, type ParseResult } from "@/lib/importacao/parsers";
import { importacoesService } from "@/lib/services/importacoes.service";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/produtos/importacao")({
  head: () => ({ meta: [{ title: "Importação de Produtos — Art Frame Hub" }] }),
  component: ImportacaoPage,
});

function ImportacaoPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState<ProdutoCategoriaImportacao>("perfil_moldura");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  const historico = useQuery({
    queryKey: ["importacoes"],
    queryFn: () => importacoesService.list(20),
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult || !fileName) throw new Error("Selecione um arquivo");
      return importacoesService.commit({
        categoria: parseResult.categoria,
        arquivo_nome: fileName,
        rows: parseResult.rows,
        issues: parseResult.issues,
      });
    },
    onSuccess: (res) => {
      toast.success(
        `Importação concluída: ${res.inseridos} novo(s), ${res.atualizados} atualizado(s), ${res.erros} erro(s).`,
      );
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["importacoes"] });
      setParseResult(null);
      setFileName(null);
      if (fileInput.current) fileInput.current.value = "";
    },
    onError: (err: Error) => toast.error(`Falha na importação: ${err.message}`),
  });

  async function handleFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error("Planilha vazia");
      const ws = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
        defval: null,
      });
      const result = parsePlanilha(categoria, rawRows);
      setFileName(file.name);
      setParseResult(result);
      if (result.rows.length === 0) {
        toast.warning("Nenhuma linha válida encontrada na planilha.");
      } else {
        toast.success(`${result.rows.length} linha(s) prontas para importação.`);
      }
    } catch (e) {
      const err = e as Error;
      toast.error(`Erro ao ler arquivo: ${err.message}`);
      setParseResult(null);
      setFileName(null);
    }
  }

  const erros = useMemo(
    () => parseResult?.issues.filter((i) => i.severidade === "erro") ?? [],
    [parseResult],
  );
  const avisos = useMemo(
    () => parseResult?.issues.filter((i) => i.severidade === "aviso") ?? [],
    [parseResult],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Importação de Catálogo via XLSX"
        description="Carregue planilhas de fornecedores para inserir novos itens e atualizar preços ou saldos automaticamente."
      />

      <Card>
        <CardContent className="p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Categoria de destino
              </Label>
              <Select
                value={categoria}
                onValueChange={(v) => setCategoria(v as ProdutoCategoriaImportacao)}
              >
                <SelectTrigger className="max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUTO_CATEGORIAS_IMPORTACAO.map((c) => (
                    <SelectItem key={c} value={c}>
                      {PRODUTO_TIPO_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <Button variant="outline" onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4" />
              Selecionar planilha XLSX
            </Button>
            <Button
              disabled={!parseResult || parseResult.rows.length === 0 || commitMutation.isPending}
              onClick={() => commitMutation.mutate()}
            >
              <FileSpreadsheet className="h-4 w-4" />
              {commitMutation.isPending ? "Importando…" : "Confirmar importação"}
            </Button>
          </div>
          {fileName && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span>Arquivo selecionado:</span>
              <span className="font-mono font-medium text-foreground">{fileName}</span>
              <span>·</span>
              <span>
                Categoria:{" "}
                <strong className="text-foreground">{PRODUTO_TIPO_LABEL[categoria]}</strong>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {parseResult && (
        <div className="grid gap-3.5 sm:grid-cols-3">
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            label="Linhas válidas"
            value={parseResult.rows.length}
          />
          <StatCard
            icon={<XCircle className="h-4 w-4 text-destructive" />}
            label="Erros (ignoradas)"
            value={erros.length}
          />
          <StatCard
            icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
            label="Avisos"
            value={avisos.length}
          />
        </div>
      )}

      {parseResult && (erros.length > 0 || avisos.length > 0) && (
        <Alert variant={erros.length > 0 ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs font-semibold">
            Inconsistências identificadas na leitura
          </AlertTitle>
          <AlertDescription>
            <ScrollArea className="mt-2 max-h-40">
              <ul className="space-y-1 text-xs">
                {[...erros, ...avisos].slice(0, 50).map((i, idx) => (
                  <li key={idx}>
                    <Badge
                      variant={i.severidade === "erro" ? "destructive" : "warning"}
                      className="mr-2 px-1.5 py-0 text-[10px]"
                    >
                      L{i.linha}
                    </Badge>
                    {i.campo && <span className="font-mono">{i.campo}: </span>}
                    {i.mensagem}
                  </li>
                ))}
                {erros.length + avisos.length > 50 && <li className="text-muted-foreground">…</li>}
              </ul>
            </ScrollArea>
          </AlertDescription>
        </Alert>
      )}

      {parseResult && parseResult.rows.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/80 bg-muted/20 py-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pré-visualização ({parseResult.rows.length} linha
              {parseResult.rows.length === 1 ? "" : "s"})
            </CardTitle>
          </CardHeader>
          <ScrollArea className="max-h-[440px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Fabricante</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Acabamento</TableHead>
                  <TableHead className="text-right">Alt</TableHead>
                  <TableHead className="text-right">Larg</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead>Ativo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parseResult.rows.slice(0, 200).map((r) => (
                  <TableRow key={r.codigo}>
                    <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.fabricante ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.acabamento ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {r.altura_cm ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {r.largura_cm ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {formatBRL(r.preco_custo)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                      {formatBRL(r.preco_venda)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">
                      {r.estoque}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.ativo ? "success" : "secondary"}>
                        {r.ativo ? "Sim" : "Não"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border/80 bg-muted/20 py-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Histórico de Importações Realizadas
          </CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead className="text-right">Linhas</TableHead>
              <TableHead className="text-right">Inseridos</TableHead>
              <TableHead className="text-right">Atualizados</TableHead>
              <TableHead className="text-right">Erros</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historico.isLoading && <TableLoadingRows columns={8} rows={4} />}
            {!historico.isLoading &&
              historico.data?.map((h) => (
                <TableRow key={h.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {PRODUTO_TIPO_LABEL[h.categoria]}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {h.arquivo_nome}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {h.total_linhas}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-emerald-600">
                    {h.inseridos}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">
                    {h.atualizados}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums text-destructive">
                    {h.erros}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        h.status === "concluido"
                          ? "success"
                          : h.status === "parcial"
                            ? "warning"
                            : "destructive"
                      }
                    >
                      {h.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            {!historico.isLoading && historico.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <EmptyState
                    compact
                    icon={FileSpreadsheet}
                    title="Nenhuma importação registrada"
                    description="As planilhas importadas aparecerão aqui com estatísticas de inserção e atualização."
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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="mt-2 font-mono text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}
