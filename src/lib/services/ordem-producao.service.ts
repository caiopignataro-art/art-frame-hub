import { supabase } from "@/integrations/supabase/client";
import type { OrdemProducao, OrdemProducaoStatus, PedidoComItens } from "@/types/erp";

export const ordemProducaoService = {
  async list(): Promise<(OrdemProducao & { qtd_pedidos: number })[]> {
    const { data: ops, error: opsError } = await supabase
      .from("ordem_producao")
      .select("*")
      .order("numero", { ascending: false });

    if (opsError) throw new Error(`Erro ao listar Ordens de Produção: ${opsError.message}`);

    const { data: counts, error: countsError } = await supabase
      .from("pedidos")
      .select("ordem_producao_id")
      .not("ordem_producao_id", "is", null);

    if (countsError) throw new Error(`Erro ao obter contagem de pedidos: ${countsError.message}`);

    const countsMap = new Map<string, number>();
    for (const c of counts) {
      if (c.ordem_producao_id) {
        countsMap.set(c.ordem_producao_id, (countsMap.get(c.ordem_producao_id) ?? 0) + 1);
      }
    }

    return (ops ?? []).map((op) => ({
      ...op,
      status: op.status as OrdemProducaoStatus,
      qtd_pedidos: countsMap.get(op.id) ?? 0,
    }));
  },

  async get(id: string): Promise<{
    op: OrdemProducao;
    pedidos: PedidoComItens[];
    opItens: any[];
    itensCount: number;
    quantidadesCount: number;
    historico: any[];
  } | null> {
    const { data: op, error: opError } = await supabase
      .from("ordem_producao")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (opError) throw new Error(`Erro ao buscar Ordem de Produção: ${opError.message}`);
    if (!op) return null;

    const { data: pedidos, error: pedidosError } = await supabase
      .from("pedidos")
      .select("*, cliente:clientes(*), itens:pedido_itens(*), pagamentos:pagamentos(*)")
      .eq("ordem_producao_id", id);

    if (pedidosError) throw new Error(`Erro ao buscar pedidos da Ordem de Produção: ${pedidosError.message}`);

    const { data: opItens, error: opItensError } = await supabase
      .from("ordem_producao_itens")
      .select("*")
      .eq("ordem_producao_id", id);

    if (opItensError) throw new Error(`Erro ao buscar itens de controle da Ordem de Produção: ${opItensError.message}`);

    const { data: hist, error: histError } = await supabase
      .from("historico")
      .select("*")
      .eq("entidade", "ordem_producao")
      .eq("entidade_id", id)
      .order("created_at", { ascending: true });

    if (histError) throw new Error(`Erro ao buscar histórico da Ordem de Produção: ${histError.message}`);

    let totalItens = 0;
    let totalQtd = 0;
    for (const p of pedidos ?? []) {
      const items = (p.itens as any[]) ?? [];
      totalItens += items.length;
      totalQtd += items.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
    }

    return {
      op: op as OrdemProducao,
      pedidos: (pedidos as unknown as PedidoComItens[]) ?? [],
      opItens: opItens ?? [],
      itensCount: totalItens,
      quantidadesCount: totalQtd,
      historico: hist ?? [],
    };
  },

  async create(params: { pedidosIds: string[]; observacoes?: string | null }): Promise<string> {
    const { pedidosIds, observacoes = null } = params;

    if (!pedidosIds || pedidosIds.length === 0) {
      throw new Error("Selecione pelo menos um pedido para iniciar a produção.");
    }

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    const { data: opId, error } = await supabase.rpc("criar_ordem_producao", {
      p_pedidos_ids: pedidosIds,
      p_observacoes: observacoes,
      p_criado_por: userId,
    });

    if (error) {
      if (error.message.includes("não estão aptos para produção")) {
        throw new Error("Um ou mais pedidos selecionados não estão aptos para produção. Atualize a listagem e tente novamente.");
      }
      throw new Error(`Erro ao criar Ordem de Produção: ${error.message}`);
    }

    return opId;
  },

  async removerPedido(params: { pedidoId: string; motivo: string }): Promise<{
    ordem_producao_id: string;
    op_ficou_vazia: boolean;
    pedidos_restantes: number;
  }> {
    const { pedidoId, motivo } = params;

    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || null;

    const { data, error } = await supabase.rpc("remover_pedido_da_ordem_producao", {
      p_pedido_id: pedidoId,
      p_motivo: motivo,
      p_usuario_id: userId,
    });

    if (error) {
      throw new Error(`Erro ao remover pedido da Ordem de Produção: ${error.message}`);
    }

    const payload = data as any;
    return {
      ordem_producao_id: payload.ordem_producao_id,
      op_ficou_vazia: !!payload.op_ficou_vazia,
      pedidos_restantes: Number(payload.pedidos_restantes || 0),
    };
  },

  async concluir(id: string): Promise<void> {
    const { error } = await supabase
      .from("ordem_producao")
      .update({
        status: "Concluída",
        concluido_em: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao concluir Ordem de Produção: ${error.message}`);
    }

    const { data: { user } } = await supabase.auth.getUser();
    const v_usuario = user?.email || "sistema";

    await supabase.from("historico").insert({
      entidade: "ordem_producao",
      entidade_id: id,
      usuario: v_usuario,
      acao: "status_alterado",
      descricao: "Ordem de Produção concluída.",
    });
  },

  async arquivar(id: string): Promise<void> {
    const opDetalhada = await this.get(id);
    if (!opDetalhada) throw new Error("Ordem de Produção não encontrada.");

    const { op, pedidos } = opDetalhada;

    const temPedidosAtivos = pedidos.some((p) => p.status === "em_producao");

    if (op.status === "Em Preparação" && temPedidosAtivos) {
      throw new Error("Não é permitido arquivar uma Ordem de Produção ativa contendo pedidos em andamento.");
    }

    const { error } = await supabase
      .from("ordem_producao")
      .update({
        status: "Arquivada",
      })
      .eq("id", id);

    if (error) {
      throw new Error(`Erro ao arquivar Ordem de Produção: ${error.message}`);
    }

    const { data: { user } } = await supabase.auth.getUser();
    const v_usuario = user?.email || "sistema";

    await supabase.from("historico").insert({
      entidade: "ordem_producao",
      entidade_id: id,
      usuario: v_usuario,
      acao: "status_alterado",
      descricao: "Ordem de Produção arquivada.",
    });
  },

  async marcarItemPreparado(
    ordemProducaoItemId: string,
    preparado: boolean
  ): Promise<ProductionOperationResult> {
    const { data, error } = await supabase.rpc("marcar_item_preparado", {
      p_ordem_producao_item_id: ordemProducaoItemId,
      p_preparado: preparado,
    });

    if (error) {
      throw new Error(`Erro ao marcar item como preparado: ${error.message}`);
    }

    const payload = data as any;
    return {
      item: payload.item as ProductionItemState,
      pedido: payload.pedido as PedidoOperationalState,
    };
  },

  async registrarProblemaItem(
    ordemProducaoItemId: string,
    problema: { possui_problema: boolean; tipo?: string; descricao?: string }
  ): Promise<ProductionOperationResult> {
    const { data, error } = await supabase.rpc("marcar_item_problema", {
      p_ordem_producao_item_id: ordemProducaoItemId,
      p_possui_problema: problema.possui_problema,
      p_tipo: (problema.tipo || null) as any,
      p_descricao: problema.descricao || "",
    });

    if (error) {
      throw new Error(`Erro ao registrar problema no item: ${error.message}`);
    }

    const payload = data as any;
    return {
      item: payload.item as ProductionItemState,
      pedido: payload.pedido as PedidoOperationalState,
    };
  },
};

export interface ProductionItemState {
  id: string;
  preparado: boolean;
  possui_problema: boolean;
  problema_tipo: string | null;
  problema_descricao: string | null;
  preparado_em: string | null;
  preparado_por: string | null;
  problema_em: string | null;
  problema_por: string | null;
}

export interface PedidoOperationalState {
  id: string;
  itens_total: number;
  itens_preparados: number;
  itens_com_problema: number;
  pedido_pronto: boolean;
}

export interface ProductionOperationResult {
  item: ProductionItemState;
  pedido: PedidoOperationalState;
}
