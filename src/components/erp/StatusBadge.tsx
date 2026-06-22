import { Badge } from "@/components/ui/badge";
import {
  ORCAMENTO_STATUS_LABEL,
  PEDIDO_STATUS_LABEL,
  PAGAMENTO_STATUS_LABEL,
  type OrcamentoStatus,
  type PedidoStatus,
  type PagamentoStatus,
} from "@/types/erp";

const ORC_VARIANT: Record<OrcamentoStatus, "default" | "secondary" | "outline" | "destructive"> = {
  rascunho: "secondary",
  enviado: "outline",
  aprovado: "default",
  convertido: "default",
  recusado: "destructive",
  expirado: "destructive",
};
const PED_VARIANT: Record<PedidoStatus, "default" | "secondary" | "outline" | "destructive"> = {
  orcamento: "secondary",
  aguardando_aprovacao: "outline",
  aprovado: "default",
  aguardando_producao: "secondary",
  em_producao: "outline",
  montagem: "outline",
  controle_qualidade: "outline",
  pronto: "default",
  entregue: "default",
  cancelado: "destructive",
};
const PAG_VARIANT: Record<PagamentoStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pendente: "secondary",
  pago: "default",
  parcial: "outline",
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
