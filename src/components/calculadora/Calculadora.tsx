import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, Calculator as CalcIcon, ChevronRight } from "lucide-react";
import { PhotoManager } from "./PhotoManager";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { produtosService } from "@/lib/services/produtos.service";
import { calculadoraService, novoPedidoStore } from "@/lib/services/calculadora.service";
import { configuracoesService } from "@/lib/services/configuracoes.service";
import { CONFIG_KEYS } from "@/types/estoque";
import { calcular } from "@/lib/calculadora/calculator";
import type {
  CalcInput,
  MaterialOrigem,
  PassePartoutSelecionado,
  PasseOrdem,
} from "@/lib/calculadora/types";
import type { Produto, PedidoItemDraft } from "@/types/erp";
import { formatBRL } from "@/lib/format";
import { ProdutoAutocomplete } from "./ProdutoAutocomplete";

const ORIGEM_LABEL: Record<MaterialOrigem, string> = {
  perfil_moldura: "Moldura",
  passe_partout: "Passe-partout",
  protecao_frontal: "Proteção frontal",
  fundo: "Fundo",
  impressao: "Impressão",
  chassi: "Chassi",
  servico: "Serviço",
};

const MAX_FOTOS = 8;

export interface CalculadoraProps {
  /**
   * Quando fornecido, o botão "Adicionar" entrega o item-rascunho via callback
   * (sem navegar). Usado embutida na tela de Novo Pedido.
   */
  onAdd?: (item: PedidoItemDraft) => void;
  /** Texto do botão de cancelar (default: "Cancelar"). */
  cancelLabel?: string;
  /** Callback do botão Cancelar. Default: navegar para "/". */
  onCancel?: () => void;
  /** Item existente para edição — pré-preenche o formulário. */
  initialItem?: PedidoItemDraft;
  /** Rótulo do botão principal (default: "Adicionar"). */
  submitLabel?: string;
}

export function Calculadora({ onAdd, cancelLabel = "Cancelar", onCancel, initialItem, submitLabel = "Adicionar" }: CalculadoraProps) {
  const navigate = useNavigate();

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
  const impressaoQ = useQuery({
    queryKey: ["produtos", "impressao"],
    queryFn: () => produtosService.list({ tipo: "impressao", ativo: true }),
  });
  const chassiQ = useQuery({
    queryKey: ["produtos", "chassi"],
    queryFn: () => produtosService.list({ tipo: "chassi", ativo: true }),
  });
  const servicosQ = useQuery({
    queryKey: ["produtos", "servico"],
    queryFn: () => produtosService.list({ tipo: "servico", ativo: true }),
  });

  const [quantidadeStr, setQuantidadeStr] = React.useState("");
  const [larguraStr, setLarguraStr] = React.useState("");
  const [alturaStr, setAlturaStr] = React.useState("");

  const quantidade = quantidadeStr === "" ? 0 : Number(quantidadeStr);
  const largura = larguraStr === "" ? 0 : Number(larguraStr);
  const altura = alturaStr === "" ? 0 : Number(alturaStr);

  const [molduras, setMolduras] = React.useState<Produto[]>([]);
  const [passes, setPasses] = React.useState<PassePartoutSelecionado[]>([]);
  const [protecao, setProtecao] = React.useState<Produto | null>(null);
  const [fundo, setFundo] = React.useState<Produto | null>(null);
  const [impressao, setImpressao] = React.useState<Produto | null>(null);
  const [chassi, setChassi] = React.useState<Produto | null>(null);
  const [servicos, setServicos] = React.useState<Produto[]>([]);
  const [observacoes, setObservacoes] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Fotos do pedido (referências visuais — viajam com o item via metadados)
  const [imagens, setImagens] = React.useState<string[]>([]);

  const barraQ = useQuery({
    queryKey: ["config", CONFIG_KEYS.comprimento_barra_cm],
    queryFn: () => configuracoesService.getNumber(CONFIG_KEYS.comprimento_barra_cm, 270),
  });
  const barraCm = barraQ.data ?? 270;

  // Produção da moldura — seção recolhível (default retraída)
  const [producaoOpen, setProducaoOpen] = React.useState(false);

  // Restauração para edição
  const restoredRef = React.useRef(false);
  React.useEffect(() => {
    if (restoredRef.current || !initialItem) return;
    const md = initialItem.metadados as any;
    const en = md?.entrada;
    if (!en) { restoredRef.current = true; return; }
    const need = {
      mold: (en.molduras ?? []).length > 0,
      pass: (en.passe_partouts ?? []).length > 0,
      prot: !!en.protecao_id,
      fund: !!en.fundo_id,
      impr: !!en.impressao_id,
      chas: !!en.chassi_id,
      serv: (en.servicos ?? []).length > 0,
    };
    if (need.mold && !perfilQ.data) return;
    if (need.pass && !passeQ.data) return;
    if (need.prot && !protecaoQ.data) return;
    if (need.fund && !fundoQ.data) return;
    if (need.impr && !impressaoQ.data) return;
    if (need.chas && !chassiQ.data) return;
    if (need.serv && !servicosQ.data) return;

    setQuantidadeStr(String(initialItem.quantidade ?? ""));
    setLarguraStr(String(en.largura_arte_cm ?? ""));
    setAlturaStr(String(en.altura_arte_cm ?? ""));
    setMolduras(((en.molduras ?? []) as any[])
      .map((m) => (perfilQ.data ?? []).find((p) => p.id === m.produto_id))
      .filter(Boolean) as Produto[]);
    setPasses(((en.passe_partouts ?? []) as any[])
      .map((pp) => {
        const produto = (passeQ.data ?? []).find((p) => p.id === pp.produto_id);
        return produto ? { produto, medida_cm: pp.medida_cm, ordem: pp.ordem ?? undefined } : null;
      })
      .filter(Boolean) as PassePartoutSelecionado[]);
    setProtecao(en.protecao_id ? (protecaoQ.data ?? []).find((p) => p.id === en.protecao_id) ?? null : null);
    setFundo(en.fundo_id ? (fundoQ.data ?? []).find((p) => p.id === en.fundo_id) ?? null : null);
    setImpressao(en.impressao_id ? (impressaoQ.data ?? []).find((p) => p.id === en.impressao_id) ?? null : null);
    setChassi(en.chassi_id ? (chassiQ.data ?? []).find((p) => p.id === en.chassi_id) ?? null : null);
    setServicos(((en.servicos ?? []) as string[])
      .map((id) => (servicosQ.data ?? []).find((p) => p.id === id))
      .filter(Boolean) as Produto[]);
    setObservacoes(en.observacoes ?? "");
    setImagens(en.imagens ?? []);
    restoredRef.current = true;
  }, [initialItem, perfilQ.data, passeQ.data, protecaoQ.data, fundoQ.data, impressaoQ.data, chassiQ.data, servicosQ.data]);


  const input: CalcInput = React.useMemo(
    () => ({
      quantidade: quantidade || 1,
      largura_interna_cm: largura,
      altura_interna_cm: altura,
      molduras: molduras.filter(Boolean).map((produto) => ({ produto })),
      passe_partouts: passes.filter((pp) => pp.produto),
      protecao,
      fundo,
      impressao,
      chassi,
      servicos,
      observacoes: observacoes || undefined,
      imagens,
      barra_cm: barraCm,
    }),
    [quantidade, largura, altura, molduras, passes, protecao, fundo, impressao, chassi, servicos, observacoes, imagens, barraCm],
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
  const setPasseOrdem = (idx: number, ordem: PasseOrdem) =>
    setPasses((arr) => arr.map((pp, i) => (i === idx ? { ...pp, ordem } : pp)));
  const removePasse = (idx: number) =>
    setPasses((arr) => arr.filter((_, i) => i !== idx));

  const toggleServico = (p: Produto, checked: boolean) =>
    setServicos((arr) =>
      checked ? [...arr.filter((s) => s.id !== p.id), p] : arr.filter((s) => s.id !== p.id),
    );

  const canSave =
    quantidadeStr !== "" &&
    larguraStr !== "" &&
    alturaStr !== "" &&
    largura > 0 &&
    altura > 0 &&
    quantidade > 0 &&
    (molduras.length > 0 || servicos.length > 0 || protecao || fundo || impressao || chassi);

  const reset = () => {
    setQuantidadeStr("");
    setLarguraStr("");
    setAlturaStr("");
    setMolduras([]);
    setPasses([]);
    setProtecao(null);
    setFundo(null);
    setImpressao(null);
    setChassi(null);
    setServicos([]);
    setObservacoes("");
    setImagens([]);
  };

  const handleCancelar = () => {
    reset();
    if (onCancel) onCancel();
    else navigate({ to: "/" });
  };

  const handleAdicionar = () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const item = calculadoraService.buildDraftItem(input, result);
      if (onAdd) {
        onAdd(item);
        toast.success("Item adicionado ao pedido");
        reset();
      } else {
        novoPedidoStore.add(item);
        console.log("[Calculadora] item salvo em sessionStorage", item);
        toast.success("Item enviado para o novo pedido");
        reset();
        console.log("[Calculadora] navegando para /pedidos/novo");
        navigate({ to: "/pedidos/novo" });
      }
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
                  value={quantidadeStr}
                  onChange={(e) => setQuantidadeStr(e.target.value)}
                />
              </Field>
              <Field label="Largura (cm)">
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={larguraStr}
                  onChange={(e) => setLarguraStr(e.target.value)}
                />
              </Field>
              <Field label="Altura (cm)">
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  value={alturaStr}
                  onChange={(e) => setAlturaStr(e.target.value)}
                />
              </Field>
            </div>

            <SectionHeader
              title="Perfil de Moldura"
              hint="Permite múltiplas molduras"
              onAdd={addMoldura}
              addLabel="Adicionar moldura"
            />
            <div className="space-y-2">
              {molduras.length === 0 && <EmptyHint text="Nenhuma moldura selecionada." />}
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
              {passes.map((pp, idx) => {
                const showOrdem = passes.length > 1;
                return (
                  <div
                    key={idx}
                    className={`grid gap-2 ${showOrdem ? "grid-cols-[1fr_110px_130px_auto]" : "grid-cols-[1fr_120px_auto]"}`}
                  >
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
                    {showOrdem && (
                      <Select
                        value={pp.ordem ?? ""}
                        onValueChange={(v) => setPasseOrdem(idx, v as PasseOrdem)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Ordem" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interno">Interno</SelectItem>
                          <SelectItem value="meio">Meio</SelectItem>
                          <SelectItem value="externo">Externo</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => removePasse(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Impressão">
                <Select
                  value={impressao?.id ?? "_none"}
                  onValueChange={(v) =>
                    setImpressao(v === "_none" ? null : (impressaoQ.data ?? []).find((p) => p.id === v) ?? null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— sem impressão —</SelectItem>
                    {(impressaoQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ""}{p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Chassi">
                <Select
                  value={chassi?.id ?? "_none"}
                  onValueChange={(v) =>
                    setChassi(v === "_none" ? null : (chassiQ.data ?? []).find((p) => p.id === v) ?? null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— sem chassi —</SelectItem>
                    {(chassiQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ""}{p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div>
              <Label className="text-sm font-medium">Serviços</Label>
              <p className="text-xs text-muted-foreground mb-2">Seleção múltipla.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border p-3">
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

            {/* Fotos do pedido */}
            <PhotoManager
              value={imagens}
              onChange={setImagens}
              max={MAX_FOTOS}
              label="Adicionar fotos"
              hint="Tire fotos pela câmera (celular/tablet) ou selecione da galeria. Até 8 imagens."
            />
          </div>

          {/* ====== RESUMO ====== */}
          <div className="space-y-4">
            {/* Tamanhos */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <h4 className="text-sm font-semibold">Tamanhos</h4>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Arte</span>
                <span className="font-medium">
                  {result.largura_arte_cm} × {result.altura_arte_cm} cm
                </span>
              </div>
              {result.passe_partouts.length > 0 && (
                <div className="space-y-1">
                  {result.passe_partouts.map((pp, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Após PP{pp.ordem ? ` ${capitalize(pp.ordem)}` : ` ${i + 1}`} ({pp.medida_cm} cm)
                      </span>
                      <span>
                        {pp.apos_largura_cm} × {pp.apos_altura_cm} cm
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Abertura</span>
                <span>
                  {result.largura_abertura_cm} × {result.altura_abertura_cm} cm
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium">Tamanho final</span>
                <span className="font-semibold text-primary">
                  {result.largura_final_cm} × {result.altura_final_cm} cm
                </span>
              </div>
              {result.passe_partout_excede_chapa && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  ⚠ O tamanho final do Passe-partout ultrapassa a chapa padrão de 100 × 80 cm.
                </p>
              )}
            </div>

            {/* Produção da moldura */}
            {result.molduras.length > 0 && (
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="text-sm font-semibold">Produção da moldura</h4>
                {result.molduras.map((m, i) => (
                  <div key={i} className="space-y-1.5 text-xs">
                    <div className="font-medium text-sm">
                      {m.codigo && <span className="font-mono">[{m.codigo}] </span>}
                      {m.descricao}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      <span className="text-muted-foreground">Peça horizontal</span>
                      <span className="text-right">{m.peca_horizontal_cm} cm × 2</span>
                      <span className="text-muted-foreground">Peça vertical</span>
                      <span className="text-right">{m.peca_vertical_cm} cm × 2</span>
                      <span className="text-muted-foreground">Consumo comercial</span>
                      <span className="text-right">
                        {m.perimetro_comercial_m.toFixed(3)} m
                        {m.perimetro_cobrado_m > m.perimetro_comercial_m && (
                          <span className="text-amber-600 dark:text-amber-400"> (cobrado: {m.perimetro_cobrado_m.toFixed(2)} m)</span>
                        )}
                      </span>
                      <span className="text-muted-foreground">Barras necessárias</span>
                      <span className="text-right font-medium">{m.total_barras}</span>
                    </div>
                    <div className="rounded-md bg-muted/40 p-2 space-y-1">
                      {m.barras.map((b, bi) => (
                        <div key={bi} className="flex justify-between">
                          <span className="text-muted-foreground">Barra {bi + 1}</span>
                          <span>
                            {b.pecas.join(" + ")} cm
                            <span className="text-muted-foreground"> · retalho {b.retalho_cm} cm</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    {m.peca_excede_barra && (
                      <p className="text-xs text-destructive">
                        ⚠ Alguma peça excede o comprimento da barra ({barraCm} cm).
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Materiais */}
            <div>
              <h4 className="text-sm font-medium mb-2">Materiais utilizados</h4>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qtd</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.materiais.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-xs text-muted-foreground">
                          Selecione materiais para ver o resumo.
                        </TableCell>
                      </TableRow>
                    )}
                    {result.materiais.map((m, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">
                          <Badge variant="outline" className="mr-1">{ORIGEM_LABEL[m.origem]}</Badge>
                          {m.codigo && (
                            <span className="font-mono text-muted-foreground">[{m.codigo}] </span>
                          )}
                          {m.descricao}
                        </TableCell>
                        <TableCell className="text-right text-xs">{m.quantidade} {m.unidade}</TableCell>
                        <TableCell className="text-right text-xs">{formatBRL(m.valor_total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <Metric label="Valor unitário" value={formatBRL(result.valor_unitario)} />
              <Metric label="Valor total" value={formatBRL(result.valor_total)} highlight />
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button variant="outline" onClick={handleCancelar} disabled={saving}>
                {cancelLabel}
              </Button>
              <Button onClick={handleAdicionar} disabled={!canSave || saving}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
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
