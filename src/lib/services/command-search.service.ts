/**
 * Serviço de busca global incremental e limitada para a Command Palette.
 * Executa exclusivamente consultas de leitura paginadas (`limit` / `range`),
 * evitando carregar listas completas desnecessariamente e sem alterar os serviços operacionais.
 */
import { supabase } from "@/integrations/supabase/client";
import type { OrdemProducaoStatus, PedidoStatus, ProdutoTipo } from "@/types/erp";

export interface CommandPedidoSummary {
  id: string;
  numero_pedido: number;
  status: PedidoStatus;
  valor_total: number;
  cliente: { nome: string } | null;
}

export interface CommandOPSummary {
  id: string;
  numero: number;
  status: OrdemProducaoStatus;
  qtd_pedidos: number;
}

export interface CommandClienteSummary {
  id: string;
  nome: string;
  whatsapp: string | null;
  telefone: string | null;
  cpf_cnpj: string | null;
  email: string | null;
}

export interface CommandProdutoSummary {
  id: string;
  codigo: string | null;
  nome: string;
  fabricante: string | null;
  tipo: ProdutoTipo;
  preco_venda: number;
}

const DEFAULT_LIMIT = 8;

function sanitizeTerm(raw: string): string {
  return raw
    .trim()
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumericToken(raw: string): number | null {
  const cleaned = raw.trim().replace(/^#/, "").replace(/^op-?/i, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const num = Number(cleaned);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

export const commandSearchService = {
  async searchPedidos(params: {
    query: string;
    limit?: number;
    page?: number;
  }): Promise<CommandPedidoSummary[]> {
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), 20);
    const page = Math.max(params.page ?? 0, 0);
    const from = page * limit;
    const to = from + limit - 1;

    const term = sanitizeTerm(params.query);
    const num = parseNumericToken(params.query);

    let q = supabase
      .from("pedidos")
      .select("id, numero_pedido, status, valor_total, metadados, cliente:clientes(nome)")
      .order("created_at", { ascending: false });

    if (num !== null) {
      q = q.eq("numero_pedido", num);
    } else if (term.length >= 2) {
      // Busca clientes compatíveis primeiro para filtrar pedidos pelo nome do cliente sem carregar toda a tabela
      const { data: matchingClientes } = await supabase
        .from("clientes")
        .select("id")
        .ilike("nome", `%${term}%`)
        .limit(20);

      const clienteIds = (matchingClientes ?? []).map((c) => c.id);
      if (clienteIds.length === 0) {
        return [];
      }
      q = q.in("cliente_id", clienteIds);
    }

    const { data, error } = await q.range(from, to);
    if (error) throw error;

    const rows = (data ?? []) as Array<
      CommandPedidoSummary & { metadados?: { arquivado?: boolean } | null }
    >;

    return rows
      .filter((r) => !(r.metadados && r.metadados.arquivado === true))
      .map(({ id, numero_pedido, status, valor_total, cliente }) => ({
        id,
        numero_pedido,
        status,
        valor_total,
        cliente: cliente ?? null,
      }));
  },

  async searchOrdensProducao(params: {
    query: string;
    limit?: number;
    page?: number;
  }): Promise<CommandOPSummary[]> {
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), 20);
    const page = Math.max(params.page ?? 0, 0);
    const from = page * limit;
    const to = from + limit - 1;

    const num = parseNumericToken(params.query);
    let q = supabase
      .from("v_ordens_producao")
      .select("id, numero, status, qtd_pedidos")
      .order("numero", { ascending: false });

    if (num !== null) {
      q = q.eq("numero", num);
    }

    const { data, error } = await q.range(from, to);
    if (error) throw error;

    return (data ?? []).map((op) => ({
      id: op.id,
      numero: Number(op.numero),
      status: op.status as OrdemProducaoStatus,
      qtd_pedidos: Number(op.qtd_pedidos ?? 0),
    }));
  },

  async searchClientes(params: {
    query: string;
    limit?: number;
    page?: number;
  }): Promise<CommandClienteSummary[]> {
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), 20);
    const page = Math.max(params.page ?? 0, 0);
    const from = page * limit;
    const to = from + limit - 1;

    const term = sanitizeTerm(params.query);
    let q = supabase
      .from("clientes")
      .select("id, nome, whatsapp, telefone, cpf_cnpj, email")
      .order("nome");

    if (term.length >= 1) {
      q = q.or(
        `nome.ilike.%${term}%,whatsapp.ilike.%${term}%,telefone.ilike.%${term}%,cpf_cnpj.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }

    const { data, error } = await q.range(from, to);
    if (error) throw error;
    return (data ?? []) as CommandClienteSummary[];
  },

  async searchProdutos(params: {
    query: string;
    limit?: number;
    page?: number;
  }): Promise<CommandProdutoSummary[]> {
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), 20);
    const page = Math.max(params.page ?? 0, 0);
    const from = page * limit;
    const to = from + limit - 1;

    const term = sanitizeTerm(params.query);
    let q = supabase
      .from("produtos")
      .select("id, codigo, nome, fabricante, tipo, preco_venda")
      .eq("ativo", true)
      .order("nome");

    if (term.length >= 1) {
      q = q.or(`codigo.ilike.%${term}%,nome.ilike.%${term}%,fabricante.ilike.%${term}%`);
    }

    const { data, error } = await q.range(from, to);
    if (error) throw error;
    return (data ?? []) as CommandProdutoSummary[];
  },
};
