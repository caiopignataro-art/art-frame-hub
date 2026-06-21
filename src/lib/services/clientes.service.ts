import { supabase } from "@/integrations/supabase/client";
import type { Cliente, ClienteInsert, ClienteUpdate } from "@/types/erp";

export const clientesService = {
  async list(): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("nome", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async get(id: string): Promise<Cliente | null> {
    const { data, error } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(input: ClienteInsert): Promise<Cliente> {
    const { data, error } = await supabase.from("clientes").insert(input).select("*").single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: ClienteUpdate): Promise<Cliente> {
    const { data, error } = await supabase
      .from("clientes")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) throw error;
  },
};
