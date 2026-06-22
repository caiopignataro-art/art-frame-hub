
-- 1) Novos valores de enum (não podem ser usados como dado na mesma transação,
--    mas podem ser referenciados em triggers como texto)
ALTER TYPE public.pedido_status ADD VALUE IF NOT EXISTS 'orcamento' BEFORE 'aguardando_producao';
ALTER TYPE public.pedido_status ADD VALUE IF NOT EXISTS 'aguardando_aprovacao' BEFORE 'aguardando_producao';
ALTER TYPE public.pedido_status ADD VALUE IF NOT EXISTS 'aprovado' BEFORE 'aguardando_producao';

-- 2) Novos campos em pedidos
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS data_pedido timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS forma_pagamento public.forma_pagamento,
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS whatsapp_enviado boolean NOT NULL DEFAULT false;

-- 3) Atualiza trigger de estoque: também reserva ao virar 'aprovado'
CREATE OR REPLACE FUNCTION public.tg_pedidos_estoque()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text IN ('aprovado','aguardando_producao','em_producao','montagem','controle_qualidade') THEN
      PERFORM public.processar_reserva_pedido(NEW.id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status::text IN ('aprovado','aguardando_producao')
         AND OLD.status::text NOT IN ('aprovado','aguardando_producao','em_producao','montagem','controle_qualidade','pronto','entregue') THEN
        PERFORM public.processar_reserva_pedido(NEW.id);
      ELSIF NEW.status::text = 'cancelado' THEN
        PERFORM public.estornar_reservas_pedido(NEW.id);
        UPDATE public.ordens_producao SET status='cancelada' WHERE pedido_id = NEW.id AND status <> 'concluida';
      ELSIF NEW.status::text IN ('pronto','entregue') AND OLD.status::text NOT IN ('pronto','entregue') THEN
        PERFORM public.consumir_reservas_pedido(NEW.id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END; $function$;

-- 4) Atualiza trigger de WhatsApp: dispara em aguardando_aprovacao e aprovado
CREATE OR REPLACE FUNCTION public.tg_pedido_whatsapp_eventos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_evento TEXT;
  v_msg TEXT;
  v_telefone TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' THEN RETURN NEW; END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF NEW.status::text = 'aguardando_aprovacao' THEN
    v_evento := 'orcamento_enviado';
    v_msg := 'Seu orçamento #' || NEW.numero_pedido || ' está pronto para aprovação.';
  ELSIF NEW.status::text = 'aprovado' THEN
    v_evento := 'pedido_aprovado';
    v_msg := 'Recebemos a aprovação do seu pedido #' || NEW.numero_pedido || '. Ele entrará em produção em breve.';
  ELSIF NEW.status::text = 'aguardando_producao' AND OLD.status::text NOT IN ('aguardando_producao','em_producao','montagem','controle_qualidade','pronto','entregue') THEN
    v_evento := 'pedido_aprovado';
    v_msg := 'Olá! Seu pedido #' || NEW.numero_pedido || ' entrou na fila de produção.';
  ELSIF NEW.status::text = 'pronto' THEN
    v_evento := 'pedido_pronto';
    v_msg := 'Boa notícia! Seu pedido #' || NEW.numero_pedido || ' está pronto para retirada.';
  ELSIF NEW.status::text = 'entregue' THEN
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
$function$;
