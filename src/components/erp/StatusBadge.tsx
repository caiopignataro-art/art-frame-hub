import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  ORCAMENTO_STATUS_LABEL,
  PEDIDO_STATUS_LABEL,
  PAGAMENTO_STATUS_LABEL,
  type OrcamentoStatus,
  type PedidoStatus,
  type PagamentoStatus,
} from "@/types/erp";

type Variant = NonNullable<BadgeProps["variant"]>;

const ORC_VARIANT: Record<OrcamentoStatus, Variant> = {
  rascunho: "secondary",
  enviado: "info",
  aprovado: "success",
  convertido: "default",
  recusado: "destructive",
  expirado: "warning",
};
const PED_VARIANT: Record<PedidoStatus, Variant> = {
  orcamento: "secondary",
  aprovado: "info",
  em_producao: "warning",
  pronto: "success",
  entregue: "default",
};
const PAG_VARIANT: Record<PagamentoStatus, Variant> = {
  pendente: "warning",
  pago: "success",
  parcial: "info",
  estornado: "destructive",
  cancelado: "destructive",
};

export const OrcamentoStatusBadge = ({ status }: { status: OrcamentoStatus }) => (
  <Badge variant={ORC_VARIANT[status]}>{ORCAMENTO_STATUS_LABEL[status]}</Badge>
);
export const PedidoStatusBadge = ({ status }: { status: PedidoStatus }) => (
  <Badge variant={PED_VARIANT[status]}>{PEDIDO_STATUS_LABEL[status]}</Badge>
);
export const PagamentoStatusBadge = ({ status }: { status: PagamentoStatus }) => (
  <Badge variant={PAG_VARIANT[status]}>{PAGAMENTO_STATUS_LABEL[status]}</Badge>
);
