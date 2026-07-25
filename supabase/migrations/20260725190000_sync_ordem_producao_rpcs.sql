-- Drop old functions with old signatures to avoid overload issues
DROP FUNCTION IF EXISTS public.criar_ordem_producao(uuid[], text, uuid);
DROP FUNCTION IF EXISTS public.criar_ordem_producao(uuid[], text);
DROP FUNCTION IF EXISTS public.remover_pedido_da_ordem_producao(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.remover_pedido_da_ordem_producao(uuid, text);

-- Also drop obsolete/hypothetical functions if any linger in the database
DROP FUNCTION IF EXISTS public.alterar_status_ordem_producao(uuid, text);
DROP FUNCTION IF EXISTS public.op_preparar_item(uuid, boolean);
DROP FUNCTION IF EXISTS public.op_registrar_problema(uuid, text, text);
DROP FUNCTION IF EXISTS public.op_resolver_problema(uuid);

-- Drop obsolete default/check constraints and alter status column to public.ordem_producao_status enum
ALTER TABLE public.ordem_producao ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.ordem_producao DROP CONSTRAINT IF EXISTS ordem_producao_status_check;
ALTER TABLE public.ordem_producao ALTER COLUMN status TYPE public.ordem_producao_status USING status::public.ordem_producao_status;
ALTER TABLE public.ordem_producao ALTER COLUMN status SET DEFAULT 'aberta'::public.ordem_producao_status;

-- 1. Re-declare criar_ordem_producao with correct frontend signature
CREATE OR REPLACE FUNCTION public.criar_ordem_producao(
  p_pedidos_ids UUID[],
  p_observacoes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op_id UUID;
  v_op_numero INT;
  v_pedido_id UUID;
  v_usuario TEXT;
  v_pedidos_numeros TEXT[];
  v_pedidos_count INT;
BEGIN
  -- 1. Validation (RPC is the sole authority)
  FOR v_pedido_id IN SELECT unnest(p_pedidos_ids)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.pedidos 
      WHERE id = v_pedido_id 
        AND status = 'aprovado' 
        AND ordem_producao_id IS NULL
    ) THEN
      RAISE EXCEPTION 'Um ou mais pedidos selecionados não estão aptos para produção. Atualize a listagem e tente novamente.';
    END IF;
  END LOOP;

  -- 2. Create the OP
  INSERT INTO public.ordem_producao (status, criado_por, observacoes)
  VALUES ('aberta'::public.ordem_producao_status, auth.uid(), p_observacoes)
  RETURNING id, numero INTO v_op_id, v_op_numero;

  -- 3. Bind orders to the OP and update status to 'em_producao'
  UPDATE public.pedidos
  SET status = 'em_producao',
      ordem_producao_id = v_op_id,
      updated_at = now()
  WHERE id = any(p_pedidos_ids);

  -- 4. Create items in ordem_producao_itens
  INSERT INTO public.ordem_producao_itens (ordem_producao_id, pedido_id, item_pedido_id)
  SELECT v_op_id, pedido_id, id
  FROM public.pedido_itens
  WHERE pedido_id = any(p_pedidos_ids);

  -- 5. Write history log
  SELECT array_agg(numero_pedido::text) INTO v_pedidos_numeros
  FROM public.pedidos
  WHERE id = any(p_pedidos_ids);
  
  v_pedidos_count := array_length(p_pedidos_ids, 1);
  v_usuario := COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    auth.uid()::text,
    'sistema'
  );

  INSERT INTO public.historico (
    entidade,
    entidade_id,
    usuario,
    acao,
    descricao,
    dados_depois
  ) VALUES (
    'ordem_producao',
    v_op_id,
    v_usuario,
    'criado'::public.historico_acao,
    'Ordem de Produção criada. Status: Aberta. Pedidos: ' || array_to_string(v_pedidos_numeros, ', ') || '. Quantidade: ' || v_pedidos_count || ' pedido(s).',
    jsonb_build_object(
      'op_id', v_op_id,
      'numero', v_op_numero,
      'pedidos_ids', p_pedidos_ids,
      'pedidos_numeros', v_pedidos_numeros,
      'quantidade', v_pedidos_count
    )
  );

  RETURN v_op_id;
END;
$$;

-- 2. Re-declare remover_pedido_da_ordem_producao with correct frontend signature
CREATE OR REPLACE FUNCTION public.remover_pedido_da_ordem_producao(
  p_pedido_id UUID,
  p_motivo TEXT
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
  v_usuario := COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    auth.uid()::text,
    'sistema'
  );

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
    'status_alterado'::public.historico_acao,
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
    'atualizado'::public.historico_acao,
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
