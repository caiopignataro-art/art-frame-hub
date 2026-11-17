import * as React from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  CreditCard,
  Pencil,
  Plus,
  Receipt,
  Save,
  Search,
  ShoppingBag,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/erp/PageHeader";
import { PedidoStatusBadge } from "@/components/erp/StatusBadge";
import { EmptyState } from "@/components/erp/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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

import { Calculadora } from "@/components/calculadora/Calculadora";
import { ClienteFormDialog } from "@/components/erp/ClienteFormDialog";
import { clientesService } from "@/lib/services/clientes.service";
import { pedidosService } from "@/lib/services/pedidos.service";
import { configuracoesService } from "@/lib/services/configuracoes.service";
import { ordemProducaoService } from "@/lib/services/ordem-producao.service";
import { novoPedidoStore } from "@/lib/services/calculadora.service";
import { productionKeys, productionCache } from "@/lib/services/production-cache";
import { formatBRL } from "@/lib/format";
import { calcularMedidaAbertura } from "@/lib/calculadora/calculator";
import type { PedidoItemDraft, Cliente, PedidoStatus } from "@/types/erp";
import {
  MODALIDADES,
  MODALIDADE_LABEL,
  MODALIDADES_COM_DESCONTO,
  modalidadeToFormaPagamento,
  inferModalidade,
  calcularSnapshot,
  CONFIG_KEY_MAX_PARCELAS,
  DEFAULT_MAX_PARCELAS,
  type ModalidadePagamento,
  type PagamentoSnapshot,
} from "@/lib/pagamento/modalidade";

export const Route = createFileRoute("/pedidos/novo")({
  head: () => ({ meta: [{ title: "Novo pedido — Art Frame Hub" }] }),
  validateSearch: (s: Record<string, unknown>): { id?: string } => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: NovoPedidoPage,
});

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function obterDataEntregaPadrao(): string {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  if (d.getDay() === 0) {
    d.setDate(d.getDate() - 1);
  }
  return d.toISOString().slice(0, 10);
}

interface ItemMetadados {
  calculo?: {
    largura_abertura_cm?: number;
    altura_abertura_cm?: number;
  };
  entrada?: {
    largura_arte_cm?: number;
    altura_arte_cm?: number;
    passe_partouts?: Array<{ medida_cm?: number }>;
  };
}

function obterMedidasPrecificacao(item: PedidoItemDraft): { largura: number; altura: number } {
  const md = item.metadados as ItemMetadados | null | undefined;
  const calculo = md?.calculo;
  if (calculo) {
    return {
      largura: Number(calculo.largura_abertura_cm),
      altura: Number(calculo.altura_abertura_cm),
    };
  }
  const entrada = md?.entrada;
  if (entrada) {
    const la = Number(entrada.largura_arte_cm) || 0;
    const aa = Number(entrada.altura_arte_cm) || 0;
    const somaPp = (entrada.passe_partouts ?? []).reduce(
      (s: number, pp) => s + (Number(pp.medida_cm) || 0),
      0,
    );
    const abertura = calcularMedidaAbertura(la, aa, somaPp);
    return { largura: abertura.largura, altura: abertura.altura };
  }
  return {
    largura: item.largura_cm,
    altura: item.altura_cm,
  };
}

function NovoPedidoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { id: editId } = Route.useSearch();
  const isEdit = !!editId;

  const [itens, setItens] = React.useState<PedidoItemDraft[]>([]);
  const [calcOpen, setCalcOpen] = React.useState(false);
  const [cadCliOpen, setCadCliOpen] = React.useState(false);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [approving, setApproving] = React.useState(false);

  React.useEffect(() => {
    if (isEdit) return;
    try {
      const inicial = novoPedidoStore.read();
      if (inicial.length > 0) {
        setItens(inicial);
        novoPedidoStore.clear();
      }
    } catch (err) {
      console.error("[NovoPedido] erro lendo sessionStorage", err);
    }
  }, [isEdit]);

  // ---------- Cliente ----------
  const [cliente, setCliente] = React.useState<Cliente | null>(null);
  const [clienteError, setClienteError] = React.useState(false);
  const [busca, setBusca] = React.useState("");
  const [openClienteBox, setOpenClienteBox] = React.useState(false);
  const clientesQ = useQuery({
    queryKey: ["clientes", "busca", busca],
    queryFn: () => clientesService.search(busca),
    enabled: openClienteBox,
  });

  const handleSavedCliente = (c: Cliente) => {
    setCliente(c);
    setClienteError(false);
    qc.invalidateQueries({ queryKey: ["clientes"] });
  };

  // ---------- Pagamento ----------
  const [modalidade, setModalidade] = React.useState<ModalidadePagamento>("pix");
  const [parcelas, setParcelas] = React.useState<number>(1);
  const [descontoPct, setDescontoPct] = React.useState<number>(0);
  const [situacao, setSituacao] = React.useState<"pago" | "sinal" | "aberto">("aberto");
  const [valorSinal, setValorSinal] = React.useState<number>(0);

  const maxParcelasQ = useQuery({
    queryKey: ["config", CONFIG_KEY_MAX_PARCELAS],
    queryFn: () => configuracoesService.getNumber(CONFIG_KEY_MAX_PARCELAS, DEFAULT_MAX_PARCELAS),
  });
  const maxParcelas = Math.max(1, Math.min(12, maxParcelasQ.data ?? DEFAULT_MAX_PARCELAS));

  // Datas / observações
  const [dataPedido, setDataPedido] = React.useState<string>(todayIso());
  const [dataEntrega, setDataEntrega] = React.useState<string>(() =>
    isEdit ? "" : obterDataEntregaPadrao(),
  );
  const [observacoes, setObservacoes] = React.useState("");
  const [pedidoStatus, setPedidoStatus] = React.useState<PedidoStatus | null>(null);
  const [numeroPedido, setNumeroPedido] = React.useState<number | null>(null);

  // ---------- Carrega pedido em edição ----------
  const pedidoEditQ = useQuery({
    queryKey: ["pedido", editId, "edit"],
    queryFn: () => pedidosService.get(editId!),
    enabled: isEdit,
  });

  const opQuery = useQuery({
    queryKey: ["ordem_producao", pedidoEditQ.data?.ordem_producao_id],
    queryFn: () => ordemProducaoService.get(pedidoEditQ.data!.ordem_producao_id!),
    enabled: isEdit && !!pedidoEditQ.data?.ordem_producao_id,
  });

  const [showOpConfirmDialog, setShowOpConfirmDialog] = React.useState(false);
  const [showArchiveOpConfirmDialog, setShowArchiveOpConfirmDialog] = React.useState(false);

  React.useEffect(() => {
    const p = pedidoEditQ.data;
    if (!p) return;
    setCliente(p.cliente ?? null);
    if (p.cliente) setClienteError(false);
    setPedidoStatus(p.status);
    setNumeroPedido(p.numero_pedido);
    setDataPedido((p.data_pedido ?? new Date().toISOString()).slice(0, 10));
    setDataEntrega((p.data_entrega_prevista ?? "").slice(0, 10));
    setObservacoes(p.observacoes ?? "");
    const snap = ((p.metadados as { pagamento?: PagamentoSnapshot } | null)?.pagamento ??
      null) as PagamentoSnapshot | null;
    const mod = snap?.modalidade ? snap.modalidade : inferModalidade(p.forma_pagamento, snap);
    setModalidade(mod);
    setParcelas(snap?.parcelas ?? 1);
    setDescontoPct(snap?.desconto_percentual ?? 0);
    setSituacao(snap?.situacao ?? "aberto");
    setValorSinal(Number(snap?.valor_sinal ?? 0));
    const itensDraft: PedidoItemDraft[] = (p.itens ?? []).map((i) => ({
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      largura_cm: Number(i.largura_cm),
      altura_cm: Number(i.altura_cm),
      valor_unitario: Number(i.valor_unitario),
      valor_total: Number(i.valor_total),
      metadados: (i.metadados ?? {}) as Record<string, unknown>,
    }));
    setItens(itensDraft);
  }, [pedidoEditQ.data]);

  // ---------- Cálculo em tempo real ----------
  const subtotal = React.useMemo(
    () => itens.reduce((s, i) => s + Number(i.valor_total), 0),
    [itens],
  );
  const aceitaDesconto = MODALIDADES_COM_DESCONTO.includes(modalidade);

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

  // ---------- Itens (Permissões por Status) ----------
  const podeEditarItens = !isEdit || pedidoStatus === "orcamento" || pedidoStatus === "aprovado";

  const removeItem = (idx: number) => {
    if (!podeEditarItens) {
      toast.error("Edição de itens bloqueada para pedidos com este status.");
      return;
    }
    setItens((arr) => arr.filter((_, i) => i !== idx));
  };
  const cloneItem = (idx: number) => {
    if (!podeEditarItens) {
      toast.error("Edição de itens bloqueada para pedidos com este status.");
      return;
    }
    setItens((arr) => {
      const clone: PedidoItemDraft = JSON.parse(JSON.stringify(arr[idx]));
      return [...arr.slice(0, idx + 1), clone, ...arr.slice(idx + 1)];
    });
  };
  const startEditItem = (idx: number) => {
    if (!podeEditarItens) {
      toast.error("Edição de itens bloqueada para pedidos com este status.");
      return;
    }
    setEditingIndex(idx);
    setCalcOpen(true);
  };
  const handleAddItem = (item: PedidoItemDraft) => {
    if (!podeEditarItens) {
      toast.error("Edição de itens bloqueada para pedidos com este status.");
      return;
    }
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

  const [archiveOpId, setArchiveOpId] = React.useState<string | null>(null);

  const checkFabricationChanges = () => {
    if (!isEdit || !pedidoEditQ.data) return false;
    const p = pedidoEditQ.data;
    const originalItens: PedidoItemDraft[] = (p.itens ?? []).map((i) => ({
      descricao: i.descricao,
      quantidade: Number(i.quantidade),
      largura_cm: Number(i.largura_cm),
      altura_cm: Number(i.altura_cm),
      valor_unitario: Number(i.valor_unitario),
      valor_total: Number(i.valor_total),
      metadados: (i.metadados ?? {}) as Record<string, unknown>,
    }));

    if (originalItens.length !== itens.length) return true;
    for (let i = 0; i < originalItens.length; i++) {
      const o = originalItens[i]!;
      const a = itens[i]!;
      if (o.quantidade !== a.quantidade) return true;
      if (o.largura_cm !== a.largura_cm) return true;
      if (o.altura_cm !== a.altura_cm) return true;
      if (o.descricao !== a.descricao) return true;
      if (JSON.stringify(o.metadados) !== JSON.stringify(a.metadados)) return true;
    }
    return false;
  };

  const executarSalvar = async (finalStatus: PedidoStatus, bypassOpCheck = false) => {
    if (!cliente) {
      setClienteError(true);
      toast.error("Selecione um cliente para salvar o pedido.");
      return;
    }

    const formaPagamento = modalidadeToFormaPagamento(modalidade);

    if (
      isEdit &&
      editId &&
      pedidoEditQ.data?.ordem_producao_id &&
      opQuery.data?.op.status === "aberta" &&
      !bypassOpCheck
    ) {
      const hasFabricationChanges = checkFabricationChanges();
      if (hasFabricationChanges) {
        setShowOpConfirmDialog(true);
        return;
      }
    }

    if (finalStatus === "aprovado" && isEdit) {
      setApproving(true);
    }
    setSaving(true);
    try {
      if (isEdit && editId) {
        await pedidosService.atualizarPedidoCompleto(editId, {
          cliente_id: cliente?.id ?? null,
          itens,
          forma_pagamento: formaPagamento,
          data_pedido: new Date(dataPedido).toISOString(),
          data_entrega_prevista: dataEntrega,
          observacoes: observacoes || null,
          status: finalStatus,
          pagamento: snapshot,
        });
        if (finalStatus === "aprovado" && pedidoEditQ.data?.status === "orcamento") {
          toast.success("Pedido salvo e aprovado com sucesso");
        } else {
          toast.success(`Pedido #${numeroPedido ?? ""} atualizado`);
        }
      } else {
        const pedido = await pedidosService.criarPedidoCompleto({
          cliente_id: cliente?.id ?? null,
          itens,
          forma_pagamento: formaPagamento,
          data_pedido: new Date(dataPedido).toISOString(),
          data_entrega_prevista: dataEntrega,
          observacoes: observacoes || null,
          status: finalStatus,
          pagamento: snapshot,
        });
        toast.success(`Pedido #${pedido.numero_pedido} criado`);
      }
      productionCache.invalidateAfterPedidoStatusChanged(qc);
      qc.invalidateQueries({ queryKey: ["pagamentos"] });
      if (isEdit && editId) {
        qc.invalidateQueries({ queryKey: ["pedido", editId] });
        qc.invalidateQueries({ queryKey: productionKeys.ordens });
        qc.invalidateQueries({ queryKey: ["ordem_producao"] });
      }
      void navigate({ to: "/pedidos" });
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Falha ao salvar pedido");
    } finally {
      setSaving(false);
      setApproving(false);
    }
  };

  const confirmarRollbackOP = async () => {
    setShowOpConfirmDialog(false);
    setSaving(true);
    try {
      const result = await ordemProducaoService.removerPedido({
        pedidoId: editId!,
        motivo: "Alteração produtiva no pedido",
      });

      if (result.op_ficou_vazia) {
        setArchiveOpId(result.ordem_producao_id);
        setShowArchiveOpConfirmDialog(true);
      } else {
        await executarSalvar("aprovado", true);
      }
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Falha ao desvincular pedido da OP");
      setSaving(false);
    }
  };

  const confirmarArquivamentoOP = async () => {
    setShowArchiveOpConfirmDialog(false);
    setSaving(true);
    try {
      if (archiveOpId) {
        await ordemProducaoService.arquivar(archiveOpId);
      }
      await executarSalvar("aprovado", true);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Falha ao arquivar OP");
    } finally {
      setSaving(false);
      setArchiveOpId(null);
    }
  };

  const recusarArquivamentoOP = async () => {
    setShowArchiveOpConfirmDialog(false);
    await executarSalvar("aprovado", true);
    setArchiveOpId(null);
  };

  const handleSalvar = async (statusFinal: PedidoStatus = "orcamento") => {
    if (!cliente) {
      setClienteError(true);
      toast.error("Selecione um cliente para salvar o pedido.");
      return;
    }
    if (!canSalvar) {
      toast.error("Adicione pelo menos um item e informe a data prevista de entrega.");
      return;
    }
    if (dataEntrega) {
      const hoje = todayIso();
      if (dataEntrega < hoje) {
        toast.error("A entrega prevista não pode ser anterior à data atual.");
        return;
      }
      const dataEntregaObj = new Date(dataEntrega + "T12:00:00");
      if (dataEntregaObj.getDay() === 0) {
        toast.error("Entregas não podem ser agendadas para domingos.");
        return;
      }
    }
    const formaPagamento = modalidadeToFormaPagamento(modalidade);
    const requerPagamento =
      statusFinal === "aprovado" ||
      statusFinal === "em_producao" ||
      statusFinal === "pronto" ||
      statusFinal === "entregue";
    if (requerPagamento) {
      if (!formaPagamento) {
        toast.error("Este status exige forma de pagamento selecionada.");
        return;
      }
      const temSinal = situacao === "sinal" && snapshot.valor_sinal > 0;
      const temPago = situacao === "pago";
      if (!temSinal && !temPago) {
        toast.error("Este status exige informar o Sinal (maior que zero) ou marcar como Pago.");
        return;
      }
    }
    if (
      statusFinal === "orcamento" &&
      (situacao === "pago" || (situacao === "sinal" && snapshot.valor_sinal > 0))
    ) {
      toast.error(
        "Pedidos em Orçamento não podem possuir pagamento registrado. Remova o sinal/pagamento ou utilize 'Salvar e enviar para aprovação'.",
      );
      return;
    }
    if (
      situacao === "sinal" &&
      (snapshot.valor_sinal <= 0 || snapshot.valor_sinal > snapshot.total_final)
    ) {
      toast.error("Valor do sinal deve ser maior que 0 e menor ou igual ao total.");
      return;
    }

    await executarSalvar(statusFinal);
  };

  const pageTitle = isEdit
    ? `Editar Pedido${numeroPedido ? ` #${numeroPedido}` : ""}`
    : "Novo Pedido";

  return (
    <div className="space-y-5">
      <PageHeader
        title={pageTitle}
        description={
          isEdit
            ? "Ajuste os dados comerciais, itens ou condições de pagamento. As alterações são registradas no histórico."
            : "Vincule o cliente, monte os itens pela calculadora integrada e defina pagamento e prazo de entrega."
        }
        badge={isEdit && pedidoStatus ? <PedidoStatusBadge status={pedidoStatus} /> : undefined}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/pedidos">
              <ArrowLeft className="h-4 w-4" />
              Voltar para pedidos
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* COLUNA PRINCIPAL: CLIENTE, ITENS, OBSERVAÇÕES */}
        <div className="space-y-5 min-w-0">
          {/* Cliente */}
          <Card
            className={
              clienteError && !cliente ? "border-destructive ring-1 ring-destructive/40" : ""
            }
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <span>Cliente</span>
                <span className="text-[11px] font-medium text-destructive">* obrigatório</span>
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setCadCliOpen(true)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Cadastro rápido
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label
                  className={`text-xs ${
                    clienteError && !cliente
                      ? "font-medium text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  Selecionar cliente cadastrado
                </Label>
                <Popover open={openClienteBox} onOpenChange={setOpenClienteBox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={`mt-1 w-full justify-between font-normal ${
                        clienteError && !cliente ? "border-destructive text-destructive" : ""
                      }`}
                    >
                      {cliente ? (
                        <span className="truncate font-medium text-foreground">{cliente.nome}</span>
                      ) : (
                        <span
                          className={
                            clienteError && !cliente ? "text-destructive" : "text-muted-foreground"
                          }
                        >
                          <Search className="mr-2 inline h-3.5 w-3.5" />
                          Buscar por nome, WhatsApp ou CPF/CNPJ…
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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
                                setClienteError(false);
                                setOpenClienteBox(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  cliente?.id === c.id ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              <div className="flex-1">
                                <div className="font-medium">{c.nome}</div>
                                <div className="text-xs text-muted-foreground">
                                  {[c.whatsapp ?? c.telefone, c.cpf_cnpj]
                                    .filter(Boolean)
                                    .join(" · ") || "—"}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {clienteError && !cliente && (
                  <p className="mt-1 text-xs font-medium text-destructive">
                    O preenchimento do cliente é obrigatório para salvar o pedido.
                  </p>
                )}
              </div>

              {cliente && (
                <div className="rounded-md border border-border/80 bg-muted/30 p-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-foreground">{cliente.nome}</div>
                      <div className="text-muted-foreground">
                        WhatsApp: <span className="font-mono">{cliente.whatsapp ?? "—"}</span> ·
                        Tel: <span className="font-mono">{cliente.telefone ?? "—"}</span>
                      </div>
                      <div className="text-muted-foreground">
                        CPF/CNPJ: <span className="font-mono">{cliente.cpf_cnpj ?? "—"}</span> ·
                        E-mail: {cliente.email ?? "—"}
                      </div>
                      {cliente.endereco && (
                        <div className="text-muted-foreground">Endereço: {cliente.endereco}</div>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setCliente(null)}
                      aria-label="Remover cliente"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Itens do pedido */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/70 pb-3">
              <div>
                <CardTitle className="text-sm font-semibold">
                  Itens do Pedido ({itens.length})
                </CardTitle>
                {!podeEditarItens && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Edição de itens bloqueada para pedidos com status &ldquo;
                    {pedidoStatus === "em_producao"
                      ? "Em produção"
                      : pedidoStatus === "pronto"
                        ? "Pronto"
                        : pedidoStatus}
                    &rdquo;. Para alterar itens, retorne o pedido para Aprovado.
                  </p>
                )}
              </div>
              {podeEditarItens && (
                <Button size="sm" onClick={() => setCalcOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Adicionar item (calculadora)
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Composição de Materiais</TableHead>
                    <TableHead>Medidas</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">Unitário</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-28 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0">
                        <EmptyState
                          compact
                          icon={ShoppingBag}
                          title="Nenhum item adicionado"
                          description='Clique em "Adicionar item (calculadora)" para compor o quadro e calcular seu orçamento.'
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {itens.map((i, idx) => {
                    const grupos = produtosPorCategoria(i);
                    const m = obterMedidasPrecificacao(i);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="space-y-0.5 text-xs">
                            {grupos.length === 0 ? (
                              <span className="text-muted-foreground">{i.descricao || "—"}</span>
                            ) : (
                              grupos.map((g) => (
                                <div key={g.label}>
                                  <span className="text-muted-foreground">{g.label}:</span>{" "}
                                  <span className="font-mono text-foreground">{g.produtos}</span>
                                </div>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {m.largura}×{m.altura} cm
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {i.quantidade}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {formatBRL(i.valor_unitario)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold tabular-nums">
                          {formatBRL(i.valor_total)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-0.5">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => podeEditarItens && startEditItem(idx)}
                              aria-label="Editar"
                              title={
                                podeEditarItens
                                  ? "Editar item"
                                  : "Edição bloqueada para este status"
                              }
                              disabled={!podeEditarItens}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => podeEditarItens && cloneItem(idx)}
                              aria-label="Clonar"
                              title={
                                podeEditarItens
                                  ? "Clonar item"
                                  : "Clonagem bloqueada para este status"
                              }
                              disabled={!podeEditarItens}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => podeEditarItens && removeItem(idx)}
                              aria-label="Remover"
                              title={
                                podeEditarItens
                                  ? "Remover item"
                                  : "Remoção bloqueada para este status"
                              }
                              disabled={!podeEditarItens}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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

          {/* Observações */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Observações do Pedido</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Notas internas, especificações de entrega ou acordos comerciais…"
              />
            </CardContent>
          </Card>
        </div>

        {/* COLUNA LATERAL: DATAS, PAGAMENTO, RESUMO E AÇÕES */}
        <div className="space-y-5">
          {/* Prazos */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Datas e Prazo
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data do pedido</Label>
                <Input
                  type="date"
                  value={dataPedido}
                  onChange={(e) => setDataPedido(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">Entrega prevista *</Label>
                <Input
                  type="date"
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                  className="text-xs"
                />
              </div>
            </CardContent>
          </Card>

          {/* Forma de pagamento */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                Condições de Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Modalidade</Label>
                <Select
                  value={modalidade}
                  onValueChange={(v) => setModalidade(v as ModalidadePagamento)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALIDADES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {MODALIDADE_LABEL[m]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {modalidade === "credito_parcelado" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Parcelamento</Label>
                  <Select value={String(parcelas)} onValueChange={(v) => setParcelas(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: maxParcelas }, (_, i) => i + 1).map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {aceitaDesconto && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Desconto (%)</Label>
                  <Input
                    type="number"
                    step="any"
                    min={0}
                    max={100}
                    value={descontoPct || ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? 0 : Number(e.target.value);
                      setDescontoPct(Math.max(0, Math.min(100, val)));
                    }}
                    placeholder="0%"
                  />
                </div>
              )}

              <div className="space-y-3 border-t border-border/70 pt-3">
                <div className="flex items-center gap-6">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <Checkbox
                      checked={situacao === "sinal"}
                      onCheckedChange={(c) => handleToggleSinal(!!c)}
                    />
                    Sinal recebido
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
                    <Checkbox
                      checked={situacao === "pago"}
                      onCheckedChange={(c) => handleTogglePago(!!c)}
                    />
                    Integralmente Pago
                  </label>
                </div>

                {situacao === "sinal" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Valor do sinal (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={snapshot.total_final}
                      value={valorSinal || ""}
                      onChange={(e) => setValorSinal(Number(e.target.value) || 0)}
                      placeholder="0,00"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resumo Financeiro + Botões de Ação */}
          <Card className="border-primary/20 bg-primary/[0.015]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Receipt className="h-4 w-4 text-primary" />
                Resumo Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs sm:text-sm">
              <Row label="Quantidade de itens" value={String(itens.length)} />
              <Row label="Subtotal" value={formatBRL(snapshot.subtotal)} mono />
              {snapshot.desconto_valor > 0 && (
                <Row
                  label={`Desconto (${snapshot.desconto_percentual}%)`}
                  value={`- ${formatBRL(snapshot.desconto_valor)}`}
                  muted
                  mono
                />
              )}
              <div className="border-t border-border/80 pt-2">
                <Row label="Total final" value={formatBRL(snapshot.total_final)} strong mono />
              </div>
              {snapshot.valor_sinal > 0 && (
                <Row
                  label="Sinal recebido"
                  value={`- ${formatBRL(snapshot.valor_sinal)}`}
                  muted
                  mono
                />
              )}
              <Row label="Saldo devedor" value={formatBRL(snapshot.saldo_devedor)} strong mono />
              <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
                Situação financeira:{" "}
                <strong className="text-foreground">
                  {snapshot.situacao === "pago"
                    ? "Pago"
                    : snapshot.situacao === "sinal"
                      ? "Pagamento Parcial"
                      : "Em Aberto"}
                </strong>
                {modalidade === "credito_parcelado" && ` · ${snapshot.parcelas}x`}
              </div>

              <div className="flex flex-col gap-2 pt-3">
                {isEdit ? (
                  <>
                    {pedidoStatus === "orcamento" && (
                      <Button
                        onClick={() => void handleSalvar("aprovado")}
                        disabled={!canSalvar || saving}
                        className="w-full"
                      >
                        {approving ? "Aprovando…" : "Salvar e Aprovar"}
                      </Button>
                    )}
                    <Button
                      variant={pedidoStatus === "orcamento" ? "outline" : "default"}
                      onClick={() => void handleSalvar(pedidoStatus ?? "orcamento")}
                      disabled={!canSalvar || saving || !pedidoStatus}
                      className="w-full"
                    >
                      <Save className="h-4 w-4" />
                      Salvar alterações
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => void handleSalvar("aprovado")}
                      disabled={!canSalvar || saving}
                      className="w-full"
                    >
                      Salvar e enviar para aprovação
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handleSalvar("orcamento")}
                      disabled={!canSalvar || saving}
                      className="w-full"
                    >
                      <Save className="h-4 w-4" />
                      Salvar como orçamento
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void navigate({ to: "/pedidos" })}
                  disabled={saving}
                  className="w-full"
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog Calculadora */}
      <Dialog open={calcOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingIndex != null ? "Editar item do pedido" : "Adicionar item ao pedido"}
            </DialogTitle>
          </DialogHeader>
          <Calculadora
            key={editingIndex ?? "novo"}
            onAdd={handleAddItem}
            cancelLabel="Fechar"
            onCancel={() => handleDialogChange(false)}
            initialItem={editingIndex != null ? itens[editingIndex] : undefined}
            submitLabel={editingIndex != null ? "Salvar alterações" : "Adicionar"}
          />
        </DialogContent>
      </Dialog>

      <ClienteFormDialog
        open={cadCliOpen}
        onOpenChange={setCadCliOpen}
        onSaved={handleSavedCliente}
      />

      {/* Confirmação de rollback da OP ao editar itens */}
      <AlertDialog open={showOpConfirmDialog} onOpenChange={setShowOpConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alteração em pedido vinculado a OP</AlertDialogTitle>
            <AlertDialogDescription>
              Este pedido está vinculado a uma Ordem de Produção aberta. Ao salvar alterações
              produtivas nos itens, o pedido será removido da OP e retornará para o status Aprovado.
              Deseja prosseguir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmarRollbackOP();
              }}
              disabled={saving}
            >
              Confirmar e atualizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de arquivamento de OP vazia */}
      <AlertDialog open={showArchiveOpConfirmDialog} onOpenChange={setShowArchiveOpConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ordem de Produção ficou sem pedidos</AlertDialogTitle>
            <AlertDialogDescription>
              Com a remoção deste pedido, a Ordem de Produção ficou vazia. Deseja arquivá-la
              automaticamente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={(e) => {
                e.preventDefault();
                void recusarArquivamentoOP();
              }}
              disabled={saving}
            >
              Manter OP aberta
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmarArquivamentoOP();
              }}
              disabled={saving}
            >
              Arquivar OP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
  mono,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={muted ? "text-muted-foreground" : "text-foreground/80"}>{label}</span>
      <span
        className={`${strong ? "text-sm font-semibold text-foreground" : ""} ${
          mono ? "font-mono tabular-nums" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

const CATEGORIA_LABEL: Record<string, string> = {
  perfil_moldura: "Moldura",
  passe_partout: "Passe-partout",
  protecao_frontal: "Vidro",
  fundo: "Fundo",
  impressao: "Impressão",
  chassi: "Chassi",
  servico: "Serviço",
};

function formatarMaterialProduto(
  codigo: string | null | undefined,
  descricao: string | null | undefined,
): string {
  const cod = (codigo ?? "").trim();
  let desc = (descricao ?? "").trim();

  if (cod && desc.toLowerCase().startsWith(cod.toLowerCase())) {
    desc = desc
      .slice(cod.length)
      .replace(/^[\s—\-–:]+/, "")
      .trim();
  }

  let descAbreviada = "";
  if (desc) {
    descAbreviada = desc.length > 10 ? desc.slice(0, 9) + "…" : desc;
  }

  if (cod && descAbreviada) {
    return `${cod} - ${descAbreviada}`;
  }
  if (cod) {
    return cod;
  }
  return descAbreviada;
}

interface MetadadosItemPayload {
  calculo?: {
    materiais?: Array<{
      origem: string;
      codigo: string | null;
      descricao: string;
    }>;
  };
}

function produtosPorCategoria(item: PedidoItemDraft): { label: string; produtos: string }[] {
  const md = item.metadados as unknown as MetadadosItemPayload | null;
  const materiais = md?.calculo?.materiais ?? [];
  const grouped = new Map<string, string[]>();

  for (const m of materiais) {
    const formatted = formatarMaterialProduto(m.codigo, m.descricao);
    if (!formatted) continue;
    const arr = grouped.get(m.origem) ?? [];
    if (!arr.includes(formatted)) arr.push(formatted);
    grouped.set(m.origem, arr);
  }

  return Array.from(grouped.entries()).map(([origem, prods]) => ({
    label: CATEGORIA_LABEL[origem] ?? origem,
    produtos: prods.join(", "),
  }));
}
