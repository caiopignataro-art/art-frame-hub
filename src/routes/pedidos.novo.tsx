import * as React from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Search, UserPlus, X, Check, Copy, Pencil } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";

import { Calculadora } from "@/components/calculadora/Calculadora";
import { ClienteFormDialog } from "@/components/erp/ClienteFormDialog";
import { clientesService } from "@/lib/services/clientes.service";
import { pedidosService } from "@/lib/services/pedidos.service";
import { configuracoesService } from "@/lib/services/configuracoes.service";
import { novoPedidoStore } from "@/lib/services/calculadora.service";
import { formatBRL } from "@/lib/format";
import type { PedidoItemDraft, Cliente } from "@/types/erp";
import {
  MODALIDADES,
  MODALIDADE_LABEL,
  MODALIDADES_COM_DESCONTO,
  modalidadeToFormaPagamento,
  calcularSnapshot,
  CONFIG_KEY_MAX_PARCELAS,
  DEFAULT_MAX_PARCELAS,
  type ModalidadePagamento,
} from "@/lib/pagamento/modalidade";

export const Route = createFileRoute("/pedidos/novo")({
  head: () => ({ meta: [{ title: "Novo pedido — Molduraria ERP" }] }),
  component: NovoPedidoPage,
});

const DESCONTOS_PCT = [0, 5, 10, 15, 20];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function NovoPedidoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Itens (vindos da calculadora via sessionStorage)
  const [itens, setItens] = React.useState<PedidoItemDraft[]>([]);
  const [calcOpen, setCalcOpen] = React.useState(false);
  const [cadCliOpen, setCadCliOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    try {
      const inicial = novoPedidoStore.read();
      if (inicial.length > 0) {
        setItens(inicial);
        novoPedidoStore.clear();
      }
    } catch (err) {
      console.error("[NovoPedido] erro lendo sessionStorage", err);
    }
  }, []);

  // ---------- Cliente (autocomplete único) ----------
  const [cliente, setCliente] = React.useState<Cliente | null>(null);
  const [busca, setBusca] = React.useState("");
  const [openClienteBox, setOpenClienteBox] = React.useState(false);
  const clientesQ = useQuery({
    queryKey: ["clientes", "busca", busca],
    queryFn: () => clientesService.search(busca),
    enabled: openClienteBox,
  });

  const handleSavedCliente = (c: Cliente) => {
    setCliente(c);
    qc.invalidateQueries({ queryKey: ["clientes"] });
  };

  // ---------- Pagamento ----------
  const [modalidade, setModalidade] = React.useState<ModalidadePagamento>("pix");
  const [parcelas, setParcelas] = React.useState<number>(1);
  const [descontoPct, setDescontoPct] = React.useState<number>(0);
  const [situacao, setSituacao] = React.useState<"pago" | "sinal" | "aberto">("aberto");
  const [valorSinal, setValorSinal] = React.useState<number>(0);

  // Config: max parcelas
  const maxParcelasQ = useQuery({
    queryKey: ["config", CONFIG_KEY_MAX_PARCELAS],
    queryFn: () => configuracoesService.getNumber(CONFIG_KEY_MAX_PARCELAS, DEFAULT_MAX_PARCELAS),
  });
  const maxParcelas = Math.max(1, Math.min(12, maxParcelasQ.data ?? DEFAULT_MAX_PARCELAS));

  // Datas / observações
  const [dataPedido, setDataPedido] = React.useState<string>(todayIso());
  const [dataEntrega, setDataEntrega] = React.useState<string>("");
  const [observacoes, setObservacoes] = React.useState("");

  // ---------- Cálculo em tempo real ----------
  const subtotal = React.useMemo(
    () => itens.reduce((s, i) => s + Number(i.valor_total), 0),
    [itens],
  );
  const aceitaDesconto = MODALIDADES_COM_DESCONTO.includes(modalidade);

  // Limpa desconto se modalidade muda para crédito
  React.useEffect(() => {
    if (!aceitaDesconto && descontoPct !== 0) setDescontoPct(0);
    if (modalidade !== "credito_parcelado" && parcelas !== 1) setParcelas(1);
  }, [modalidade]); // eslint-disable-line

  const snapshot = React.useMemo(
    () =>
      calcularSnapshot({
        modalidade,
        parcelas,
        subtotal,
        descontoPct,
        situacao,
        valorSinal,
      }),
    [modalidade, parcelas, subtotal, descontoPct, situacao, valorSinal],
  );

  // ---------- Itens ----------
  const removeItem = (idx: number) => setItens((arr) => arr.filter((_, i) => i !== idx));
  const cloneItem = (idx: number) =>
    setItens((arr) => {
      const clone: PedidoItemDraft = JSON.parse(JSON.stringify(arr[idx]));
      return [...arr.slice(0, idx + 1), clone, ...arr.slice(idx + 1)];
    });
  const startEditItem = (idx: number) => {
    setEditingIndex(idx);
    setCalcOpen(true);
  };
  const handleAddItem = (item: PedidoItemDraft) => {
    if (editingIndex != null) {
      const idx = editingIndex;
      setItens((arr) => arr.map((it, i) => (i === idx ? item : it)));
      setEditingIndex(null);
    } else {
      setItens((arr) => [...arr, item]);
    }
    setCalcOpen(false);
  };
  const handleDialogChange = (open: boolean) => {
    setCalcOpen(open);
    if (!open) setEditingIndex(null);
  };

  // ---------- Save ----------
  const canSalvar = itens.length > 0 && !!dataEntrega;
  const [saving, setSaving] = React.useState(false);

  const handleToggleSinal = (checked: boolean) => {
    if (checked) {
      setSituacao("sinal");
    } else if (situacao === "sinal") {
      setSituacao("aberto");
      setValorSinal(0);
    }
  };
  const handleTogglePago = (checked: boolean) => {
    if (checked) {
      setSituacao("pago");
      setValorSinal(0);
    } else if (situacao === "pago") {
      setSituacao("aberto");
    }
  };

  const handleSalvar = async (statusFinal: "orcamento" | "aguardando_aprovacao" = "orcamento") => {
    if (!canSalvar) {
      toast.error("Adicione pelo menos um item e informe a data prevista de entrega.");
      return;
    }
    if (situacao === "sinal" && (snapshot.valor_sinal <= 0 || snapshot.valor_sinal > snapshot.total_final)) {
      toast.error("Valor do sinal deve ser maior que 0 e menor ou igual ao total.");
      return;
    }
    setSaving(true);
    try {
      const pedido = await pedidosService.criarPedidoCompleto({
        cliente_id: cliente?.id ?? null,
        itens,
        forma_pagamento: modalidadeToFormaPagamento(modalidade),
        data_pedido: new Date(dataPedido).toISOString(),
        data_entrega_prevista: dataEntrega,
        observacoes: observacoes || null,
        status: statusFinal,
        pagamento: snapshot,
      });
      toast.success(`Pedido #${pedido.numero_pedido} criado`);
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
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

      <div>
        {/* Cliente */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Cliente</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setCadCliOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Cadastro rápido
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Cliente existente</Label>
              <Popover open={openClienteBox} onOpenChange={setOpenClienteBox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal mt-1"
                  >
                    {cliente ? (
                      <span className="truncate">{cliente.nome}</span>
                    ) : (
                      <span className="text-muted-foreground">
                        <Search className="inline h-3.5 w-3.5 mr-2" />
                        Buscar por nome, WhatsApp ou CPF…
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Digite nome, WhatsApp ou CPF…"
                      value={busca}
                      onValueChange={setBusca}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {clientesQ.isFetching ? "Buscando…" : "Nenhum cliente encontrado."}
                      </CommandEmpty>
                      <CommandGroup>
                        {(clientesQ.data ?? []).map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.id}
                            onSelect={() => {
                              setCliente(c);
                              setOpenClienteBox(false);
                            }}
                          >
                            <Check className={`mr-2 h-4 w-4 ${cliente?.id === c.id ? "opacity-100" : "opacity-0"}`} />
                            <div className="flex-1">
                              <div className="font-medium">{c.nome}</div>
                              <div className="text-xs text-muted-foreground">
                                {[c.whatsapp ?? c.telefone, c.cpf_cnpj].filter(Boolean).join(" · ") || "—"}
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {cliente && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-medium">{cliente.nome}</div>
                    <div className="text-xs text-muted-foreground">
                      WhatsApp: {cliente.whatsapp ?? "—"} · Tel: {cliente.telefone ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      CPF/CNPJ: {cliente.cpf_cnpj ?? "—"} · E-mail: {cliente.email ?? "—"}
                    </div>
                    {cliente.endereco && (
                      <div className="text-xs text-muted-foreground">Endereço: {cliente.endereco}</div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setCliente(null)}
                    aria-label="Remover cliente"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
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
                <TableHead>Códigos</TableHead>
                <TableHead>Medidas</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-[132px]"></TableHead>
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
              {itens.map((i, idx) => {
                const imgs = ((i.metadados as any)?.entrada?.imagens ?? []) as string[];
                const grupos = codigosPorCategoria(i);
                return (
                  <TableRow key={idx}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="max-w-md">
                      <div className="flex items-start gap-2">
                        {imgs.length > 0 && (
                          <div className="flex -space-x-1 shrink-0">
                            {imgs.slice(0, 3).map((src, ii) => (
                              <img key={ii} src={src} alt="" className="h-8 w-8 rounded border-2 border-background object-cover" />
                            ))}
                            {imgs.length > 3 && (
                              <span className="grid h-8 w-8 place-items-center rounded border-2 border-background bg-muted text-[10px] font-medium">
                                +{imgs.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="space-y-0.5 text-xs">
                          {grupos.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            grupos.map((g) => (
                              <div key={g.label}>
                                <span className="text-muted-foreground">{g.label}:</span>{" "}
                                <span className="font-mono">{g.codigos}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{i.largura_cm}×{i.altura_cm} cm</TableCell>
                    <TableCell className="text-right">{i.quantidade}</TableCell>
                    <TableCell className="text-right">{formatBRL(i.valor_unitario)}</TableCell>
                    <TableCell className="text-right">{formatBRL(i.valor_total)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" onClick={() => startEditItem(idx)} aria-label="Editar" title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => cloneItem(idx)} aria-label="Clonar" title="Clonar">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} aria-label="Remover" title="Remover">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resumo financeiro (logo abaixo dos itens) */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Resumo financeiro</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Itens" value={String(itens.length)} />
          <Row label="Subtotal" value={formatBRL(snapshot.subtotal)} />
          {snapshot.desconto_valor > 0 && (
            <Row
              label={`Desconto (${snapshot.desconto_percentual}%)`}
              value={`- ${formatBRL(snapshot.desconto_valor)}`}
              muted
            />
          )}
          <div className="border-t pt-2">
            <Row label="Total final" value={formatBRL(snapshot.total_final)} strong />
          </div>
          {snapshot.valor_sinal > 0 && (
            <Row label="Sinal" value={`- ${formatBRL(snapshot.valor_sinal)}`} muted />
          )}
          <Row label="Saldo devedor" value={formatBRL(snapshot.saldo_devedor)} strong />
          <div className="pt-1 text-xs text-muted-foreground">
            Situação:{" "}
            <strong>
              {snapshot.situacao === "pago"
                ? "Pago"
                : snapshot.situacao === "sinal"
                ? "Pagamento Parcial"
                : "Em Aberto"}
            </strong>
            {modalidade === "credito_parcelado" && ` · ${snapshot.parcelas}x`}
          </div>
        </CardContent>
      </Card>


      {/* Pagamento */}
      <Card className="mt-4">
        <CardHeader><CardTitle className="text-base">Forma de pagamento</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <Label className="text-xs text-muted-foreground">Forma de pagamento</Label>
            <Select value={modalidade} onValueChange={(v) => setModalidade(v as ModalidadePagamento)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODALIDADES.map((m) => (
                  <SelectItem key={m} value={m}>{MODALIDADE_LABEL[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {modalidade === "credito_parcelado" && (
            <div>
              <Label className="text-xs text-muted-foreground">Parcelamento</Label>
              <Select value={String(parcelas)} onValueChange={(v) => setParcelas(Number(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxParcelas }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {aceitaDesconto && (
            <div>
              <Label className="text-xs text-muted-foreground">Desconto</Label>
              <Select value={String(descontoPct)} onValueChange={(v) => setDescontoPct(Number(v))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DESCONTOS_PCT.map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {p === 0 ? "Sem desconto" : `${p}%`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="md:col-span-3 flex flex-wrap items-center gap-6 border-t pt-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={situacao === "sinal"}
                onCheckedChange={(c) => handleToggleSinal(!!c)}
              />
              Sinal
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={situacao === "pago"}
                onCheckedChange={(c) => handleTogglePago(!!c)}
              />
              Pago
            </label>

            {situacao === "sinal" && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Valor do sinal (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={snapshot.total_final}
                  value={valorSinal || ""}
                  onChange={(e) => setValorSinal(Number(e.target.value) || 0)}
                  className="w-36"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Datas */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
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

function Row({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
