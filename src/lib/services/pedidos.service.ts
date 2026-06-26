import { supabase } from "@/integrations/supabase/client";
import type {
  Pedido,
  PedidoComItens,
  PedidoInsert,
  PedidoUpdate,
  PedidoItemInsert,
  PedidoStatus,
  PedidoItemDraft,
  Cliente,
} from "@/types/erp";

export const pedidosService = {
  async list(opts?: { status?: PedidoStatus }): Promise<
    (Pedido & { cliente: { nome: string } | null })[]
  > {
    let q = supabase
      .from("pedidos")
      .select("*, cliente:clientes(nome)")
      .order("created_at", { ascending: false });
    if (opts?.status) q = q.eq("status", opts.status);
    const { data, error } = await q;
    if (error) throw error;
    return (data as any) ?? [];
  },

  async get(id: string): Promise<PedidoComItens | null> {
    const { data, error } = await supabase
      .from("pedidos")
      .select(
        "*, cliente:clientes(*), itens:pedido_itens(*), pagamentos:pagamentos(*)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as PedidoComItens | null;
  },

  async create(input: PedidoInsert): Promise<Pedido> {
    const { data, error } = await supabase.from("pedidos").insert(input).select("*").single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: PedidoUpdate): Promise<Pedido> {
    const { data, error } = await supabase
      .from("pedidos")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async setStatus(id: string, status: PedidoStatus) {
    return this.update(id, { status });
  },

  async remove(id: string) {
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) throw error;
  },

  async addItem(item: PedidoItemInsert) {
    const { data, error } = await supabase.from("pedido_itens").insert(item).select("*").single();
    if (error) throw error;
    return data;
  },

  async removeItem(itemId: string) {
    const { error } = await supabase.from("pedido_itens").delete().eq("id", itemId);
    if (error) throw error;
  },

  /**
   * Cria um pedido completo (com cliente já resolvido), seus itens e o registro
   * financeiro em `pagamentos` baseado no snapshot.
   */
  async criarPedidoCompleto(opts: {
    cliente_id: string | null;
    itens: PedidoItemDraft[];
    forma_pagamento: PedidoInsert["forma_pagamento"];
    data_pedido: string;
    data_entrega_prevista: string;
    observacoes?: string | null;
    status?: PedidoStatus;
    /** Snapshot financeiro (modalidade UI, parcelas, sinal, desconto). */
    pagamento?: import("@/lib/pagamento/modalidade").PagamentoSnapshot;
  }): Promise<Pedido> {
    const total =
      opts.pagamento?.total_final ??
      opts.itens.reduce((s, i) => s + Number(i.valor_total), 0);

    const metadados: Record<string, unknown> = {};
    if (opts.pagamento) metadados.pagamento = opts.pagamento;

    const { data: pedido, error } = await supabase
      .from("pedidos")
      .insert({
        cliente_id: opts.cliente_id,
        status: opts.status ?? "orcamento",
        valor_total: total,
        observacoes: opts.observacoes ?? null,
        forma_pagamento: opts.forma_pagamento,
        data_pedido: opts.data_pedido,
        data_entrega_prevista: opts.data_entrega_prevista,
        metadados: metadados as any,
      } as any)
      .select("*")
      .single();
    if (error) throw error;

    if (opts.itens.length > 0) {
      const rows = opts.itens.map((i) => ({
        pedido_id: pedido.id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        largura_cm: i.largura_cm,
        altura_cm: i.altura_cm,
        valor_unitario: i.valor_unitario,
        valor_total: i.valor_total,
        metadados: i.metadados,
      }));
      const { error: iErr } = await supabase.from("pedido_itens").insert(rows as any);
      if (iErr) throw iErr;
    }

    // Cria registro em pagamentos (auto)
    if (opts.pagamento && opts.forma_pagamento) {
      const snap = opts.pagamento;
      const status =
        snap.situacao === "pago"
          ? "pago"
          : snap.situacao === "sinal"
          ? "parcial"
          : "pendente";
      const valorPago =
        snap.situacao === "pago"
          ? snap.total_final
          : snap.situacao === "sinal"
          ? snap.valor_sinal
          : 0;
      const obs = JSON.stringify({
        modalidade: snap.modalidade,
        parcelas: snap.parcelas,
        subtotal: snap.subtotal,
        desconto_percentual: snap.desconto_percentual,
        desconto_valor: snap.desconto_valor,
        total_final: snap.total_final,
        valor_pago: valorPago,
        saldo_devedor: snap.saldo_devedor,
      });
      const { error: pErr } = await supabase.from("pagamentos").insert({
        pedido_id: pedido.id,
        forma_pagamento: opts.forma_pagamento,
        status,
        valor: snap.total_final,
        data_pagamento: snap.situacao === "aberto" ? null : new Date().toISOString(),
        observacoes: obs,
      } as any);
      if (pErr) console.error("[criarPedidoCompleto] falha ao criar pagamento", pErr);
    }

    return pedido as Pedido;
  },

  /** Marca pedido como WhatsApp enviado e salva pdf_url opcional. */
  async marcarWhatsappEnviado(id: string, pdf_url?: string | null) {
    return this.update(id, { whatsapp_enviado: true, ...(pdf_url ? { pdf_url } : {}) } as PedidoUpdate);
  },

  /** Helper para buscar cliente do pedido (usado no envio WhatsApp). */
  async getCliente(pedidoId: string): Promise<Cliente | null> {
    const p = await this.get(pedidoId);
    return p?.cliente ?? null;
  },
};

