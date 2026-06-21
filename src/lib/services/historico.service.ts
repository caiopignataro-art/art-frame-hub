import { supabase } from "@/integrations/supabase/client";
import type { Historico } from "@/types/erp";

export const historicoService = {
  async list(opts?: { entidade?: string; entidadeId?: string; limit?: number }): Promise<Historico[]> {
    let q = supabase
      .from("historico")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(opts?.limit ?? 100);
    if (opts?.entidade) q = q.eq("entidade", opts.entidade);
    if (opts?.entidadeId) q = q.eq("entidade_id", opts.entidadeId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  },
};
