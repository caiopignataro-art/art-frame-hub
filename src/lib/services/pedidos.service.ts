import { supabase } from "@/integrations/supabase/client";
import { ordemProducaoService } from "./ordem-producao.service";
import type {
  Pedido,
  PedidoComItens,
  PedidoInsert,
  PedidoUpdate,
  PedidoItem,
  PedidoItemInsert,
  PedidoStatus,
  PedidoItemDraft,
  Cliente,
} from "@/types/erp";

export const pedidosService = {
  async list(opts?: {
    status?: PedidoStatus;
    incluirArquivados?: boolean;
  }): Promise<(Pedido & { cliente: { nome: string } | null })[]> {
    let q = supabase
      .from("pedidos")
      .select("*, cliente:clientes(nome)")
      .order("created_at", { ascending: false });
    if (opts?.status) q = q.eq("status", opts.status);
    
    const { data, error } = await q;
    if (error) throw error;
    
    const result = ((data as any) ?? []) as (Pedido & { cliente: { nome: string } | null })[];
    if (opts?.incluirArquivados === true) {
      return result;
    }
    
    return result.filter(p => !((p.metadados as any)?.arquivado === true));
  },

  async arquivarEmLote(ids: string[]): Promise<void> {
    await Promise.all(
      ids.map(async (id) => {
        const { data: atual } = await supabase
          .from("pedidos")
          .select("metadados")
          .eq("id", id)
          .single();
        const metadados = { ...((atual?.metadados as any) ?? {}), arquivado: true };
        const { error } = await supabase
          .from("pedidos")
          .update({ metadados } as any)
          .eq("id", id);
        if (error) throw error;
      })
    );
  },

  async produzirEmLote(ids: string[]): Promise<void> {
    await this.setStatusLote(ids, "em_producao");
  },

  async finalizarProducaoEmLote(ids: string[]): Promise<void> {
    await this.setStatusLote(ids, "pronto");
  },

  /**
   * Retorna um pedido com status 'em_producao' para 'aprovado'.
   * Se estiver vinculado a uma Ordem de Produção (OP), anula seletiva e atomicamente
   * a participação deste pedido e de seus itens na OP via RPC, preservando os
   * outros pedidos intactos. Se a OP ficar vazia, cancela a OP vazia.
   */
  async voltarParaAprovado(id: string, motivo: string = "Retorno de Em Produção para Aprovado"): Promise<void> {
    const { data: p, error: pErr } = await supabase
      .from("pedidos")
      .select("id, status, ordem_producao_id")
      .eq("id", id)
      .single();
    if (pErr) throw pErr;
    if (!p) throw new Error("Pedido não encontrado.");

    if (p.ordem_producao_id) {
      const res = await ordemProducaoService.removerPedido({
        pedidoId: id,
        motivo,
      });
      if (res.op_ficou_vazia) {
        await ordemProducaoService.cancelar(res.ordem_producao_id);
      }
    } else {
      await this.update(id, { status: "aprovado" });
    }
  },

  async voltarParaAprovadoEmLote(ids: string[]): Promise<void> {
    for (const id of ids) {
      await this.voltarParaAprovado(id, "Retorno em lote de Em Produção para Aprovado");
    }
  },

  async setStatusLote(ids: string[], status: PedidoStatus): Promise<void> {
    await Promise.all(
      ids.map(async (id) => {
        await this.setStatus(id, status);
      })
    );
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
    if (status === "aprovado") {
      const { data: p } = await supabase
        .from("pedidos")
        .select("status, ordem_producao_id")
        .eq("id", id)
        .maybeSingle();
      if (p?.status === "em_producao" && p.ordem_producao_id) {
        return this.voltarParaAprovado(id);
      }
    }
    return this.update(id, { status });
  },

  async reverterAprovacao(id: string): Promise<void> {
    const { error } = await supabase.rpc("rpc_reverter_aprovacao_pedido", {
      p_pedido_id: id,
    });
    if (error) throw error;
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
    if (!opts.cliente_id || typeof opts.cliente_id !== "string" || opts.cliente_id.trim() === "") {
      throw new Error("Cliente é obrigatório para salvar ou finalizar o pedido/orçamento.");
    }

    const total =
      opts.pagamento?.total_final ??
      opts.itens.reduce((s, i) => s + Number(i.valor_total), 0);

    const metadados: Record<string, unknown> = {};
    if (opts.pagamento) metadados.pagamento = opts.pagamento;

    // Insere sempre como 'orcamento' para não disparar o trigger de validação
    // antes do registro em pagamentos existir. Ajustamos o status ao final.
    const { data: pedido, error } = await supabase
      .from("pedidos")
      .insert({
        cliente_id: opts.cliente_id,
        status: "orcamento",
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

    // Aplica o status final somente após pagamentos existirem, para o
    // trigger `tg_validar_status_pedido` conseguir enxergar a linha de pagamento.
    const statusFinal = opts.status ?? "orcamento";
    if (statusFinal !== "orcamento") {
      const { data: atualizado, error: sErr } = await supabase
        .from("pedidos")
        .update({ status: statusFinal } as PedidoUpdate)
        .eq("id", pedido.id)
        .select("*")
        .single();
      if (sErr) throw sErr;
      return atualizado as Pedido;
    }

    return pedido as Pedido;
  },

  /**
   * Atualiza um pedido existente substituindo itens e pagamentos. Preserva
   * numero_pedido e histórico (via trigger de auditoria). Não altera o status
   * automaticamente — use setStatus separadamente se necessário.
   */
  async atualizarPedidoCompleto(
    id: string,
    opts: {
      cliente_id: string | null;
      itens: PedidoItemDraft[];
      forma_pagamento: PedidoInsert["forma_pagamento"];
      data_pedido: string;
      data_entrega_prevista: string;
      observacoes?: string | null;
      status?: PedidoStatus;
      pagamento?: import("@/lib/pagamento/modalidade").PagamentoSnapshot;
    },
  ): Promise<Pedido> {
    if (!opts.cliente_id || typeof opts.cliente_id !== "string" || opts.cliente_id.trim() === "") {
      throw new Error("Cliente é obrigatório para salvar ou finalizar o pedido/orçamento.");
    }

    const total =
      opts.pagamento?.total_final ??
      opts.itens.reduce((s, i) => s + Number(i.valor_total), 0);

    // Recupera pedido e metadados atuais para validar status e integridade
    const { data: atual, error: eGet } = await supabase
      .from("pedidos")
      .select("metadados, status, itens:pedido_itens(*)")
      .eq("id", id)
      .maybeSingle();
    if (eGet) throw eGet;
    if (!atual) throw new Error("Pedido não encontrado.");

    // Matriz de permissão: apenas 'orcamento' e 'aprovado' permitem alterar itens
    const podeEditarItens = atual.status === "orcamento" || atual.status === "aprovado";
    if (!podeEditarItens) {
      const itensOriginais: PedidoItem[] = (atual.itens ?? []) as PedidoItem[];
      const normalizarMetadados = (meta: unknown): string => {
        if (!meta || typeof meta !== "object" || Object.keys(meta).length === 0) return "{}";
        try {
          const sortKeys = (obj: unknown): unknown => {
            if (obj === null || typeof obj !== "object") return obj;
            if (Array.isArray(obj)) return obj.map(sortKeys);
            const record = obj as Record<string, unknown>;
            return Object.keys(record)
              .sort()
              .reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = sortKeys(record[key]);
                return acc;
              }, {});
          };
          return JSON.stringify(sortKeys(meta));
        } catch {
          return "";
        }
      };

      const alterouItens =
        opts.itens.length !== itensOriginais.length ||
        opts.itens.some((it: PedidoItemDraft, idx: number) => {
          const orig = itensOriginais[idx];
          if (!orig) return true;
          return (
            it.descricao !== orig.descricao ||
            Number(it.quantidade) !== Number(orig.quantidade) ||
            Number(it.largura_cm) !== Number(orig.largura_cm) ||
            Number(it.altura_cm) !== Number(orig.altura_cm) ||
            Number(it.valor_unitario) !== Number(orig.valor_unitario) ||
            Number(it.valor_total) !== Number(orig.valor_total) ||
            normalizarMetadados(it.metadados) !== normalizarMetadados(orig.metadados)
          );
        });

      if (alterouItens) {
        throw new Error(
          `Edição de itens bloqueada: pedidos com status "${atual.status}" não permitem adicionar, remover ou modificar itens.`
        );
      }
    }

    const metadados: Record<string, unknown> = { ...((atual?.metadados as any) ?? {}) };
    if (opts.pagamento) metadados.pagamento = opts.pagamento;
    else delete metadados.pagamento;

    const patch: PedidoUpdate = {
      cliente_id: opts.cliente_id,
      valor_total: total,
      observacoes: opts.observacoes ?? null,
      data_pedido: opts.data_pedido,
      data_entrega_prevista: opts.data_entrega_prevista,
      metadados: metadados as any,
    };
    // Não altera status nem forma_pagamento neste passo: aplicaremos ao final, após substituir
    // os pagamentos, para o trigger `tg_validar_status_pedido` conseguir
    // validar o pedido já com as linhas de pagamento corretas.

    const { data: pedido, error } = await supabase
      .from("pedidos")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    // Substitui itens apenas se o status do pedido permitir edição de itens
    if (podeEditarItens) {
      const { error: dErr } = await supabase.from("pedido_itens").delete().eq("pedido_id", id);
      if (dErr) throw dErr;
      if (opts.itens.length > 0) {
        const rows = opts.itens.map((i) => ({
          pedido_id: id,
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
    }

    // Substitui pagamentos
    const { error: pDelErr } = await supabase.from("pagamentos").delete().eq("pedido_id", id);
    if (pDelErr) console.error("[atualizarPedidoCompleto] falha ao remover pagamentos", pDelErr);
    if (opts.pagamento && opts.forma_pagamento) {
      const snap = opts.pagamento;
      const status =
        snap.situacao === "pago" ? "pago" : snap.situacao === "sinal" ? "parcial" : "pendente";
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
        pedido_id: id,
        forma_pagamento: opts.forma_pagamento,
        status,
        valor: snap.total_final,
        data_pagamento: snap.situacao === "aberto" ? null : new Date().toISOString(),
        observacoes: obs,
      } as any);
      if (pErr) console.error("[atualizarPedidoCompleto] falha ao criar pagamento", pErr);
    }

    // Aplica status final e forma_pagamento após pagamentos existirem.
    const finalPatch: PedidoUpdate = {
      forma_pagamento: opts.forma_pagamento,
      ...(opts.status ? { status: opts.status } : {}),
    };

    const { data: atualizado, error: sErr } = await supabase
      .from("pedidos")
      .update(finalPatch)
      .eq("id", id)
      .select("*")
      .single();
    if (sErr) throw sErr;
    return atualizado as Pedido;
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

