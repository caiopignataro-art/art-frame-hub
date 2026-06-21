import { supabase } from "@/integrations/supabase/client";
import type { Produto, ProdutoInsert, ProdutoUpdate, ProdutoTipo } from "@/types/erp";

export const produtosService = {
  async list(opts?: { tipo?: ProdutoTipo; ativo?: boolean }): Promise<Produto[]> {
    let q = supabase.from("produtos").select("*").order("nome");
    if (opts?.tipo) q = q.eq("tipo", opts.tipo);
    if (opts?.ativo !== undefined) q = q.eq("ativo", opts.ativo);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },

  async get(id: string): Promise<Produto | null> {
    const { data, error } = await supabase.from("produtos").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async create(input: ProdutoInsert): Promise<Produto> {
    const { data, error } = await supabase.from("produtos").insert(input).select("*").single();
    if (error) throw error;
    return data;
  },

  async update(id: string, patch: ProdutoUpdate): Promise<Produto> {
    const { data, error } = await supabase
      .from("produtos")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) throw error;
  },
};
