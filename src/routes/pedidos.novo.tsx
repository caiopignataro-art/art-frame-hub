import * as React from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Search, UserPlus } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { Calculadora } from "@/components/calculadora/Calculadora";
import { ClienteFormDialog } from "@/components/erp/ClienteFormDialog";
import { clientesService } from "@/lib/services/clientes.service";
import { pedidosService } from "@/lib/services/pedidos.service";
import { novoPedidoStore } from "@/lib/services/calculadora.service";
import { formatBRL } from "@/lib/format";
import { FORMA_PAGAMENTO_LABEL, type FormaPagamento, type PedidoItemDraft, type Cliente } from "@/types/erp";

export const Route = createFileRoute("/pedidos/novo")({
  head: () => ({ meta: [{ title: "Novo pedido — Molduraria ERP" }] }),
  component: NovoPedidoPage,
});

const FORMAS: FormaPagamento[] = [
  "pix", "dinheiro", "cartao_credito", "cartao_debito", "transferencia", "outro",
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function NovoPedidoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [itens, setItens] = React.useState<PedidoItemDraft[]>([]);
  const [calcOpen, setCalcOpen] = React.useState(false);
  const [cadCliOpen, setCadCliOpen] = React.useState(false);

  // Carrega itens iniciais vindos da calculadora (sessionStorage)
  React.useEffect(() => {
    console.log("[NovoPedido] rota acessada");
    try {
      const inicial = novoPedidoStore.read();
      console.log("[NovoPedido] itens recuperados do sessionStorage:", inicial);
      if (inicial.length > 0) {
        setItens(inicial);
        novoPedidoStore.clear();
      }
    } catch (err) {
      console.error("[NovoPedido] erro lendo sessionStorage", err);
    }
  }, []);

  // Cliente
  const [clienteId, setClienteId] = React.useState<string | null>(null);
  const [busca, setBusca] = React.useState("");
  const clientesQ = useQuery({
    queryKey: ["clientes", "busca", busca],
    queryFn: () => clientesService.search(busca),
  });
  const clienteSelecionado = (clientesQ.data ?? []).find((c) => c.id === clienteId) ?? null;

  // Pagamento e datas
  const [formaPagamento, setFormaPagamento] = React.useState<FormaPagamento>("pix");
  const [dataPedido, setDataPedido] = React.useState<string>(todayIso());
  const [dataEntrega, setDataEntrega] = React.useState<string>("");
  const [observacoes, setObservacoes] = React.useState("");

  const subtotal = itens.reduce((s, i) => s + Number(i.valor_total), 0);

  const removeItem = (idx: number) => setItens((arr) => arr.filter((_, i) => i !== idx));

  const handleAddItem = (item: PedidoItemDraft) => {
    setItens((arr) => [...arr, item]);
    setCalcOpen(false);
  };

  const handleSavedCliente = (c: Cliente) => {
    setClienteId(c.id);
    qc.invalidateQueries({ queryKey: ["clientes"] });
  };

  const canSalvar = itens.length > 0 && !!dataEntrega;

  const [saving, setSaving] = React.useState(false);
  const handleSalvar = async (statusFinal: "orcamento" | "aguardando_aprovacao" = "orcamento") => {
    if (!canSalvar) {
      toast.error("Adicione pelo menos um item e informe a data prevista de entrega.");
      return;
    }
    setSaving(true);
    try {
      const pedido = await pedidosService.criarPedidoCompleto({
        cliente_id: clienteId,
        itens,
        forma_pagamento: formaPagamento,
        data_pedido: new Date(dataPedido).toISOString(),
        data_entrega_prevista: dataEntrega,
        observacoes: observacoes || null,
        status: statusFinal,
      });
      toast.success(`Pedido #${pedido.numero_pedido} criado`);
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      navigate({ to: "/pedidos" });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar pedido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell title="Novo pedido">
      <PageHeader
        title="Novo pedido"
        description="Defina o cliente, itens, pagamento e prazo. Os itens vêm da calculadora."
        actions={
          <Button asChild variant="outline">
            <Link to="/pedidos"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Cliente */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="existente">
              <TabsList>
                <TabsTrigger value="existente"><Search className="mr-1 h-4 w-4" /> Existente</TabsTrigger>
                <TabsTrigger value="novo"><UserPlus className="mr-1 h-4 w-4" /> Cadastro rápido</TabsTrigger>
              </TabsList>
              <TabsContent value="existente" className="space-y-2 pt-3">
                <Input
                  placeholder="Buscar por nome, telefone, CPF…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                  {(clientesQ.data ?? []).length === 0 && (
                    <p className="p-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                  )}
                  {(clientesQ.data ?? []).map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 p-3 text-sm cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="radio"
                        name="cliente"
                        value={c.id}
                        checked={clienteId === c.id}
                        onChange={() => setClienteId(c.id)}
                      />
                      <span className="flex-1">
                        <span className="font-medium">{c.nome}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {c.whatsapp ?? c.telefone ?? "—"}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {clienteSelecionado && (
                  <p className="text-xs text-muted-foreground">
                    Selecionado: <strong>{clienteSelecionado.nome}</strong>
                  </p>
                )}
              </TabsContent>
              <TabsContent value="novo" className="pt-3">
                <p className="text-sm text-muted-foreground mb-2">
                  Cadastre um cliente novo. Ele será vinculado ao pedido automaticamente.
                </p>
                <Button onClick={() => setCadCliOpen(true)} variant="outline">
                  <UserPlus className="mr-2 h-4 w-4" /> Cadastrar cliente
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Resumo */}
        <Card>
          <CardHeader><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Itens" value={String(itens.length)} />
            <Row label="Subtotal" value={formatBRL(subtotal)} />
            <Row label="Descontos" value={formatBRL(0)} muted />
            <div className="border-t pt-2">
              <Row label="Total geral" value={formatBRL(subtotal)} strong />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Itens */}
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Itens do pedido</CardTitle>
          <Button onClick={() => setCalcOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar item (calculadora)
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Medidas</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    Nenhum item. Clique em "Adicionar item" para abrir a calculadora.
                  </TableCell>
                </TableRow>
              )}
              {itens.map((i, idx) => (
                <TableRow key={idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell className="max-w-md">{i.descricao}</TableCell>
                  <TableCell>{i.largura_cm}×{i.altura_cm} cm</TableCell>
                  <TableCell className="text-right">{i.quantidade}</TableCell>
                  <TableCell className="text-right">{formatBRL(i.valor_unitario)}</TableCell>
                  <TableCell className="text-right">{formatBRL(i.valor_total)}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} aria-label="Remover">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagamento / datas */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Forma de pagamento</CardTitle></CardHeader>
          <CardContent>
            <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as FormaPagamento)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMAS.map((f) => (
                  <SelectItem key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Data do pedido</CardTitle></CardHeader>
          <CardContent>
            <Input type="date" value={dataPedido} onChange={(e) => setDataPedido(e.target.value)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Entrega prevista *</CardTitle></CardHeader>
          <CardContent>
            <Input type="date" value={dataEntrega} onChange={(e) => setDataEntrega(e.target.value)} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Observações</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Notas internas, condições de entrega…"
          />
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => navigate({ to: "/pedidos" })} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="outline" onClick={() => handleSalvar("orcamento")} disabled={!canSalvar || saving}>
          <Save className="mr-2 h-4 w-4" /> Salvar como orçamento
        </Button>
        <Button onClick={() => handleSalvar("aguardando_aprovacao")} disabled={!canSalvar || saving}>
          Salvar e enviar para aprovação
        </Button>
      </div>

      {/* Dialog Calculadora */}
      <Dialog open={calcOpen} onOpenChange={setCalcOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar item ao pedido</DialogTitle>
          </DialogHeader>
          <Calculadora
            onAdd={handleAddItem}
            cancelLabel="Fechar"
            onCancel={() => setCalcOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ClienteFormDialog open={cadCliOpen} onOpenChange={setCadCliOpen} onSaved={handleSavedCliente} />
    </AppShell>
  );
}

function Label_({ children }: { children: React.ReactNode }) {
  return <Label className="text-xs font-medium text-muted-foreground">{children}</Label>;
}
void Label_;

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
