import { supabase } from "@/integrations/supabase/client";
import type { Pagamento, PagamentoInsert, PagamentoUpdate } from "@/types/erp";

export const pagamentosService = {
  async listByPedido(pedidoId: string): Promise<Pagamento[]> {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("pedido_id", pedidoId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listAll(): Promise<
    (Pagamento & { pedido: { numero_pedido: number; cliente: { nome: string } | null } | null })[]
  > {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*, pedido:pedidos(numero_pedido, cliente:clientes(nome))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as any) ?? [];
  },

  async create(input: PagamentoInsert): Promise<Pagamento> {
    const { data, error } = await supabase.from("pagamentos").insert(input).select("*").single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: PagamentoUpdate): Promise<Pagamento> {
    const { data, error } = await supabase
      .from("pagamentos")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string) {
    const { error } = await supabase.from("pagamentos").delete().eq("id", id);
    if (error) throw error;
  },
};
