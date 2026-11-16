import type { NotificacaoWhatsapp, NotificacaoWhatsappInsert, WhatsappEvento } from "@/types/erp";

export interface WhatsappRepository {
  list(opts?: { status?: string; limit?: number }): Promise<NotificacaoWhatsapp[]>;
  listByPedido(pedidoId: string): Promise<NotificacaoWhatsapp[]>;
  enfileirar(input: NotificacaoWhatsappInsert): Promise<NotificacaoWhatsapp>;
  dispararEvento(params: {
    pedidoId?: string | null;
    clienteId?: string | null;
    evento: WhatsappEvento;
    destinatario?: string | null;
    mensagem: string;
    payload?: Record<string, unknown>;
  }): Promise<NotificacaoWhatsapp>;
  marcarEnviado(id: string): Promise<void>;
  marcarFalha(id: string, erro: string): Promise<void>;
}
