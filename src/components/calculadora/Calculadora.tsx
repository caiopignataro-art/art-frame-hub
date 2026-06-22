import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Calculator as CalcIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { produtosService } from "@/lib/services/produtos.service";
import { pedidosService } from "@/lib/services/pedidos.service";
import { calculadoraService } from "@/lib/services/calculadora.service";
import { calcular } from "@/lib/calculadora/calculator";
import type {
  CalcInput,
  MaterialOrigem,
  PassePartoutSelecionado,
} from "@/lib/calculadora/types";
import type { Produto } from "@/types/erp";
import { formatBRL } from "@/lib/format";
import { ProdutoAutocomplete } from "./ProdutoAutocomplete";

const ORIGEM_LABEL: Record<MaterialOrigem, string> = {
  perfil_moldura: "Moldura",
  passe_partout: "Passe-partout",
  protecao_frontal: "Proteção frontal",
  fundo: "Fundo",
  servico: "Serviço",
};

export function Calculadora() {
  const perfilQ = useQuery({
    queryKey: ["produtos", "perfil_moldura"],
    queryFn: () => produtosService.list({ tipo: "perfil_moldura", ativo: true }),
  });
  const passeQ = useQuery({
    queryKey: ["produtos", "passe_partout"],
    queryFn: () => produtosService.list({ tipo: "passe_partout", ativo: true }),
  });
  const protecaoQ = useQuery({
    queryKey: ["produtos", "protecao_frontal"],
    queryFn: () => produtosService.list({ tipo: "protecao_frontal", ativo: true }),
  });
  const fundoQ = useQuery({
    queryKey: ["produtos", "fundo"],
    queryFn: () => produtosService.list({ tipo: "fundo", ativo: true }),
  });
  const servicosQ = useQuery({
    queryKey: ["produtos", "servico"],
    queryFn: () => produtosService.list({ tipo: "servico", ativo: true }),
  });
  const pedidosQ = useQuery({
    queryKey: ["pedidos", "ativos"],
    queryFn: () => pedidosService.list(),
  });

  const [quantidade, setQuantidade] = React.useState(1);
  const [largura, setLargura] = React.useState(30);
  const [altura, setAltura] = React.useState(40);
  const [molduras, setMolduras] = React.useState<Produto[]>([]);
  const [passes, setPasses] = React.useState<PassePartoutSelecionado[]>([]);
  const [protecao, setProtecao] = React.useState<Produto | null>(null);
  const [fundo, setFundo] = React.useState<Produto | null>(null);
  const [servicos, setServicos] = React.useState<Produto[]>([]);
  const [observacoes, setObservacoes] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [pickPedidoOpen, setPickPedidoOpen] = React.useState(false);
  const [selectedPedidoId, setSelectedPedidoId] = React.useState<string | null>(null);

  const input: CalcInput = React.useMemo(
    () => ({
      quantidade,
      largura_interna_cm: largura,
      altura_interna_cm: altura,
      molduras: molduras.filter(Boolean).map((produto) => ({ produto })),
      passe_partouts: passes.filter((pp) => pp.produto),
      protecao,
      fundo,
      servicos,
      observacoes: observacoes || undefined,
    }),
    [quantidade, largura, altura, molduras, passes, protecao, fundo, servicos, observacoes],
  );


  const result = React.useMemo(() => calcular(input), [input]);

  // ---- handlers ----
  const addMoldura = () => setMolduras((arr) => [...arr, null as unknown as Produto]);
  const setMoldura = (idx: number, p: Produto | null) =>
    setMolduras((arr) => arr.map((m, i) => (i === idx ? (p as Produto) : m)).filter(Boolean) as Produto[]);
  const removeMoldura = (idx: number) =>
    setMolduras((arr) => arr.filter((_, i) => i !== idx));

  const addPasse = () =>
    setPasses((arr) => [...arr, { produto: null as unknown as Produto, medida_cm: 5 }]);
  const setPasseProduto = (idx: number, p: Produto | null) =>
    setPasses((arr) =>
      arr
        .map((pp, i) => (i === idx ? { ...pp, produto: p as Produto } : pp))
        .filter((pp) => pp.produto) as PassePartoutSelecionado[],
    );
  const setPasseMedida = (idx: number, v: number) =>
    setPasses((arr) => arr.map((pp, i) => (i === idx ? { ...pp, medida_cm: v } : pp)));
  const removePasse = (idx: number) =>
    setPasses((arr) => arr.filter((_, i) => i !== idx));

  const toggleServico = (p: Produto, checked: boolean) =>
    setServicos((arr) =>
      checked ? [...arr.filter((s) => s.id !== p.id), p] : arr.filter((s) => s.id !== p.id),
    );

  const canSave =
    largura > 0 &&
    altura > 0 &&
    quantidade > 0 &&
    (molduras.length > 0 || servicos.length > 0 || protecao || fundo);

  const reset = () => {
    setQuantidade(1);
    setLargura(30);
    setAltura(40);
    setMolduras([]);
    setPasses([]);
    setProtecao(null);
    setFundo(null);
    setServicos([]);
    setObservacoes("");
  };

  const handleSalvarOrcamento = async () => {
    setSaving(true);
    try {
      const orc = await calculadoraService.salvarOrcamento(input, result);
      toast.success(`Orçamento #${orc.numero_orcamento} salvo`);
      reset();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao salvar orçamento");
    } finally {
      setSaving(false);
    }
  };

  const handleNovoPedido = async () => {
    setSaving(true);
    try {
      // salva orçamento automaticamente (auditoria/rastro)
      await calculadoraService.salvarOrcamento(input, result);
      const ped = await calculadoraService.criarPedidoNovo(input, result);
      toast.success(`Pedido #${ped.numero_pedido} criado`);
      reset();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao criar pedido");
    } finally {
      setSaving(false);
    }
  };

  const handleAdicionarPedido = async () => {
    if (!selectedPedidoId) return;
    setSaving(true);
    try {
      await calculadoraService.salvarOrcamento(input, result);
      const ped = await calculadoraService.adicionarAPedidoExistente(
        selectedPedidoId,
        input,
        result,
      );
      toast.success(`Adicionado ao pedido #${ped.numero_pedido}`);
      setPickPedidoOpen(false);
      setSelectedPedidoId(null);
      reset();
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao adicionar ao pedido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalcIcon className="h-5 w-5 text-primary" />
          Calculadora de Orçamento
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Funciona sem cliente cadastrado. Materiais carregados exclusivamente da
          base importada por XLSX.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ====== ENTRADA ====== */}
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Quantidade">
                <Input
                  type="number"
                  min={1}
                  value={quantidade}
                  onChange={(e) => setQuantidade(Number(e.target.value) || 1)}
                />
              </Field>
              <Field label="Largura interna (cm)">
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={largura}
                  onChange={(e) => setLargura(Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Altura interna (cm)">
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={altura}
                  onChange={(e) => setAltura(Number(e.target.value) || 0)}
                />
              </Field>
            </div>

            {/* Molduras */}
            <SectionHeader
              title="Perfil de Moldura"
              hint="Permite múltiplas molduras"
              onAdd={addMoldura}
              addLabel="Adicionar moldura"
            />
            <div className="space-y-2">
              {molduras.length === 0 && (
                <EmptyHint text="Nenhuma moldura selecionada." />
              )}
              {molduras.map((m, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="flex-1">
                    <ProdutoAutocomplete
                      produtos={perfilQ.data ?? []}
                      value={m?.id ?? null}
                      onChange={(p) => setMoldura(idx, p)}
                    />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeMoldura(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Passe-partout */}
            <SectionHeader
              title="Passe-partout"
              hint="Permite múltiplos passe-partouts, cada um com sua medida"
              onAdd={addPasse}
              addLabel="Adicionar passe-partout"
            />
            <div className="space-y-2">
              {passes.length === 0 && (
                <EmptyHint text="Sem passe-partout — a moldura encosta na arte." />
              )}
              {passes.map((pp, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_120px_auto] gap-2">
                  <ProdutoAutocomplete
                    produtos={passeQ.data ?? []}
                    value={pp.produto?.id ?? null}
                    onChange={(p) => setPasseProduto(idx, p)}
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    placeholder="Medida cm"
                    value={pp.medida_cm}
                    onChange={(e) => setPasseMedida(idx, Number(e.target.value) || 0)}
                  />
                  <Button variant="ghost" size="icon" onClick={() => removePasse(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Proteção / Fundo */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Proteção frontal">
                <Select
                  value={protecao?.id ?? "_none"}
                  onValueChange={(v) =>
                    setProtecao(v === "_none" ? null : (protecaoQ.data ?? []).find((p) => p.id === v) ?? null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— sem proteção —</SelectItem>
                    {(protecaoQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ""}{p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fundo">
                <Select
                  value={fundo?.id ?? "_none"}
                  onValueChange={(v) =>
                    setFundo(v === "_none" ? null : (fundoQ.data ?? []).find((p) => p.id === v) ?? null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— sem fundo —</SelectItem>
                    {(fundoQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ""}{p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* Serviços */}
            <div>
              <Label className="text-sm font-medium">Serviços</Label>
              <p className="text-xs text-muted-foreground mb-2">Seleção múltipla.</p>
              <div className="space-y-1 rounded-md border p-3 max-h-40 overflow-auto">
                {(servicosQ.data ?? []).length === 0 && (
                  <EmptyHint text="Nenhum serviço cadastrado na base." />
                )}
                {(servicosQ.data ?? []).map((s) => {
                  const checked = !!servicos.find((x) => x.id === s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleServico(s, !!v)}
                      />
                      <span className="flex-1">
                        {s.codigo ? `[${s.codigo}] ` : ""}{s.nome}
                      </span>
                      <span className="text-muted-foreground">{formatBRL(Number(s.preco_venda))}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <Field label="Observações">
              <Textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Notas internas, instruções de produção…"
              />
            </Field>
          </div>

          {/* ====== RESUMO ====== */}
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric label="Arte (interna)" value={`${result.largura_interna_cm} × ${result.altura_interna_cm} cm`} />
                <Metric
                  label="Tamanho final"
                  value={`${result.largura_final_cm} × ${result.altura_final_cm} cm`}
                  highlight
                />
                <Metric label="Σ passe-partout" value={`${result.soma_passe_partout_cm} cm`} />
                <Metric label="Quantidade" value={`${result.quantidade} quadro(s)`} />
                <Metric label="Perímetro moldura" value={`${result.perimetro_ml.toFixed(3)} m`} />
                <Metric label="Área materiais" value={`${result.area_m2.toFixed(4)} m²`} />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">Materiais utilizados</h4>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Custo</TableHead>
                      <TableHead className="text-right">Venda</TableHead>
                      <TableHead className="text-right">Lucro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.materiais.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-xs text-muted-foreground">
                          Selecione materiais para ver o resumo.
                        </TableCell>
                      </TableRow>
                    )}
                    {result.materiais.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="mr-1">
                            {ORIGEM_LABEL[m.origem]}
                          </Badge>
                          {m.codigo && (
                            <span className="font-mono text-muted-foreground">[{m.codigo}] </span>
                          )}
                          {m.descricao}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {m.quantidade} {m.unidade}
                        </TableCell>
                        <TableCell className="text-right text-xs">{formatBRL(m.custo_total)}</TableCell>
                        <TableCell className="text-right text-xs">{formatBRL(m.venda_total)}</TableCell>
                        <TableCell className="text-right text-xs">{formatBRL(m.lucro)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <Metric label="Custo total" value={formatBRL(result.total_custo)} />
              <Metric label="Venda total" value={formatBRL(result.total_venda)} highlight />
              <Metric label="Lucro bruto" value={formatBRL(result.lucro_bruto)} />
              <Metric label="Margem" value={`${result.margem_pct.toFixed(2)}%`} />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={reset} disabled={saving}>
                Cancelar
              </Button>
              <Button
                variant="secondary"
                onClick={handleSalvarOrcamento}
                disabled={!canSave || saving}
              >
                Salvar orçamento
              </Button>
              <Button
                variant="outline"
                onClick={() => setPickPedidoOpen(true)}
                disabled={!canSave || saving}
              >
                Adicionar a pedido existente
              </Button>
              <Button onClick={handleNovoPedido} disabled={!canSave || saving}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar a novo pedido
              </Button>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Diálogo: escolher pedido existente */}
      <Dialog open={pickPedidoOpen} onOpenChange={setPickPedidoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar a pedido existente</DialogTitle>
            <DialogDescription>
              Selecione um pedido em aberto para anexar este item calculado.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
            {(pedidosQ.data ?? []).length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">Nenhum pedido cadastrado.</p>
            )}
            {(pedidosQ.data ?? []).map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-3 p-3 text-sm cursor-pointer hover:bg-muted"
              >
                <input
                  type="radio"
                  name="pedido"
                  value={p.id}
                  checked={selectedPedidoId === p.id}
                  onChange={() => setSelectedPedidoId(p.id)}
                />
                <span className="flex-1">
                  <span className="font-mono">#{p.numero_pedido}</span> —{" "}
                  {p.cliente?.nome ?? <span className="italic text-muted-foreground">sem cliente</span>}
                </span>
                <Badge variant="outline">{p.status}</Badge>
                <span>{formatBRL(Number(p.valor_total))}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickPedidoOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleAdicionarPedido} disabled={!selectedPedidoId || saving}>
              Anexar item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ---------- helpers ----------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  hint,
  onAdd,
  addLabel,
}: {
  title: string;
  hint?: string;
  onAdd: () => void;
  addLabel: string;
}) {
  return (
    <div className="flex items-end justify-between">
      <div>
        <Label className="text-sm font-medium">{title}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-1" />
        {addLabel}
      </Button>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">{text}</p>;
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
