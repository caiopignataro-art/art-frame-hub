import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
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
import { produtosService, type BulkMode, type BulkScope } from "@/lib/services/produtos.service";
import { PRODUTO_CATEGORIAS_IMPORTACAO, PRODUTO_TIPO_LABEL, type ProdutoCategoriaImportacao } from "@/types/erp";
import { formatBRL } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  fabricantes: string[];
}

type ModeKind = "percentual" | "multiplicador" | "fixo";
type ScopeKind = "todos" | "categoria" | "fabricante" | "selecionados";

export function BulkPriceDialog({ open, onOpenChange, selectedIds, fabricantes }: Props) {
  const qc = useQueryClient();
  const [modeKind, setModeKind] = useState<ModeKind>("percentual");
  const [percent, setPercent] = useState("10");
  const [fator, setFator] = useState("1.25");
  const [precoFixo, setPrecoFixo] = useState("49.90");

  const [scopeKind, setScopeKind] = useState<ScopeKind>(selectedIds.length > 0 ? "selecionados" : "todos");
  const [categoria, setCategoria] = useState<ProdutoCategoriaImportacao>("perfil_moldura");
  const [fabricante, setFabricante] = useState<string>(fabricantes[0] ?? "");

  const [confirmOpen, setConfirmOpen] = useState(false);

  const mode: BulkMode = useMemo(() => {
    if (modeKind === "percentual") return { kind: "percentual", percent: Number(percent) || 0 };
    if (modeKind === "multiplicador") return { kind: "multiplicador", fator: Number(fator) || 1 };
    return { kind: "fixo", preco: Number(precoFixo) || 0 };
  }, [modeKind, percent, fator, precoFixo]);

  const scope: BulkScope = useMemo(() => {
    if (scopeKind === "categoria") return { kind: "categoria", tipo: categoria };
    if (scopeKind === "fabricante") return { kind: "fabricante", fabricante };
    if (scopeKind === "selecionados") return { kind: "ids", ids: selectedIds };
    return { kind: "todos" };
  }, [scopeKind, categoria, fabricante, selectedIds]);

  const preview = useQuery({
    queryKey: ["bulk-preview", scope, mode],
    queryFn: () => produtosService.bulkPreview(scope, mode),
    enabled: open,
  });

  const totals = useMemo(() => {
    const rows = preview.data ?? [];
    const totalAtual = rows.reduce((s, r) => s + r.preco_atual, 0);
    const totalNovo = rows.reduce((s, r) => s + r.preco_novo, 0);
    return { qtd: rows.length, totalAtual, totalNovo, diff: totalNovo - totalAtual };
  }, [preview.data]);

  const apply = useMutation({
    mutationFn: () => produtosService.bulkApply(scope, mode),
    onSuccess: (res) => {
      toast.success(`${res.afetados} produto(s) atualizado(s). Impacto: ${formatBRL(res.impactoVenda)}`);
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["historico"] });
      setConfirmOpen(false);
      onOpenChange(false);
    },
    onError: (err) => toast.error(`Erro: ${(err as Error).message}`),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Atualização em massa de preço de venda</DialogTitle>
            <DialogDescription>
              Selecione o modo de atualização e o escopo. A simulação é recalculada automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <Label className="mb-2 block text-xs uppercase text-muted-foreground">Modo</Label>
              <Tabs value={modeKind} onValueChange={(v) => setModeKind(v as ModeKind)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="percentual">%</TabsTrigger>
                  <TabsTrigger value="multiplicador">×</TabsTrigger>
                  <TabsTrigger value="fixo">Fixo</TabsTrigger>
                </TabsList>
                <TabsContent value="percentual" className="space-y-2 pt-3">
                  <Label>Percentual (ex: 10 = +10%, -5 = -5%)</Label>
                  <Input type="number" step="0.1" value={percent} onChange={(e) => setPercent(e.target.value)} />
                </TabsContent>
                <TabsContent value="multiplicador" className="space-y-2 pt-3">
                  <Label>Fator multiplicador (ex: 1,25)</Label>
                  <Input type="number" step="0.01" value={fator} onChange={(e) => setFator(e.target.value)} />
                </TabsContent>
                <TabsContent value="fixo" className="space-y-2 pt-3">
                  <Label>Novo preço fixo</Label>
                  <Input type="number" step="0.01" value={precoFixo} onChange={(e) => setPrecoFixo(e.target.value)} />
                </TabsContent>
              </Tabs>
            </Card>

            <Card className="p-4">
              <Label className="mb-2 block text-xs uppercase text-muted-foreground">Escopo</Label>
              <Select value={scopeKind} onValueChange={(v) => setScopeKind(v as ScopeKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os produtos</SelectItem>
                  <SelectItem value="categoria">Categoria específica</SelectItem>
                  <SelectItem value="fabricante">Fabricante específico</SelectItem>
                  <SelectItem value="selecionados" disabled={selectedIds.length === 0}>
                    Produtos selecionados ({selectedIds.length})
                  </SelectItem>
                </SelectContent>
              </Select>

              {scopeKind === "categoria" && (
                <div className="mt-3">
                  <Label>Categoria</Label>
                  <Select value={categoria} onValueChange={(v) => setCategoria(v as ProdutoCategoriaImportacao)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRODUTO_CATEGORIAS_IMPORTACAO.map((c) => (
                        <SelectItem key={c} value={c}>{PRODUTO_TIPO_LABEL[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {scopeKind === "fabricante" && (
                <div className="mt-3">
                  <Label>Fabricante</Label>
                  <Select value={fabricante} onValueChange={setFabricante}>
                    <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                    <SelectContent>
                      {fabricantes.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </Card>
          </div>

          <Card className="p-4">
            <div className="mb-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
              <div><div className="text-xs text-muted-foreground">Afetados</div><div className="text-lg font-semibold">{totals.qtd}</div></div>
              <div><div className="text-xs text-muted-foreground">Total atual</div><div className="text-lg font-semibold">{formatBRL(totals.totalAtual)}</div></div>
              <div><div className="text-xs text-muted-foreground">Total novo</div><div className="text-lg font-semibold">{formatBRL(totals.totalNovo)}</div></div>
              <div>
                <div className="text-xs text-muted-foreground">Diferença</div>
                <div className={`text-lg font-semibold ${totals.diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {totals.diff >= 0 ? "+" : ""}{formatBRL(totals.diff)}
                </div>
              </div>
            </div>

            <div className="max-h-64 overflow-auto rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Atual</TableHead>
                    <TableHead className="text-right">Novo</TableHead>
                    <TableHead className="text-right">Δ%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Calculando…</TableCell></TableRow>}
                  {preview.data?.slice(0, 200).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.codigo ?? "—"}</TableCell>
                      <TableCell className="text-sm">{r.nome}</TableCell>
                      <TableCell className="text-right">{formatBRL(r.preco_atual)}</TableCell>
                      <TableCell className="text-right font-medium">{formatBRL(r.preco_novo)}</TableCell>
                      <TableCell className={`text-right ${r.delta_pct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                        {r.delta_pct >= 0 ? "+" : ""}{r.delta_pct.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                  {preview.data?.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum produto no escopo.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {(preview.data?.length ?? 0) > 200 && (
              <p className="mt-2 text-xs text-muted-foreground">Exibindo 200 de {preview.data?.length} resultados na pré-visualização.</p>
            )}
          </Card>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={totals.qtd === 0}>
              Aplicar atualização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar atualização em massa</AlertDialogTitle>
            <AlertDialogDescription>
              Esta operação alterará permanentemente os preços de venda dos produtos selecionados.
              <br />
              <strong>{totals.qtd}</strong> produto(s) — impacto total{" "}
              <strong>{totals.diff >= 0 ? "+" : ""}{formatBRL(totals.diff)}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={apply.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => apply.mutate()} disabled={apply.isPending}>
              {apply.isPending ? "Aplicando…" : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
