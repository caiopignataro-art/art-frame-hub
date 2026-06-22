/**
 * Serviço WhatsApp — arquitetura preparada para integração futura.
 *
 * Atualmente as mensagens são enfileiradas na tabela `notificacoes_whatsapp`
 * (status = "pendente"). Quando o provedor (Cloud API / Z-API / Twilio) for
 * integrado, basta consumir a fila e chamar `marcarEnviado` / `marcarFalha`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { NotificacaoWhatsapp, NotificacaoWhatsappInsert, WhatsappEvento } from "@/types/erp";

export const whatsappService = {
  async list(opts?: { status?: string; limit?: number }): Promise<NotificacaoWhatsapp[]> {
    let q = supabase
      .from("notificacoes_whatsapp")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(opts?.limit ?? 100);
    if (opts?.status) q = q.eq("status", opts.status);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async listByPedido(pedidoId: string): Promise<NotificacaoWhatsapp[]> {
    const { data, error } = await supabase
      .from("notificacoes_whatsapp")
      .select("*")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async enfileirar(input: NotificacaoWhatsappInsert) {
    const { data, error } = await supabase
      .from("notificacoes_whatsapp")
      .insert(input)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async dispararEvento(params: {
    pedidoId?: string | null;
    clienteId?: string | null;
    evento: WhatsappEvento;
    destinatario?: string | null;
    mensagem: string;
    payload?: Record<string, unknown>;
  }) {
    return this.enfileirar({
      pedido_id: params.pedidoId ?? null,
      cliente_id: params.clienteId ?? null,
      evento: params.evento,
      destinatario: params.destinatario ?? null,
      mensagem: params.mensagem,
      payload: (params.payload ?? {}) as never,
    });
  },

  async marcarEnviado(id: string) {
    const { error } = await supabase
      .from("notificacoes_whatsapp")
      .update({ status: "enviado", enviado_em: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  async marcarFalha(id: string, erro: string) {
    const { error } = await supabase
      .from("notificacoes_whatsapp")
      .update({ status: "falha", erro })
      .eq("id", id);
    if (error) throw error;
  },
};
