import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { produtosService } from "@/lib/services/produtos.service";
import { PRODUTO_TIPO_LABEL, type Produto, type ProdutoTipo, type ProdutoInsert, type ProdutoUpdate } from "@/types/erp";
import { FORMA_ESTOQUE_LABEL, type FormaEstoque } from "@/types/estoque";

interface Props {
  produto: Produto | null;
  /** Categoria alvo quando em modo criação (produto === null). */
  criandoTipo?: ProdutoTipo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FormState = {
  nome: string;
  descricao: string;
  ativo: boolean;
  preco_custo: string;
  preco_venda: string;
  preco_venda_acima_m2: string;
  preco_venda_limite_m2: string;
  unidade: string;
  unidade_venda: string;
  unidade_estoque: string;
  estoque: string;
  estoque_ideal: string;
  estoque_minimo: string;
  fornecedor: string;
  chapa_largura_cm: string;
  chapa_altura_cm: string;
  observacoes: string;
  perfil: string;
  acabamento: string;
  altura_cm: string;
  largura_cm: string;
  forma_estoque: string;
};

const empty: FormState = {
  nome: "",
  descricao: "",
  ativo: true,
  preco_custo: "0",
  preco_venda: "0",
  preco_venda_acima_m2: "",
  preco_venda_limite_m2: "",
  unidade: "un",
  unidade_venda: "m2",
  unidade_estoque: "m2",
  estoque: "0",
  estoque_ideal: "0",
  estoque_minimo: "0",
  fornecedor: "",
  chapa_largura_cm: "",
  chapa_altura_cm: "",
  observacoes: "",
  perfil: "",
  acabamento: "",
  altura_cm: "",
  largura_cm: "",
  forma_estoque: "unidade",
};

const UNIDADES_VENDA = ["m2", "metro_linear", "un"];
const UNIDADES_ESTOQUE = ["m2", "metro_linear", "chapas", "caixas", "un"];

export function ProdutoEditDialog({ produto, criandoTipo, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);
  const criando = !produto;
  const tipo: ProdutoTipo = produto?.tipo ?? criandoTipo ?? "outro";

  useEffect(() => {
    if (produto) {
      setForm({
        nome: produto.nome ?? "",
        descricao: produto.descricao ?? "",
        ativo: produto.ativo,
        preco_custo: String(produto.preco_custo ?? 0),
        preco_venda: String(produto.preco_venda ?? 0),
        preco_venda_acima_m2: produto.preco_venda_acima_m2 != null ? String(produto.preco_venda_acima_m2) : "",
        preco_venda_limite_m2: produto.preco_venda_limite_m2 != null ? String(produto.preco_venda_limite_m2) : "",
        unidade: produto.unidade ?? "un",
        unidade_venda: produto.unidade_venda ?? "m2",
        unidade_estoque: produto.unidade_estoque ?? "m2",
        estoque: String(produto.estoque ?? 0),
        estoque_ideal: String(produto.estoque_ideal ?? 0),
        estoque_minimo: String(produto.estoque_minimo ?? 0),
        fornecedor: produto.fornecedor ?? "",
        chapa_largura_cm: produto.chapa_largura_cm != null ? String(produto.chapa_largura_cm) : "",
        chapa_altura_cm: produto.chapa_altura_cm != null ? String(produto.chapa_altura_cm) : "",
        observacoes: produto.observacoes ?? "",
        perfil: produto.perfil ?? "",
        acabamento: produto.acabamento ?? "",
        altura_cm: produto.altura_cm != null ? String(produto.altura_cm) : "",
        largura_cm: produto.largura_cm != null ? String(produto.largura_cm) : "",
        forma_estoque: produto.forma_estoque ?? "unidade",
      });
    } else {
      // Defaults sensatos por categoria em modo criação
      const t = criandoTipo ?? "outro";
      setForm({
        ...empty,
        unidade_venda: t === "chassi" ? "metro_linear" : "m2",
        unidade_estoque:
          t === "chassi" ? "metro_linear" : t === "protecao_frontal" || t === "fundo" ? "chapas" : "m2",
        unidade: t === "chassi" ? "metro_linear" : "m2",
        forma_estoque:
          t === "perfil_moldura"
            ? "barras"
            : t === "protecao_frontal" || t === "fundo"
              ? "chapas"
              : t === "passe_partout"
                ? "chapas"
                : "unidade",
      });
    }
  }, [produto, criandoTipo, open]);

  const isPerfil = tipo === "perfil_moldura";
  const isChassi = tipo === "chassi";
  const isChapa = tipo === "protecao_frontal" || tipo === "fundo";

  const num = (s: string): number | null => (s === "" ? null : Number(s));

  const mutation = useMutation({
    mutationFn: async () => {
      const base = {
        nome: form.nome || "(sem nome)",
        descricao: form.descricao || null,
        ativo: form.ativo,
        preco_custo: Number(form.preco_custo) || 0,
        preco_venda: Number(form.preco_venda) || 0,
        preco_venda_acima_m2: num(form.preco_venda_acima_m2),
        preco_venda_limite_m2: num(form.preco_venda_limite_m2),
        unidade: form.unidade || "un",
        unidade_estoque: form.unidade_estoque || null,
        unidade_venda: form.unidade_venda || null,
        estoque: Number(form.estoque) || 0,
        forma_estoque: form.forma_estoque as FormaEstoque,
        estoque_ideal: Number(form.estoque_ideal) || 0,
        estoque_minimo: Number(form.estoque_minimo) || 0,
        fornecedor: form.fornecedor || null,
        chapa_largura_cm: num(form.chapa_largura_cm),
        chapa_altura_cm: num(form.chapa_altura_cm),
        observacoes: form.observacoes || null,
      };

      if (criando) {
        const insert: ProdutoInsert = { ...base, tipo };
        return produtosService.create(insert);
      }
      const patch: ProdutoUpdate = { ...base };
      if (isPerfil) {
        patch.perfil = form.perfil || null;
        patch.acabamento = form.acabamento || null;
        patch.altura_cm = num(form.altura_cm);
        patch.largura_cm = num(form.largura_cm);
      }
      return produtosService.update(produto!.id, patch);
    },
    onSuccess: () => {
      toast.success(criando ? "Produto cadastrado" : "Produto atualizado");
      qc.invalidateQueries({ queryKey: ["produtos"] });
      qc.invalidateQueries({ queryKey: ["alertas-essenciais"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(`Erro ao salvar: ${(err as Error).message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{criando ? "Novo produto" : "Editar produto"}</DialogTitle>
          <DialogDescription>
            Categoria: <strong>{PRODUTO_TIPO_LABEL[tipo]}</strong>
            {produto?.codigo && (
              <> · Código <span className="font-mono">{produto.codigo}</span></>
            )}
            {criando && <> · Código gerado automaticamente (4 dígitos).</>}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Nome</Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>

          <div className="col-span-2 space-y-1">
            <Label>Forma de Estoque</Label>
            <Select value={form.forma_estoque} onValueChange={(v) => setForm({ ...form, forma_estoque: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione a forma de estoque" /></SelectTrigger>
              <SelectContent>
                {Object.entries(FORMA_ESTOQUE_LABEL).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Unidade de venda</Label>
            <Select value={form.unidade_venda} onValueChange={(v) => setForm({ ...form, unidade_venda: v, unidade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIDADES_VENDA.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Unidade de estoque</Label>
            <Select value={form.unidade_estoque} onValueChange={(v) => setForm({ ...form, unidade_estoque: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIDADES_ESTOQUE.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Preço de compra</Label>
            <Input type="number" step="0.01" min="0" value={form.preco_custo}
              onChange={(e) => setForm({ ...form, preco_custo: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Preço de venda {isChassi && "(até limite)"}</Label>
            <Input type="number" step="0.01" min="0" value={form.preco_venda}
              onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} />
          </div>

          {isChassi && (
            <>
              <div className="space-y-1">
                <Label>Preço de venda acima do limite (por m²)</Label>
                <Input type="number" step="0.01" value={form.preco_venda_acima_m2}
                  onChange={(e) => setForm({ ...form, preco_venda_acima_m2: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Limite (m²)</Label>
                <Input type="number" step="0.01" value={form.preco_venda_limite_m2}
                  onChange={(e) => setForm({ ...form, preco_venda_limite_m2: e.target.value })} />
              </div>
            </>
          )}

          {isChapa && (
            <>
              <div className="space-y-1">
                <Label>Chapa — largura (cm)</Label>
                <Input type="number" step="0.1" value={form.chapa_largura_cm}
                  onChange={(e) => setForm({ ...form, chapa_largura_cm: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Chapa — altura (cm)</Label>
                <Input type="number" step="0.1" value={form.chapa_altura_cm}
                  onChange={(e) => setForm({ ...form, chapa_altura_cm: e.target.value })} />
              </div>
            </>
          )}

          <div className="space-y-1">
            <Label>Estoque real</Label>
            <Input type="number" step="0.001" value={form.estoque}
              onChange={(e) => setForm({ ...form, estoque: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Estoque ideal</Label>
            <Input type="number" step="0.001" value={form.estoque_ideal}
              onChange={(e) => setForm({ ...form, estoque_ideal: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Estoque mínimo</Label>
            <Input type="number" step="0.001" value={form.estoque_minimo}
              onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Fornecedor</Label>
            <Input value={form.fornecedor} onChange={(e) => setForm({ ...form, fornecedor: e.target.value })} />
          </div>

          <div className="flex items-center gap-3 pt-6 col-span-2">
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            <Label>Ativo</Label>
          </div>

          {isPerfil && !criando && (
            <>
              <div className="space-y-1">
                <Label>Perfil</Label>
                <Input value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Acabamento</Label>
                <Input value={form.acabamento} onChange={(e) => setForm({ ...form, acabamento: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Altura (cm)</Label>
                <Input type="number" step="0.01" value={form.altura_cm}
                  onChange={(e) => setForm({ ...form, altura_cm: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Largura (cm)</Label>
                <Input type="number" step="0.01" value={form.largura_cm}
                  onChange={(e) => setForm({ ...form, largura_cm: e.target.value })} />
              </div>
            </>
          )}

          <div className="col-span-2 space-y-1">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes}
              onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando…" : criando ? "Cadastrar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
