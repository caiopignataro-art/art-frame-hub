import { QueryClient } from "@tanstack/react-query";

// Centralização de chaves de consulta da Produção
export const productionKeys = {
  pedidos: ["pedidos"] as const,
  ordens: ["ordens_producao"] as const,
  ordem: (id: string) => ["ordem_producao", id] as const,
};

// Centralizador de invalidações puras do módulo de Produção
export const productionCache = {
  invalidateAfterOPCreated(qc: QueryClient) {
    qc.invalidateQueries({ queryKey: productionKeys.pedidos });
    qc.invalidateQueries({ queryKey: productionKeys.ordens });
  },
  invalidateAfterPedidoStatusChanged(qc: QueryClient) {
    qc.invalidateQueries({ queryKey: productionKeys.pedidos });
  },
  invalidateAfterOPStatusChanged(qc: QueryClient, opId: string) {
    qc.invalidateQueries({ queryKey: productionKeys.ordem(opId) });
    qc.invalidateQueries({ queryKey: productionKeys.ordens });
  },
  invalidateAfterPedidoCompleted(qc: QueryClient, opId: string) {
    qc.invalidateQueries({ queryKey: productionKeys.pedidos });
    qc.invalidateQueries({ queryKey: productionKeys.ordem(opId) });
    qc.invalidateQueries({ queryKey: productionKeys.ordens });
  },
  invalidateAfterItemUpdated(qc: QueryClient, opId: string) {
    qc.invalidateQueries({ queryKey: productionKeys.ordem(opId) });
    qc.invalidateQueries({ queryKey: productionKeys.ordens });
  },
  invalidateAfterPedidoRemoved(qc: QueryClient, opId: string) {
    qc.invalidateQueries({ queryKey: productionKeys.pedidos });
    qc.invalidateQueries({ queryKey: productionKeys.ordens });
    qc.invalidateQueries({ queryKey: productionKeys.ordem(opId) });
  }
};
