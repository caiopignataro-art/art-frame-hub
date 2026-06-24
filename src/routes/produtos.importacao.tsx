import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, XCircle, Boxes, Info } from "lucide-react";
import { PRODUTO_CATEGORIAS_IMPORTACAO, PRODUTO_TIPO_LABEL, type ProdutoCategoriaImportacao } from "@/types/erp";
import { parsePlanilha, type ParseResult } from "@/lib/importacao/parsers";
import { importacoesService, type ImportacaoModo } from "@/lib/services/importacoes.service";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/produtos/importacao")({
  head: () => ({ meta: [{ title: "Importação de Produtos — Molduraria ERP" }] }),
  component: ImportacaoPage,
});

function ImportacaoPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState<ProdutoCategoriaImportacao>("perfil_moldura");
  const [modo, setModo] = useState<ImportacaoModo>("estoque");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const historico = useQuery({
    queryKey: ["importacoes"],
    queryFn: () => importacoesService.list(20),
  });

  const modoEstoqueDisponivel = categoria === "perfil_moldura";

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!parseResult || !fileName) throw new Error("Selecione um arquivo");
      return importacoesService.commit({
        categoria: parseResult.categoria,
        arquivo_nome: fileName,
        rows: parseResult.rows,
        issues: parseResult.issues,
        modo: modoEstoqueDisponivel ? modo : "completo",
      });
    },
    onSuccess: (res) => {
      if (res.modo === "estoque") {
        toast.success(
          `Estoque atualizado: ${res.somente_estoque} registro(s) · ${res.nao_encontrados} não encontrado(s) · ${res.erros} erro(s).`,
        );
      } else {
        toast.success(
          `Importação concluída: ${res.inseridos} novo(s), ${res.atualizados} atualizado(s), ${res.erros} erro(s).`,
        );
      }
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
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
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

  const erros = useMemo(() => parseResult?.issues.filter((i) => i.severidade === "erro") ?? [], [parseResult]);
  const avisos = useMemo(() => parseResult?.issues.filter((i) => i.severidade === "aviso") ?? [], [parseResult]);

  const modoEfetivo: ImportacaoModo = modoEstoqueDisponivel ? modo : "completo";

  return (
    <>
      <PageHeader
        title="Importação de produtos"
        description="Carregue planilhas XLSX para inserir e atualizar o catálogo automaticamente."
      />

      <Card className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <label className="mb-2 block text-sm font-medium">Categoria</label>
            <Select value={categoria} onValueChange={(v) => setCategoria(v as ProdutoCategoriaImportacao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRODUTO_CATEGORIAS_IMPORTACAO.map((c) => (
                  <SelectItem key={c} value={c}>{PRODUTO_TIPO_LABEL[c]}</SelectItem>
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
              if (f) handleFile(f);
            }}
          />
          <Button variant="outline" onClick={() => fileInput.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Selecionar XLSX
          </Button>
          <Button
            disabled={!parseResult || parseResult.rows.length === 0 || commitMutation.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            {commitMutation.isPending ? "Importando…" : "Confirmar importação"}
          </Button>
        </div>

        {modoEstoqueDisponivel && (
          <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Boxes className="h-4 w-4" /> Modo de Importação
            </div>
            <RadioGroup
              value={modo}
              onValueChange={(v) => setModo(v as ImportacaoModo)}
              className="grid gap-3 md:grid-cols-2"
            >
              <label
                htmlFor="modo-estoque"
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                  modo === "estoque" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <RadioGroupItem id="modo-estoque" value="estoque" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium">Atualizar Apenas Estoque <Badge variant="secondary" className="ml-1">padrão</Badge></div>
                  <p className="text-xs text-muted-foreground">
                    Localiza pelo <strong>Código</strong> e atualiza somente a quantidade. Preço,
                    descrição, perfil e demais campos cadastrais permanecem inalterados.
                  </p>
                </div>
              </label>
              <label
                htmlFor="modo-completo"
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                  modo === "completo" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <RadioGroupItem id="modo-completo" value="completo" className="mt-0.5" />
                <div className="space-y-1">
                  <div className="text-sm font-medium">Importação Completa</div>
                  <p className="text-xs text-muted-foreground">
                    Insere novos produtos e atualiza todos os campos (preços, descrição, dimensões,
                    estoque). Use para cadastro inicial ou atualização de catálogo.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>
        )}

        {!modoEstoqueDisponivel && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Importação completa</AlertTitle>
            <AlertDescription>
              O modo "Atualizar Apenas Estoque" está disponível apenas para a categoria
              <strong> Perfil de Moldura</strong>.
            </AlertDescription>
          </Alert>
        )}

        {fileName && (
          <p className="text-sm text-muted-foreground">
            Arquivo: <span className="font-mono">{fileName}</span> · Categoria:{" "}
            <strong>{PRODUTO_TIPO_LABEL[categoria]}</strong> · Modo:{" "}
            <strong>{modoEfetivo === "estoque" ? "Atualizar Apenas Estoque" : "Importação Completa"}</strong>
          </p>
        )}
      </Card>

      {parseResult && (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />} label="Linhas válidas" value={parseResult.rows.length} />
          <StatCard icon={<XCircle className="h-5 w-5 text-destructive" />} label="Erros (ignoradas)" value={erros.length} />
          <StatCard icon={<AlertTriangle className="h-5 w-5 text-amber-500" />} label="Avisos" value={avisos.length} />
        </div>
      )}

      {parseResult && (erros.length > 0 || avisos.length > 0) && (
        <Alert variant={erros.length > 0 ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Inconsistências encontradas</AlertTitle>
          <AlertDescription>
            <ScrollArea className="mt-2 max-h-40">
              <ul className="space-y-1 text-xs">
                {[...erros, ...avisos].slice(0, 50).map((i, idx) => (
                  <li key={idx}>
                    <Badge variant={i.severidade === "erro" ? "destructive" : "secondary"} className="mr-2">
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
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium">
            Pré-visualização ({parseResult.rows.length} linha{parseResult.rows.length === 1 ? "" : "s"})
          </div>
          <ScrollArea className="max-h-[480px]">
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
                    <TableCell>{r.fabricante ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.nome}</TableCell>
                    <TableCell>{r.acabamento ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.altura_cm ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.largura_cm ?? "—"}</TableCell>
                    <TableCell className={`text-right ${modoEfetivo === "estoque" ? "text-muted-foreground line-through" : ""}`}>{formatBRL(r.preco_custo)}</TableCell>
                    <TableCell className={`text-right ${modoEfetivo === "estoque" ? "text-muted-foreground line-through" : ""}`}>{formatBRL(r.preco_venda)}</TableCell>
                    <TableCell className="text-right font-semibold">{r.estoque}</TableCell>
                    <TableCell>
                      <Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Sim" : "Não"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
          {modoEfetivo === "estoque" && (
            <div className="border-t border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
              No modo "Atualizar Apenas Estoque" os campos riscados serão ignorados — somente a
              coluna <strong>Estoque</strong> será aplicada aos produtos existentes.
            </div>
          )}
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-sm font-medium">
          Histórico de importações
        </div>
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
            {historico.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">Carregando…</TableCell>
              </TableRow>
            )}
            {historico.data?.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="text-xs">{new Date(h.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell>{PRODUTO_TIPO_LABEL[h.categoria]}</TableCell>
                <TableCell className="font-mono text-xs">{h.arquivo_nome}</TableCell>
                <TableCell className="text-right">{h.total_linhas}</TableCell>
                <TableCell className="text-right">{h.inseridos}</TableCell>
                <TableCell className="text-right">{h.atualizados}</TableCell>
                <TableCell className="text-right">{h.erros}</TableCell>
                <TableCell>
                  <Badge variant={h.status === "concluido" ? "default" : h.status === "parcial" ? "secondary" : "destructive"}>
                    {h.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
            {historico.data?.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma importação ainda.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {modoEfetivo === "estoque" ? "Atualizar Apenas Estoque" : "Importação Completa"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {modoEfetivo === "estoque"
                ? "Esta operação atualizará somente as quantidades em estoque dos produtos existentes (identificados pelo Código). Nenhum preço ou dado cadastral será alterado."
                : "Esta operação poderá atualizar preços e informações cadastrais, além de inserir novos produtos. Tem certeza que deseja continuar?"}
              <br />
              <br />
              <span className="text-xs">
                Arquivo: <strong>{fileName}</strong> · Linhas válidas:{" "}
                <strong>{parseResult?.rows.length ?? 0}</strong>
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                commitMutation.mutate();
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      {icon}
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
    </Card>
  );
}
