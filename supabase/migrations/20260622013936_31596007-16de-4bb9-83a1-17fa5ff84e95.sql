
-- Adicionar novos status ao fluxo de produção
ALTER TYPE public.pedido_status ADD VALUE IF NOT EXISTS 'montagem';
ALTER TYPE public.pedido_status ADD VALUE IF NOT EXISTS 'controle_qualidade';

-- Tabela de fila de notificações WhatsApp (arquitetura preparada)
CREATE TABLE IF NOT EXISTS public.notificacoes_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  evento TEXT NOT NULL CHECK (evento IN ('pedido_aprovado','pedido_pronto','pedido_entregue','orcamento_enviado','pagamento_recebido')),
  destinatario TEXT,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','falha','cancelado')),
  tentativas INTEGER NOT NULL DEFAULT 0,
  erro TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes_whatsapp TO anon, authenticated;
GRANT ALL ON public.notificacoes_whatsapp TO service_role;

ALTER TABLE public.notificacoes_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_open_all" ON public.notificacoes_whatsapp FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notif_whatsapp_status ON public.notificacoes_whatsapp(status);
CREATE INDEX IF NOT EXISTS idx_notif_whatsapp_pedido ON public.notificacoes_whatsapp(pedido_id);

CREATE TRIGGER trg_notif_whatsapp_updated_at
BEFORE UPDATE ON public.notificacoes_whatsapp
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Trigger automático: ao mudar status do pedido, enfileirar notificação
CREATE OR REPLACE FUNCTION public.tg_pedido_whatsapp_eventos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento TEXT;
  v_msg TEXT;
  v_telefone TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'aguardando_producao' AND OLD.status NOT IN ('aguardando_producao','em_producao','montagem','controle_qualidade','pronto','entregue') THEN
    v_evento := 'pedido_aprovado';
    v_msg := 'Olá! Seu pedido #' || NEW.numero_pedido || ' foi aprovado e entrou na fila de produção.';
  ELSIF NEW.status = 'pronto' THEN
    v_evento := 'pedido_pronto';
    v_msg := 'Boa notícia! Seu pedido #' || NEW.numero_pedido || ' está pronto para retirada.';
  ELSIF NEW.status = 'entregue' THEN
    v_evento := 'pedido_entregue';
    v_msg := 'Obrigado pela preferência! Confirmamos a entrega do pedido #' || NEW.numero_pedido || '.';
  ELSE
    RETURN NEW;
  END IF;

  SELECT COALESCE(c.whatsapp, c.telefone) INTO v_telefone
  FROM public.clientes c WHERE c.id = NEW.cliente_id;

  INSERT INTO public.notificacoes_whatsapp (pedido_id, cliente_id, evento, destinatario, mensagem, payload)
  VALUES (NEW.id, NEW.cliente_id, v_evento, v_telefone, v_msg,
    jsonb_build_object('numero_pedido', NEW.numero_pedido, 'status', NEW.status));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedidos_whatsapp ON public.pedidos;
CREATE TRIGGER trg_pedidos_whatsapp
AFTER UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.tg_pedido_whatsapp_eventos();
