-- 1. Add 'arquivada' to public.ordem_producao_status enum
ALTER TYPE public.ordem_producao_status ADD VALUE IF NOT EXISTS 'arquivada';

-- 2. Migrate existing 'cancelada' OPs (which previously represented "Arquivada" in UI) to 'arquivada'
UPDATE public.ordem_producao
SET status = 'arquivada'::public.ordem_producao_status
WHERE status = 'cancelada'::public.ordem_producao_status;

-- 3. Create or replace the view public.v_ordens_producao
CREATE OR REPLACE VIEW public.v_ordens_producao AS
SELECT 
  op.id,
  op.numero,
  op.status,
  op.criado_em,
  op.atualizado_em,
  op.concluido_em,
  op.criado_por,
  op.observacoes,
  (
    SELECT COUNT(1) 
    FROM public.pedidos p 
    WHERE p.ordem_producao_id = op.id
  ) as qtd_pedidos,
  (
    SELECT MIN(p.data_entrega_prevista) 
    FROM public.pedidos p 
    WHERE p.ordem_producao_id = op.id
  ) as para_dia
FROM public.ordem_producao op;

-- 4. Create public.cancelar_ordem_producao RPC (Transactional, Idempotent, FOR UPDATE)
CREATE OR REPLACE FUNCTION public.cancelar_ordem_producao(
  p_ordem_producao_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario TEXT;
  v_op RECORD;
  v_pedido_id UUID;
  v_pedido_numero INT;
  v_pedidos_numeros TEXT[];
BEGIN
  -- Acquire lock on the OP row to prevent concurrent modification
  SELECT * INTO v_op
  FROM public.ordem_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada.';
  END IF;

  -- Idempotency check: if already cancelled, do nothing
  IF v_op.status = 'cancelada'::public.ordem_producao_status THEN
    RETURN;
  END IF;

  -- 1. Get associated pedidos
  SELECT array_agg(numero_pedido::text)
  INTO v_pedidos_numeros
  FROM public.pedidos
  WHERE ordem_producao_id = p_ordem_producao_id;

  -- 2. Update OP status to 'cancelada'
  UPDATE public.ordem_producao
  SET status = 'cancelada'::public.ordem_producao_status,
      atualizado_em = now()
  WHERE id = p_ordem_producao_id;

  -- 3. Write logs and disassociate each bound pedido
  v_usuario := COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    auth.uid()::text,
    'sistema'
  );

  FOR v_pedido_id, v_pedido_numero IN 
    SELECT id, numero_pedido 
    FROM public.pedidos 
    WHERE ordem_producao_id = p_ordem_producao_id
  LOOP
    -- Set status back to 'aprovado' and clear the binding
    UPDATE public.pedidos
    SET status = 'aprovado',
        ordem_producao_id = NULL,
        updated_at = now()
    WHERE id = v_pedido_id;

    -- Write history for the individual pedido
    INSERT INTO public.historico (
      entidade,
      entidade_id,
      usuario,
      acao,
      descricao
    ) VALUES (
      'pedidos',
      v_pedido_id,
      v_usuario,
      'status_alterado'::public.historico_acao,
      'Pedido #' || v_pedido_numero || ' retornado para Aprovado (OP-' || lpad(v_op.numero::text, 6, '0') || ' cancelada).'
    );
  END LOOP;

  -- 4. Delete operational items from the OP items list
  DELETE FROM public.ordem_producao_itens
  WHERE ordem_producao_id = p_ordem_producao_id;

  -- 5. Write history log on the OP itself
  INSERT INTO public.historico (
    entidade,
    entidade_id,
    usuario,
    acao,
    descricao,
    dados_depois
  ) VALUES (
    'ordem_producao',
    p_ordem_producao_id,
    v_usuario,
    'status_alterado'::public.historico_acao,
    'Ordem de Produção cancelada. Pedidos desvinculados: ' || COALESCE(array_to_string(v_pedidos_numeros, ', '), 'nenhum'),
    jsonb_build_object(
      'op_id', p_ordem_producao_id,
      'status', 'cancelada',
      'pedidos_desvinculados', v_pedidos_numeros
    )
  );

END;
$$;

-- 5. Update public.obter_detalhe_ordem_producao to return para_dia
CREATE OR REPLACE FUNCTION public.obter_detalhe_ordem_producao(p_ordem_producao_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_op JSONB;
  v_pedidos JSONB;
  v_op_itens JSONB;
  v_historico JSONB;
  v_total_itens INT;
  v_total_qtd INT;
BEGIN
  -- Fetch OP details, appending para_dia
  SELECT to_jsonb(o) || jsonb_build_object('para_dia', (
    SELECT MIN(p.data_entrega_prevista)
    FROM public.pedidos p
    WHERE p.ordem_producao_id = o.id
  )) INTO v_op
  FROM public.ordem_producao o
  WHERE id = p_ordem_producao_id;

  IF v_op IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fetch associated Pedidos (decorating each with derived flags)
  SELECT jsonb_agg(
    to_jsonb(p) || jsonb_build_object(
      'cliente', to_jsonb(c),
      'itens', (
        SELECT jsonb_agg(to_jsonb(it))
        FROM public.pedido_itens it
        WHERE it.pedido_id = p.id
      ),
      'pagamentos', COALESCE((
        SELECT jsonb_agg(to_jsonb(pag))
        FROM public.pagamentos pag
        WHERE pag.pedido_id = p.id
      ), '[]'::jsonb),
      -- Derived state (all items prepared, none have problems, total > 0)
      'pedido_pronto', (SELECT (public.calcular_estado_pedido(p.id) ->> 'pedido_pronto')::BOOLEAN),
      -- Persisted state (status is 'pronto')
      'pedido_concluido', (p.status = 'pronto')
    )
  ) INTO v_pedidos
  FROM public.pedidos p
  LEFT JOIN public.clientes c ON p.cliente_id = c.id
  WHERE p.ordem_producao_id = p_ordem_producao_id;

  -- Fetch item tracking statuses
  SELECT jsonb_agg(to_jsonb(oi)) INTO v_op_itens
  FROM public.ordem_producao_itens oi
  WHERE oi.ordem_producao_id = p_ordem_producao_id;

  -- Fetch chronological history
  SELECT jsonb_agg(to_jsonb(h)) INTO v_historico
  FROM (
    SELECT *
    FROM public.historico
    WHERE entidade = 'ordem_producao' AND entidade_id = p_ordem_producao_id
    ORDER BY created_at ASC
  ) h;

  -- Calculate global aggregates
  SELECT COALESCE(COUNT(1), 0), COALESCE(SUM((it.metadados->>'quantidade')::INT), 0)
  INTO v_total_itens, v_total_qtd
  FROM public.ordem_producao_itens oi
  JOIN public.pedido_itens it ON oi.item_pedido_id = it.id
  WHERE oi.ordem_producao_id = p_ordem_producao_id;

  RETURN jsonb_build_object(
    'op', v_op,
    'pedidos', COALESCE(v_pedidos, '[]'::jsonb),
    'opItens', COALESCE(v_op_itens, '[]'::jsonb),
    'itensCount', v_total_itens,
    'quantidadesCount', v_total_qtd,
    'historico', COALESCE(v_historico, '[]'::jsonb)
  );
END;
$$;
