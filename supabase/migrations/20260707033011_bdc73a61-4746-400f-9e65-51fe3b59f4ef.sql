
CREATE OR REPLACE FUNCTION public.tg_validar_status_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tem_pagamento boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.pagamentos
    WHERE pedido_id = NEW.id
      AND COALESCE(valor,0) > 0
      AND status NOT IN ('estornado','cancelado')
  ) INTO v_tem_pagamento;

  IF NEW.status = 'orcamento' AND v_tem_pagamento THEN
    RAISE EXCEPTION 'Pedidos em Orçamento não podem possuir pagamento registrado.';
  END IF;

  IF NEW.status = 'aprovado' THEN
    IF NEW.forma_pagamento IS NULL THEN
      RAISE EXCEPTION 'Pedidos Aprovados exigem forma de pagamento selecionada.';
    END IF;
    IF NOT v_tem_pagamento THEN
      RAISE EXCEPTION 'Pedidos Aprovados exigem Sinal (>0) ou marcação como Pago.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pedidos_validar_status ON public.pedidos;
CREATE TRIGGER pedidos_validar_status
  AFTER INSERT OR UPDATE OF status, forma_pagamento ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.tg_validar_status_pedido();
