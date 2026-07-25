export type OrdemProducaoStatus = "aberta" | "em_andamento" | "concluida" | "cancelada";

export const ORDEM_PRODUCAO_STATUS_LABELS: Record<OrdemProducaoStatus, string> = {
  aberta: "Em Preparação",
  em_andamento: "Em Produção",
  concluida: "Concluída",
  cancelada: "Arquivada",
} as const;

export function getOrdemProducaoStatusLabel(status: OrdemProducaoStatus): string {
  return ORDEM_PRODUCAO_STATUS_LABELS[status];
}
