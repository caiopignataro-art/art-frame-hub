import { supabase } from "@/integrations/supabase/client";
import type {
  Orcamento,
  OrcamentoComItens,
  OrcamentoInsert,
  OrcamentoUpdate,
  OrcamentoItemInsert,
  OrcamentoStatus,
} from "@/types/erp";

export const orcamentosService = {
  async list(): Promise<(Orcamento & { cliente: { nome: string } | null })[]> {
    const { data, error } = await supabase
      .from("orcamentos")
      .select("*, cliente:clientes(nome)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as any) ?? [];
  },

  async get(id: string): Promise<OrcamentoComItens | null> {
    const { data, error } = await supabase
      .from("orcamentos")
      .select("*, cliente:clientes(*), itens:orcamento_itens(*)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as OrcamentoComItens | null;
  },

  async create(input: OrcamentoInsert): Promise<Orcamento> {
    const { data, error } = await supabase.from("orcamentos").insert(input).select("*").single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: OrcamentoUpdate): Promise<Orcamento> {
    const { data, error } = await supabase
      .from("orcamentos")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async setStatus(id: string, status: OrcamentoStatus) {
    return this.update(id, { status });
  },

  async remove(id: string) {
    const { error } = await supabase.from("orcamentos").delete().eq("id", id);
    if (error) throw error;
  },

  // ----- itens -----
  async addItem(item: OrcamentoItemInsert) {
    const { data, error } = await supabase
      .from("orcamento_itens")
      .insert(item)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async removeItem(itemId: string) {
    const { error } = await supabase.from("orcamento_itens").delete().eq("id", itemId);
    if (error) throw error;
  },
};
