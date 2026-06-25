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
import { produtosService } from "@/lib/services/produtos.service";
import type { Produto, ProdutoUpdate } from "@/types/erp";

interface Props {
  produto: Produto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type FormState = {
  descricao: string;
  ativo: boolean;
  preco_custo: string;
  preco_venda: string;
  estoque: string;
  observacoes: string;
  perfil: string;
  acabamento: string;
  altura_cm: string;
  largura_cm: string;
};

const empty: FormState = {
  descricao: "",
  ativo: true,
  preco_custo: "0",
  preco_venda: "0",
  estoque: "0",
  observacoes: "",
  perfil: "",
  acabamento: "",
  altura_cm: "",
  largura_cm: "",
};

export function ProdutoEditDialog({ produto, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(empty);

  useEffect(() => {
    if (produto) {
      setForm({
        descricao: produto.descricao ?? "",
        ativo: produto.ativo,
        preco_custo: String(produto.preco_custo ?? 0),
        preco_venda: String(produto.preco_venda ?? 0),
        estoque: String(produto.estoque ?? 0),
        observacoes: produto.observacoes ?? "",
        perfil: produto.perfil ?? "",
        acabamento: produto.acabamento ?? "",
        altura_cm: produto.altura_cm != null ? String(produto.altura_cm) : "",
        largura_cm: produto.largura_cm != null ? String(produto.largura_cm) : "",
      });
    }
  }, [produto]);

  const isPerfil = produto?.tipo === "perfil_moldura";

  const mutation = useMutation({
    mutationFn: async () => {
      if (!produto) throw new Error("Produto inválido");
      const patch: ProdutoUpdate = {
        descricao: form.descricao || null,
        ativo: form.ativo,
        preco_custo: Number(form.preco_custo) || 0,
        preco_venda: Number(form.preco_venda) || 0,
        estoque: Number(form.estoque) || 0,
        observacoes: form.observacoes || null,
      };
      if (isPerfil) {
        patch.perfil = form.perfil || null;
        patch.acabamento = form.acabamento || null;
        patch.altura_cm = form.altura_cm === "" ? null : Number(form.altura_cm);
        patch.largura_cm = form.largura_cm === "" ? null : Number(form.largura_cm);
      }
      return produtosService.update(produto.id, patch);
    },
    onSuccess: () => {
      toast.success("Produto atualizado");
      qc.invalidateQueries({ queryKey: ["produtos"] });
      onOpenChange(false);
    },
    onError: (err) => toast.error(`Erro ao salvar: ${(err as Error).message}`),
  });

  if (!produto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar produto</DialogTitle>
          <DialogDescription>
            Código <span className="font-mono">{produto.codigo ?? "—"}</span> · {produto.nome}
            <br />
            <span className="text-xs">O código é a chave única e não pode ser alterado.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Descrição</Label>
            <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </div>

          <div className="space-y-1">
            <Label>Preço de compra</Label>
            <Input type="number" step="0.01" min="0" value={form.preco_custo}
              onChange={(e) => setForm({ ...form, preco_custo: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Preço de venda</Label>
            <Input type="number" step="0.01" min="0" value={form.preco_venda}
              onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Quantidade (estoque)</Label>
            <Input type="number" step="0.001" min="0" value={form.estoque}
              onChange={(e) => setForm({ ...form, estoque: e.target.value })} />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            <Label>Ativo</Label>
          </div>

          {isPerfil && (
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
            {mutation.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
