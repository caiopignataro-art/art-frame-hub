import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Layers, Plus, Ruler, Scissors, Sparkles, Trash2 } from "lucide-react";
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
  MaterialCalculado,
} from "@/lib/calculadora/types";
import type { Produto, PedidoItemDraft } from "@/types/erp";
import { formatBRL } from "@/lib/format";
import { ProdutoAutocomplete } from "./ProdutoAutocomplete";

interface MetadadosSnapshotPayload {
  entrada?: {
    largura_arte_cm?: number;
    altura_arte_cm?: number;
    molduras?: { produto_id: string }[];
    passe_partouts?: { produto_id: string; medida_cm: number; ordem?: PasseOrdem }[];
    protecao_id?: string | null;
    fundo_id?: string | null;
    impressao_id?: string | null;
    chassi_id?: string | null;
    servicos?: string[];
    observacoes?: string | null;
    imagens?: string[];
    barra_cm?: number;
  };
  calculo?: {
    materiais?: MaterialCalculado[];
  };
}

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
  /** Texto do botão de cancelar (default: "Limpar"). */
  cancelLabel?: string;
  /** Callback do botão Cancelar. Default: navegar para "/". */
  onCancel?: () => void;
  /** Item existente para edição — pré-preenche o formulário. */
  initialItem?: PedidoItemDraft;
  /** Rótulo do botão principal (default: "Adicionar ao pedido"). */
  submitLabel?: string;
}

export function Calculadora({
  onAdd,
  cancelLabel = "Limpar",
  onCancel,
  initialItem,
  submitLabel = "Adicionar ao pedido",
}: CalculadoraProps) {
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

  const missingServicoIds = React.useMemo(() => {
    if (!initialItem) return [];
    const enServicos =
      (initialItem.metadados as MetadadosSnapshotPayload | undefined)?.entrada?.servicos ?? [];
    const activeSet = new Set((servicosQ.data ?? []).map((s) => s.id));
    return enServicos.filter((id) => !activeSet.has(id));
  }, [initialItem, servicosQ.data]);

  const historicServicosQ = useQuery({
    queryKey: ["produtos", "historicos", missingServicoIds],
    queryFn: async () => {
      if (missingServicoIds.length === 0) return [];
      const loaded: Produto[] = [];
      for (const id of missingServicoIds) {
        try {
          const p = await produtosService.get(id);
          if (p) loaded.push(p);
        } catch {
          // fallback no snapshot atenderá caso falhe
        }
      }
      return loaded;
    },
    enabled: missingServicoIds.length > 0 && !!servicosQ.data,
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
  const [imagens, setImagens] = React.useState<string[]>([]);

  const barraQ = useQuery({
    queryKey: ["config", CONFIG_KEYS.comprimento_barra_cm],
    queryFn: () => configuracoesService.getNumber(CONFIG_KEYS.comprimento_barra_cm, 270),
  });
  const barraCm = barraQ.data ?? 270;

  const [producaoOpen, setProducaoOpen] = React.useState(false);

  // Restauração para edição
  const restoredRef = React.useRef(false);
  React.useEffect(() => {
    if (restoredRef.current || !initialItem) return;
    const md = initialItem.metadados as MetadadosSnapshotPayload | undefined;
    const en = md?.entrada;
    if (!en) {
      restoredRef.current = true;
      return;
    }
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
    if (
      need.serv &&
      (!servicosQ.data || (missingServicoIds.length > 0 && !historicServicosQ.isFetched))
    )
      return;

    setQuantidadeStr(String(initialItem.quantidade ?? ""));
    setLarguraStr(String(en.largura_arte_cm ?? ""));
    setAlturaStr(String(en.altura_arte_cm ?? ""));
    setMolduras(
      (en.molduras ?? [])
        .map((m) => (perfilQ.data ?? []).find((p) => p.id === m.produto_id))
        .filter(Boolean) as Produto[],
    );
    setPasses(
      (en.passe_partouts ?? [])
        .map((pp) => {
          const produto = (passeQ.data ?? []).find((p) => p.id === pp.produto_id);
          return produto
            ? { produto, medida_cm: pp.medida_cm, ordem: pp.ordem ?? undefined }
            : null;
        })
        .filter(Boolean) as PassePartoutSelecionado[],
    );
    setProtecao(
      en.protecao_id ? ((protecaoQ.data ?? []).find((p) => p.id === en.protecao_id) ?? null) : null,
    );
    setFundo(en.fundo_id ? ((fundoQ.data ?? []).find((p) => p.id === en.fundo_id) ?? null) : null);
    setImpressao(
      en.impressao_id
        ? ((impressaoQ.data ?? []).find((p) => p.id === en.impressao_id) ?? null)
        : null,
    );
    setChassi(
      en.chassi_id ? ((chassiQ.data ?? []).find((p) => p.id === en.chassi_id) ?? null) : null,
    );

    const allServicosMap = new Map<string, Produto>();
    for (const s of servicosQ.data ?? []) allServicosMap.set(s.id, s);
    for (const s of historicServicosQ.data ?? []) allServicosMap.set(s.id, s);
    const materiaisCalculo = md?.calculo?.materiais ?? [];

    setServicos(
      (en.servicos ?? [])
        .map((id) => {
          const found = allServicosMap.get(id);
          if (found) return found;
          const mat = materiaisCalculo.find((m) => m.origem === "servico" && m.produto_id === id);
          if (mat) {
            return {
              id,
              codigo: mat.codigo ?? null,
              nome: mat.descricao,
              tipo: "servico",
              unidade: mat.unidade ?? "un",
              unidade_venda: mat.unidade ?? "un",
              unidade_estoque: mat.unidade ?? "un",
              preco_venda: Number(mat.preco_venda) || 0,
              preco_custo: 0,
              estoque: 0,
              ativo: false,
              created_at: "",
              updated_at: "",
            } as Produto;
          }
          return null;
        })
        .filter(Boolean) as Produto[],
    );

    setObservacoes(en.observacoes ?? "");
    setImagens(en.imagens ?? []);
    restoredRef.current = true;
  }, [
    initialItem,
    perfilQ.data,
    passeQ.data,
    protecaoQ.data,
    fundoQ.data,
    impressaoQ.data,
    chassiQ.data,
    servicosQ.data,
    historicServicosQ.data,
    historicServicosQ.isFetched,
    missingServicoIds,
  ]);

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
    [
      quantidade,
      largura,
      altura,
      molduras,
      passes,
      protecao,
      fundo,
      impressao,
      chassi,
      servicos,
      observacoes,
      imagens,
      barraCm,
    ],
  );

  const result = React.useMemo(() => calcular(input), [input]);

  // ---- handlers ----
  const addMoldura = () => setMolduras((arr) => [...arr, null as unknown as Produto]);
  const setMoldura = (idx: number, p: Produto | null) =>
    setMolduras(
      (arr) => arr.map((m, i) => (i === idx ? (p as Produto) : m)).filter(Boolean) as Produto[],
    );
  const removeMoldura = (idx: number) => setMolduras((arr) => arr.filter((_, i) => i !== idx));

  const addPasse = () =>
    setPasses((arr) => [...arr, { produto: null as unknown as Produto, medida_cm: 5 }]);
  const setPasseProduto = (idx: number, p: Produto | null) =>
    setPasses(
      (arr) =>
        arr
          .map((pp, i) => (i === idx ? { ...pp, produto: p as Produto } : pp))
          .filter((pp) => pp.produto) as PassePartoutSelecionado[],
    );
  const setPasseMedida = (idx: number, v: number) =>
    setPasses((arr) => arr.map((pp, i) => (i === idx ? { ...pp, medida_cm: v } : pp)));
  const setPasseOrdem = (idx: number, ordem: PasseOrdem) =>
    setPasses((arr) => arr.map((pp, i) => (i === idx ? { ...pp, ordem } : pp)));
  const removePasse = (idx: number) => setPasses((arr) => arr.filter((_, i) => i !== idx));

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
    else void navigate({ to: "/" });
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
        toast.success("Item enviado para o novo pedido");
        reset();
        void navigate({ to: "/pedidos/novo", search: {} });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_420px] items-start">
      {/* ====== COLUNA ESQUERDA: ESPECIFICAÇÃO DO QUADRO ====== */}
      <div className="space-y-4">
        {/* Bloco 1: Dimensões e Quantidade */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Ruler className="h-4 w-4 text-primary" />
              Dimensões da Arte e Quantidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Quantidade">
                <Input
                  type="number"
                  min={1}
                  placeholder="1"
                  value={quantidadeStr}
                  onChange={(e) => setQuantidadeStr(e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field label="Largura interna (cm)">
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="0.0"
                  value={larguraStr}
                  onChange={(e) => setLarguraStr(e.target.value)}
                  className="font-mono"
                />
              </Field>
              <Field label="Altura interna (cm)">
                <Input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="0.0"
                  value={alturaStr}
                  onChange={(e) => setAlturaStr(e.target.value)}
                  className="font-mono"
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        {/* Bloco 2: Perfis de Moldura e Passe-partout */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Layers className="h-4 w-4 text-primary" />
              Perfis de Moldura e Passe-partout
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2.5">
              <SectionRowHeader
                title="Perfil de Moldura"
                hint="Permite composição com múltiplas molduras sobrepostas"
                onAdd={addMoldura}
                addLabel="Adicionar moldura"
              />
              <div className="space-y-2">
                {molduras.length === 0 && <EmptyHint text="Nenhuma moldura selecionada." />}
                {molduras.map((m, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <ProdutoAutocomplete
                        produtos={perfilQ.data ?? []}
                        value={m?.id ?? null}
                        onChange={(p) => setMoldura(idx, p)}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeMoldura(idx)}
                      aria-label="Remover moldura"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-2.5">
              <SectionRowHeader
                title="Passe-partout"
                hint="Adicione uma ou mais camadas com margem em centímetros"
                onAdd={addPasse}
                addLabel="Adicionar passe-partout"
              />
              <div className="space-y-2">
                {passes.length === 0 && (
                  <EmptyHint text="Sem passe-partout — a moldura encosta diretamente na arte." />
                )}
                {passes.map((pp, idx) => {
                  const showOrdem = passes.length > 1;
                  return (
                    <div
                      key={idx}
                      className={`grid gap-2 ${
                        showOrdem
                          ? "grid-cols-1 sm:grid-cols-[1fr_100px_120px_auto]"
                          : "grid-cols-1 sm:grid-cols-[1fr_110px_auto]"
                      }`}
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
                        placeholder="Margem cm"
                        value={pp.medida_cm}
                        onChange={(e) => setPasseMedida(idx, Number(e.target.value) || 0)}
                        className="font-mono"
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
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => removePasse(idx)}
                        aria-label="Remover passe-partout"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bloco 3: Proteção, Fundo, Impressão e Chassi */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Componentes e Acabamentos Essenciais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Proteção frontal (Vidro / Acrílico)">
                <Select
                  value={protecao?.id ?? "_none"}
                  onValueChange={(v) =>
                    setProtecao(
                      v === "_none"
                        ? null
                        : ((protecaoQ.data ?? []).find((p) => p.id === v) ?? null),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— sem proteção —</SelectItem>
                    {(protecaoQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ""}
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Fundo (Eucatex / Foam)">
                <Select
                  value={fundo?.id ?? "_none"}
                  onValueChange={(v) =>
                    setFundo(
                      v === "_none" ? null : ((fundoQ.data ?? []).find((p) => p.id === v) ?? null),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— sem fundo —</SelectItem>
                    {(fundoQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ""}
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Impressão Fine Art / Fotográfica">
                <Select
                  value={impressao?.id ?? "_none"}
                  onValueChange={(v) =>
                    setImpressao(
                      v === "_none"
                        ? null
                        : ((impressaoQ.data ?? []).find((p) => p.id === v) ?? null),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— sem impressão —</SelectItem>
                    {(impressaoQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ""}
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Chassi de Madeira">
                <Select
                  value={chassi?.id ?? "_none"}
                  onValueChange={(v) =>
                    setChassi(
                      v === "_none" ? null : ((chassiQ.data ?? []).find((p) => p.id === v) ?? null),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— sem chassi —</SelectItem>
                    {(chassiQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo ? `[${p.codigo}] ` : ""}
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Separator />

            {/* Serviços */}
            <div className="space-y-2">
              <div>
                <Label className="text-xs font-semibold text-foreground">Serviços Adicionais</Label>
                <p className="text-[11px] text-muted-foreground">
                  Selecione um ou mais serviços aplicados a este item.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 rounded-md border border-border/80 bg-muted/20 p-3 sm:grid-cols-2">
                {(servicosQ.data ?? []).length === 0 && servicos.length === 0 && (
                  <EmptyHint text="Nenhum serviço cadastrado na base." />
                )}
                {(servicosQ.data ?? []).map((s) => {
                  const checked = !!servicos.find((x) => x.id === s.id);
                  return (
                    <label
                      key={s.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs transition-colors hover:bg-muted/60"
                    >
                      <Checkbox checked={checked} onCheckedChange={(v) => toggleServico(s, !!v)} />
                      <span className="flex-1 text-foreground">
                        {s.codigo ? (
                          <span className="font-mono text-muted-foreground">[{s.codigo}] </span>
                        ) : (
                          ""
                        )}
                        {s.nome}
                      </span>
                    </label>
                  );
                })}
                {servicos
                  .filter((s) => !(servicosQ.data ?? []).some((act) => act.id === s.id))
                  .map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-2 rounded border border-dashed border-border bg-muted/40 p-1.5 text-xs"
                    >
                      <Checkbox checked={true} onCheckedChange={(v) => toggleServico(s, !!v)} />
                      <span className="flex-1 text-muted-foreground">
                        {s.codigo ? `[${s.codigo}] ` : ""}
                        {s.nome}
                        <Badge
                          variant="warning"
                          className="ml-1.5 px-1 py-0 text-[10px] font-normal"
                        >
                          Inativo no catálogo
                        </Badge>
                      </span>
                    </label>
                  ))}
              </div>
            </div>

            <Separator />

            <Field label="Observações técnicas do item">
              <Textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Notas internas de montagem, distanciadores, instruções para a fábrica…"
              />
            </Field>

            <PhotoManager
              value={imagens}
              onChange={setImagens}
              max={MAX_FOTOS}
              label="Fotos e referências da obra"
              hint="Capture fotos pela câmera ou anexe da galeria (até 8 imagens)."
            />
          </CardContent>
        </Card>
      </div>

      {/* ====== COLUNA DIREITA: RESUMO TÉCNICO E FINANCEIRO ====== */}
      <div className="space-y-4 lg:sticky lg:top-20">
        {/* Tamanhos */}
        <Card>
          <CardHeader className="pb-2.5">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cálculo Dimensional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Medida da Arte</span>
              <span className="font-mono font-medium tabular-nums">
                {result.largura_arte_cm} × {result.altura_arte_cm} cm
              </span>
            </div>
            {result.passe_partouts.length > 0 && (
              <div className="space-y-1 border-l-2 border-border pl-2.5">
                {result.passe_partouts.map((pp, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Após PP{pp.ordem ? ` ${capitalize(pp.ordem)}` : ` ${i + 1}`} ({pp.medida_cm}{" "}
                      cm)
                    </span>
                    <span className="font-mono tabular-nums">
                      {pp.apos_largura_cm} × {pp.apos_altura_cm} cm
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Medida de Abertura</span>
              <span className="font-mono tabular-nums">
                {result.largura_abertura_cm} × {result.altura_abertura_cm} cm
              </span>
            </div>
            <Separator />
            <div className="flex items-center justify-between pt-0.5">
              <span className="font-medium text-foreground">Tamanho Final Externo</span>
              <span className="font-mono text-sm font-bold tabular-nums text-primary">
                {result.largura_final_cm} × {result.altura_final_cm} cm
              </span>
            </div>
            {result.passe_partouts.length > 0 && result.passe_partout_excede_chapa && (
              <p className="mt-1 rounded bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                ⚠ O tamanho final do Passe-partout ultrapassa a chapa padrão de 100 × 80 cm.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Produção da moldura (recolhível) */}
        {result.molduras.length > 0 && (
          <Collapsible
            open={producaoOpen}
            onOpenChange={setProducaoOpen}
            className="rounded-lg border border-border/85 bg-card"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Scissors className="h-3.5 w-3.5 text-primary" />
                Plano de Corte da Moldura ({result.molduras.length})
              </span>
              <ChevronRight
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  producaoOpen ? "rotate-90" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 border-t border-border/60 px-4 py-3">
              {result.molduras.map((m, i) => (
                <div key={i} className="space-y-1.5 text-xs">
                  <div className="font-medium text-foreground">
                    {m.codigo && (
                      <span className="font-mono text-muted-foreground">[{m.codigo}] </span>
                    )}
                    {m.descricao}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-muted-foreground">
                    <span>Peça horizontal</span>
                    <span className="text-right font-mono text-foreground">
                      {m.peca_horizontal_cm} cm × 2
                    </span>
                    <span>Peça vertical</span>
                    <span className="text-right font-mono text-foreground">
                      {m.peca_vertical_cm} cm × 2
                    </span>
                    <span>Consumo comercial</span>
                    <span className="text-right font-mono text-foreground">
                      {m.perimetro_comercial_m.toFixed(3)} m
                      {m.perimetro_cobrado_m > m.perimetro_comercial_m && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {" "}
                          (mín: {m.perimetro_cobrado_m.toFixed(2)} m)
                        </span>
                      )}
                    </span>
                    <span>Barras necessárias</span>
                    <span className="text-right font-mono font-semibold text-foreground">
                      {m.total_barras}
                    </span>
                  </div>
                  <div className="space-y-1 rounded-md bg-muted/40 p-2 font-mono text-[11px]">
                    {m.barras.map((b, bi) => (
                      <div key={bi} className="flex justify-between">
                        <span className="text-muted-foreground">Barra {bi + 1}</span>
                        <span>
                          {b.pecas.join(" + ")} cm
                          <span className="text-muted-foreground"> · sobra {b.retalho_cm} cm</span>
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
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Demonstrativo de Materiais e Fechamento */}
        <Card className="overflow-hidden border-primary/20">
          <CardHeader className="border-b border-border/70 bg-muted/20 pb-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Composição do Orçamento
            </CardTitle>
          </CardHeader>
          <div className="max-h-72 overflow-y-auto">
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
                    <TableCell
                      colSpan={3}
                      className="py-6 text-center text-xs text-muted-foreground"
                    >
                      Informe as dimensões e selecione os materiais para calcular.
                    </TableCell>
                  </TableRow>
                )}
                {result.materiais.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">
                      <Badge
                        variant="outline"
                        className="mr-1.5 px-1.5 py-0 text-[10px] font-normal"
                      >
                        {ORIGEM_LABEL[m.origem]}
                      </Badge>
                      {m.codigo && (
                        <span className="font-mono text-muted-foreground">[{m.codigo}] </span>
                      )}
                      <span className="font-medium text-foreground">{m.descricao}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {m.quantidade} {m.unidade}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium tabular-nums">
                      {formatBRL(m.valor_total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <CardContent className="space-y-4 border-t border-border/80 bg-primary/[0.02] pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-border/70 bg-background p-3">
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Valor Unitário
                </div>
                <div className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">
                  {formatBRL(result.valor_unitario)}
                </div>
              </div>
              <div className="rounded-md border border-primary/30 bg-background p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                  Valor Total ({quantidade || 1}×)
                </div>
                <div className="mt-1 font-mono text-lg font-bold tabular-nums text-primary">
                  {formatBRL(result.valor_total)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelar}
                disabled={saving}
                className="flex-1"
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                onClick={handleAdicionar}
                disabled={!canSave || saving}
                className="flex-2"
              >
                <Plus className="h-4 w-4" />
                {submitLabel}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
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

function SectionRowHeader({
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
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <Label className="text-xs font-semibold text-foreground">{title}</Label>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-dashed border-border/80 bg-muted/20 p-2.5 text-center text-xs text-muted-foreground">
      {text}
    </p>
  );
}
