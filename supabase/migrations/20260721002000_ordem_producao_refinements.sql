-- 1. Custom trigger function for updating 'atualizado_em' (Portuguese name)
CREATE OR REPLACE FUNCTION public.tg_set_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

-- Apply triggers to ordem_producao and ordem_producao_itens
DROP TRIGGER IF EXISTS trg_ordem_producao_updated_at ON public.ordem_producao;
CREATE TRIGGER trg_ordem_producao_updated_at
  BEFORE UPDATE ON public.ordem_producao
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

DROP TRIGGER IF EXISTS trg_ordem_producao_itens_updated_at ON public.ordem_producao_itens;
CREATE TRIGGER trg_ordem_producao_itens_updated_at
  BEFORE UPDATE ON public.ordem_producao_itens
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_atualizado_em();

-- 2. Update RPC remover_pedido_da_ordem_producao to return JSONB payload
CREATE OR REPLACE FUNCTION public.remover_pedido_da_ordem_producao(
  p_pedido_id UUID,
  p_motivo TEXT,
  p_usuario_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op_id UUID;
  v_op_numero INT;
  v_pedido_numero INT;
  v_usuario TEXT;
  v_op_ficou_vazia BOOLEAN;
  v_pedidos_restantes INT;
BEGIN
  -- 1. Locate the order and its OP
  SELECT ordem_producao_id, numero_pedido
  INTO v_op_id, v_pedido_numero
  FROM public.pedidos
  WHERE id = p_pedido_id;

  IF v_op_id IS NULL THEN
    RAISE EXCEPTION 'O pedido informado não está associado a nenhuma Ordem de Produção.';
  END IF;

  SELECT numero INTO v_op_numero
  FROM public.ordem_producao
  WHERE id = v_op_id;

  -- 2. Remove the relation and set status back to 'aprovado'
  UPDATE public.pedidos
  SET status = 'aprovado',
      ordem_producao_id = NULL,
      updated_at = now()
  WHERE id = p_pedido_id;

  -- 3. Invalidate active appointments for this order (while preserving the history)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name = 'apontamentos'
  ) THEN
    EXECUTE 'UPDATE public.apontamentos SET status = ''invalido'', updated_at = now() WHERE pedido_id = $1 AND status = ''ativo''' USING p_pedido_id;
  END IF;

  -- Remove items of this order from the OP items list
  DELETE FROM public.ordem_producao_itens
  WHERE pedido_id = p_pedido_id AND ordem_producao_id = v_op_id;

  -- 4. Write logs to history
  v_usuario := COALESCE(current_setting('request.jwt.claim.email', true), 'sistema');

  -- Log on the order (pedido)
  INSERT INTO public.historico (
    entidade,
    entidade_id,
    usuario,
    acao,
    descricao
  ) VALUES (
    'pedidos',
    p_pedido_id,
    v_usuario,
    'status_alterado',
    'Pedido #' || v_pedido_numero || ' removido da OP-' || lpad(v_op_numero::text, 6, '0') || ' por motivo: ' || p_motivo
  );

  -- Log on the OP
  INSERT INTO public.historico (
    entidade,
    entidade_id,
    usuario,
    acao,
    descricao
  ) VALUES (
    'ordem_producao',
    v_op_id,
    v_usuario,
    'atualizado',
    'Pedido #' || v_pedido_numero || ' removido da OP. Motivo: ' || p_motivo
  );

  -- 5. Calculate if OP is empty and count remaining active orders
  SELECT COUNT(1) INTO v_pedidos_restantes
  FROM public.pedidos
  WHERE ordem_producao_id = v_op_id AND status = 'em_producao';

  IF v_pedidos_restantes = 0 THEN
    v_op_ficou_vazia := TRUE;
  ELSE
    v_op_ficou_vazia := FALSE;
  END IF;

  RETURN jsonb_build_object(
    'ordem_producao_id', v_op_id,
    'op_ficou_vazia', v_op_ficou_vazia,
    'pedidos_restantes', v_pedidos_restantes
  );
END;
$$;
