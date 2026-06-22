/**
 * Serviço de configurações do sistema (chave/valor JSONB).
 */
import { supabase } from "@/integrations/supabase/client";
import type { ConfiguracaoSistema } from "@/types/estoque";

export const configuracoesService = {
  async list(): Promise<ConfiguracaoSistema[]> {
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .select("*")
      .order("chave");
    if (error) throw error;
    return data ?? [];
  },

  async getNumber(chave: string, fallback: number): Promise<number> {
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", chave)
      .maybeSingle();
    if (error || !data) return fallback;
    const v = data.valor as unknown;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
  },

  async setNumber(chave: string, valor: number, descricao?: string) {
    const { error } = await supabase
      .from("configuracoes_sistema")
      .upsert(
        { chave, valor: valor as unknown as never, descricao: descricao ?? null },
        { onConflict: "chave" },
      );
    if (error) throw error;
  },
};
