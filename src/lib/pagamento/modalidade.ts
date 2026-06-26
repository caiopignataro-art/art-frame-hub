/**
 * Modalidades de pagamento exibidas no UI e mapeamento para o enum do banco.
 *
 * O banco só conhece: dinheiro, pix, cartao_credito, cartao_debito, transferencia, boleto, outro.
 * Aqui adicionamos uma camada UI: "credito_vista" e "credito_parcelado" mapeiam para
 * cartao_credito; "debito" mapeia para cartao_debito. A modalidade real e o número
 * de parcelas ficam em pedido.metadados.pagamento (snapshot).
 */
import type { FormaPagamento } from "@/types/erp";

export type ModalidadePagamento =
  | "dinheiro"
  | "pix"
  | "debito"
  | "credito_vista"
  | "credito_parcelado";

export const MODALIDADE_LABEL: Record<ModalidadePagamento, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito_vista: "Crédito à Vista",
  credito_parcelado: "Crédito Parcelado",
};

export const MODALIDADES: ModalidadePagamento[] = [
  "dinheiro",
  "pix",
  "debito",
  "credito_vista",
  "credito_parcelado",
];

/** Formas que aceitam desconto (à vista). */
export const MODALIDADES_COM_DESCONTO: ModalidadePagamento[] = [
  "dinheiro",
  "pix",
  "debito",
];

export function modalidadeToFormaPagamento(m: ModalidadePagamento): FormaPagamento {
  switch (m) {
    case "dinheiro":
      return "dinheiro";
    case "pix":
      return "pix";
    case "debito":
      return "cartao_debito";
    case "credito_vista":
    case "credito_parcelado":
      return "cartao_credito";
  }
}

/** Tenta reconstruir a modalidade a partir de metadados/forma_pagamento. */
export function inferModalidade(
  forma: FormaPagamento | null | undefined,
  meta?: { modalidade?: ModalidadePagamento; parcelas?: number } | null,
): ModalidadePagamento {
  if (meta?.modalidade) return meta.modalidade;
  switch (forma) {
    case "dinheiro":
      return "dinheiro";
    case "pix":
      return "pix";
    case "cartao_debito":
      return "debito";
    case "cartao_credito":
      return (meta?.parcelas ?? 1) > 1 ? "credito_parcelado" : "credito_vista";
    default:
      return "pix";
  }
}

export const CONFIG_KEY_MAX_PARCELAS = "pagamentos.max_parcelas";
export const DEFAULT_MAX_PARCELAS = 6;

/** Snapshot financeiro persistido em pedido.metadados.pagamento. */
export interface PagamentoSnapshot {
  modalidade: ModalidadePagamento;
  parcelas: number;
  subtotal: number;
  desconto_percentual: number;
  desconto_valor: number;
  total_final: number;
  situacao: "pago" | "sinal" | "aberto";
  valor_sinal: number;
  saldo_devedor: number;
}

export function calcularSnapshot(opts: {
  modalidade: ModalidadePagamento;
  parcelas: number;
  subtotal: number;
  descontoPct: number;
  situacao: "pago" | "sinal" | "aberto";
  valorSinal: number;
}): PagamentoSnapshot {
  const aplicaDesconto = MODALIDADES_COM_DESCONTO.includes(opts.modalidade);
  const descPct = aplicaDesconto ? Math.max(0, Math.min(100, opts.descontoPct)) : 0;
  const descVal = +(opts.subtotal * (descPct / 100)).toFixed(2);
  const total = +(opts.subtotal - descVal).toFixed(2);

  let saldo = total;
  let sinal = 0;
  if (opts.situacao === "pago") {
    saldo = 0;
  } else if (opts.situacao === "sinal") {
    sinal = Math.min(total, Math.max(0, opts.valorSinal));
    saldo = +(total - sinal).toFixed(2);
  }

  return {
    modalidade: opts.modalidade,
    parcelas: opts.modalidade === "credito_parcelado" ? Math.max(1, opts.parcelas) : 1,
    subtotal: opts.subtotal,
    desconto_percentual: descPct,
    desconto_valor: descVal,
    total_final: total,
    situacao: opts.situacao,
    valor_sinal: sinal,
    saldo_devedor: saldo,
  };
}
