import { supabase } from "@/integrations/supabase/client";
import type {
  Pedido,
  PedidoComItens,
  PedidoInsert,
  PedidoUpdate,
  PedidoItemInsert,
  PedidoStatus,
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
        "*, cliente:clientes(*), itens:pedido_itens(*), pagamentos:pagamentos(*)"
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

  // itens
  async addItem(item: PedidoItemInsert) {
    const { data, error } = await supabase.from("pedido_itens").insert(item).select("*").single();
    if (error) throw error;
    return data;
  },

  async removeItem(itemId: string) {
    const { error } = await supabase.from("pedido_itens").delete().eq("id", itemId);
    if (error) throw error;
  },
};
