export type OrdemProducaoStatus = "aberta" | "concluida" | "arquivada" | "cancelada";

export const ORDEM_PRODUCAO_STATUS_CONFIG = {
  aberta: {
    label: "Em Preparação",
    style: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900",
  },
  concluida: {
    label: "Concluída",
    style: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
  },
  arquivada: {
    label: "Arquivada",
    style: "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800",
  },
  cancelada: {
    label: "Cancelada",
    style: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
  },
} as const;

export function getOrdemProducaoStatusLabel(status: OrdemProducaoStatus): string {
  return ORDEM_PRODUCAO_STATUS_CONFIG[status]?.label ?? status;
}

export function getOrdemProducaoStatusStyle(status: OrdemProducaoStatus): string {
  return ORDEM_PRODUCAO_STATUS_CONFIG[status]?.style ?? "bg-zinc-50 text-zinc-600 border-zinc-200";
}
