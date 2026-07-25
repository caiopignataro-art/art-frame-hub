-- 1. Extend historico_acao ENUM
ALTER TYPE public.historico_acao ADD VALUE IF NOT EXISTS 'PEDIDO_CONCLUIDO_PRODUCAO';
ALTER TYPE public.historico_acao ADD VALUE IF NOT EXISTS 'ORDEM_PRODUCAO_CONCLUIDA';

-- 2. Create STABLE SQL Function to obtain OP details decorated with operational flags (SECURITY INVOKER)
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
  -- Fetch OP details
  SELECT to_jsonb(o) INTO v_op
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

-- 3. Create transactional RPC function to conclude a Pedido (SECURITY DEFINER to edit status/logs)
CREATE OR REPLACE FUNCTION public.concluir_pedido_producao(
  p_pedido_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pedido RECORD;
  v_op RECORD;
  v_usuario_id UUID;
  v_usuario_email TEXT;
  v_correlation_id UUID;
  v_calc_res JSONB;
  v_pedido_pronto BOOLEAN;
  v_pedidos_restantes_abertos INT;
  v_pedidos_total INT;
  v_pedidos_concluidos INT;
  v_op_concluida BOOLEAN := false;
BEGIN
  -- Resolve operator
  v_usuario_id := auth.uid();
  SELECT email INTO v_usuario_email FROM auth.users WHERE id = v_usuario_id;
  IF v_usuario_email IS NULL THEN
    v_usuario_email := 'sistema';
  END IF;

  -- LOCK hierarchy: 1. pedidos
  SELECT * INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  -- Validate Pedido is associated with an active OP
  IF v_pedido.ordem_producao_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não está associado a nenhuma Ordem de Produção.';
  END IF;

  -- LOCK hierarchy: 2. ordem_producao
  SELECT * INTO v_op
  FROM public.ordem_producao
  WHERE id = v_pedido.ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção correspondente não encontrada.';
  END IF;

  IF v_op.status IN ('concluida', 'cancelada') THEN
    RAISE EXCEPTION 'Não é permitido concluir pedidos de uma Ordem de Produção concluída ou arquivada.';
  END IF;

  -- Idempotency Check: if already pronto, skip update and return current state
  IF v_pedido.status = 'pronto' THEN
    SELECT COUNT(1), COUNT(1) FILTER (WHERE status = 'pronto')
    INTO v_pedidos_total, v_pedidos_concluidos
    FROM public.pedidos
    WHERE ordem_producao_id = v_op.id;

    RETURN jsonb_build_object(
      'pedido', jsonb_build_object(
        'id', v_pedido.id,
        'concluido', true,
        'pedido_pronto', true
      ),
      'ordem_producao', jsonb_build_object(
        'id', v_op.id,
        'concluida', (v_op.status = 'concluida'),
        'pedidos_concluidos', v_pedidos_concluidos,
        'pedidos_total', v_pedidos_total
      )
    );
  END IF;

  -- Validate operational readiness (calcular_estado_pedido)
  v_calc_res := public.calcular_estado_pedido(p_pedido_id);
  v_pedido_pronto := (v_calc_res ->> 'pedido_pronto')::BOOLEAN;

  -- Ensure order has items (total > 0)
  IF (v_calc_res ->> 'itens_total')::INT = 0 THEN
    RAISE EXCEPTION 'O pedido não possui itens cadastrados na Ordem de Produção.';
  END IF;

  IF NOT v_pedido_pronto THEN
    RAISE EXCEPTION 'O pedido possui itens pendentes ou com problemas e não pode ser concluído.';
  END IF;

  -- Update pedido status to pronto
  UPDATE public.pedidos
  SET status = 'pronto',
      updated_at = now()
  WHERE id = p_pedido_id;

  -- Log versioned history audit
  v_correlation_id := gen_random_uuid();

  INSERT INTO public.historico (
    entidade,
    entidade_id,
    usuario,
    acao,
    descricao,
    dados_depois
  ) VALUES (
    'ordem_producao',
    v_op.id,
    v_usuario_email,
    'PEDIDO_CONCLUIDO_PRODUCAO'::public.historico_acao,
    'Pedido #' || v_pedido.numero_pedido || ' concluído na produção.',
    jsonb_build_object(
      'schema_version', 1,
      'correlation_id', v_correlation_id,
      'pedidoId', p_pedido_id,
      'ordemProducaoId', v_op.id,
      'usuarioId', v_usuario_id,
      'resultado', 'CONCLUIDO'
    )
  );

  -- Check if all associated orders are now completed ('pronto')
  SELECT COUNT(1) FILTER (WHERE status != 'pronto')
  INTO v_pedidos_restantes_abertos
  FROM public.pedidos
  WHERE ordem_producao_id = v_op.id;

  IF v_pedidos_restantes_abertos = 0 THEN
    -- Complete the OP
    UPDATE public.ordem_producao
    SET status = 'concluida',
        concluido_em = now(),
        atualizado_em = now()
    WHERE id = v_op.id;

    v_op_concluida := true;

    -- Log OP conclusion
    INSERT INTO public.historico (
      entidade,
      entidade_id,
      usuario,
      acao,
      descricao,
      dados_depois
    ) VALUES (
      'ordem_producao',
      v_op.id,
      v_usuario_email,
      'ORDEM_PRODUCAO_CONCLUIDA'::public.historico_acao,
      'Ordem de Produção concluída automaticamente após a conclusão de todos os pedidos.',
      jsonb_build_object(
        'schema_version', 1,
        'correlation_id', v_correlation_id,
        'ordemProducaoId', v_op.id,
        'usuarioId', v_usuario_id,
        'resultado', 'CONCLUIDO'
      )
    );
  END IF;

  -- Re-calculate counts
  SELECT COUNT(1), COUNT(1) FILTER (WHERE status = 'pronto')
  INTO v_pedidos_total, v_pedidos_concluidos
  FROM public.pedidos
  WHERE ordem_producao_id = v_op.id;

  RETURN jsonb_build_object(
    'pedido', jsonb_build_object(
      'id', p_pedido_id,
      'concluido', true,
      'pedido_pronto', true
    ),
    'ordem_producao', jsonb_build_object(
      'id', v_op.id,
      'concluida', v_op_concluida,
      'pedidos_concluidos', v_pedidos_concluidos,
      'pedidos_total', v_pedidos_total
    )
  );
END;
$$;

-- 4. Re-declare marcar_item_preparado to block modifications on concluded pedidos
CREATE OR REPLACE FUNCTION public.marcar_item_preparado(
  p_ordem_producao_item_id UUID,
  p_preparado BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_op RECORD;
  v_pedido RECORD;
  v_usuario_id UUID;
  v_usuario_email TEXT;
  v_correlation_id UUID;
  v_pedido_estado JSONB;
BEGIN
  v_usuario_id := auth.uid();
  SELECT email INTO v_usuario_email FROM auth.users WHERE id = v_usuario_id;
  IF v_usuario_email IS NULL THEN
    v_usuario_email := 'sistema';
  END IF;

  -- Validate item
  SELECT * INTO v_item
  FROM public.ordem_producao_itens
  WHERE id = p_ordem_producao_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da Ordem de Produção não encontrado.';
  END IF;

  -- Validate Pedido is not already concluded
  SELECT * INTO v_pedido
  FROM public.pedidos
  WHERE id = v_item.pedido_id;

  IF v_pedido.status = 'pronto' THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de um pedido concluído na produção.';
  END IF;

  -- Validate OP
  SELECT * INTO v_op
  FROM public.ordem_producao
  WHERE id = v_item.ordem_producao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção associada não encontrada.';
  END IF;

  IF v_op.status IN ('concluida', 'cancelada') THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de uma Ordem de Produção concluída ou arquivada.';
  END IF;

  -- Transition Validation
  IF v_item.preparado = p_preparado THEN
    v_pedido_estado := public.calcular_estado_pedido(v_item.pedido_id);
    RETURN jsonb_build_object(
      'item', jsonb_build_object(
        'id', v_item.id,
        'preparado', v_item.preparado,
        'possui_problema', v_item.possui_problema,
        'problema_tipo', v_item.problema_tipo,
        'problema_descricao', v_item.problema_descricao,
        'preparado_em', v_item.preparado_em,
        'preparado_por', v_item.preparado_por,
        'problema_em', v_item.problema_em,
        'problema_por', v_item.problema_por
      ),
      'pedido', v_pedido_estado
    );
  END IF;

  IF p_preparado THEN
    UPDATE public.ordem_producao_itens
    SET preparado = true,
        preparado_em = now(),
        preparado_por = v_usuario_id,
        possui_problema = false,
        problema_tipo = null,
        problema_descricao = null,
        problema_em = null,
        problema_por = null,
        atualizado_em = now()
    WHERE id = p_ordem_producao_item_id
    RETURNING * INTO v_item;
  ELSE
    UPDATE public.ordem_producao_itens
    SET preparado = false,
        preparado_em = null,
        preparado_por = null,
        atualizado_em = now()
    WHERE id = p_ordem_producao_item_id
    RETURNING * INTO v_item;
  END IF;

  v_correlation_id := gen_random_uuid();
  
  INSERT INTO public.historico (
    entidade,
    entidade_id,
    usuario,
    acao,
    descricao,
    dados_depois
  ) VALUES (
    'ordem_producao',
    v_item.ordem_producao_id,
    v_usuario_email,
    CASE WHEN p_preparado THEN 'ITEM_PREPARADO'::public.historico_acao ELSE 'ITEM_DESMARCADO'::public.historico_acao END,
    'Item ' || v_item.id || ' da OP alterado para preparado = ' || p_preparado::text,
    jsonb_build_object(
      'schema_version', 1,
      'correlation_id', v_correlation_id,
      'itemId', v_item.id,
      'pedidoId', v_item.pedido_id,
      'ordemProducaoId', v_item.ordem_producao_id,
      'preparado', p_preparado
    )
  );

  v_pedido_estado := public.calcular_estado_pedido(v_item.pedido_id);
  
  RETURN jsonb_build_object(
    'item', jsonb_build_object(
      'id', v_item.id,
      'preparado', v_item.preparado,
      'possui_problema', v_item.possui_problema,
      'problema_tipo', v_item.problema_tipo,
      'problema_descricao', v_item.problema_descricao,
      'preparado_em', v_item.preparado_em,
      'preparado_por', v_item.preparado_por,
      'problema_em', v_item.problema_em,
      'problema_por', v_item.problema_por
    ),
    'pedido', v_pedido_estado
  );
END;
$$;

-- 5. Re-declare marcar_item_problema to block modifications on concluded pedidos
CREATE OR REPLACE FUNCTION public.marcar_item_problema(
  p_ordem_producao_item_id UUID,
  p_possui_problema BOOLEAN,
  p_tipo public.problema_tipo_enum,
  p_descricao TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_op RECORD;
  v_pedido RECORD;
  v_usuario_id UUID;
  v_usuario_email TEXT;
  v_correlation_id UUID;
  v_pedido_estado JSONB;
BEGIN
  v_usuario_id := auth.uid();
  SELECT email INTO v_usuario_email FROM auth.users WHERE id = v_usuario_id;
  IF v_usuario_email IS NULL THEN
    v_usuario_email := 'sistema';
  END IF;

  -- Validate item
  SELECT * INTO v_item
  FROM public.ordem_producao_itens
  WHERE id = p_ordem_producao_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da Ordem de Produção não encontrado.';
  END IF;

  -- Validate Pedido is not already concluded
  SELECT * INTO v_pedido
  FROM public.pedidos
  WHERE id = v_item.pedido_id;

  IF v_pedido.status = 'pronto' THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de um pedido concluído na produção.';
  END IF;

  -- Validate OP
  SELECT * INTO v_op
  FROM public.ordem_producao
  WHERE id = v_item.ordem_producao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção associada não encontrada.';
  END IF;

  IF v_op.status IN ('concluida', 'cancelada') THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de uma Ordem de Produção concluída ou arquivada.';
  END IF;

  IF p_possui_problema AND p_tipo IS NULL THEN
    RAISE EXCEPTION 'O tipo do problema é obrigatório ao registrar um problema.';
  END IF;

  -- Transition Validation
  IF v_item.possui_problema = p_possui_problema AND 
     (NOT p_possui_problema OR (v_item.problema_tipo = p_tipo AND COALESCE(v_item.problema_descricao, '') = COALESCE(p_descricao, ''))) THEN
    v_pedido_estado := public.calcular_estado_pedido(v_item.pedido_id);
    RETURN jsonb_build_object(
      'item', jsonb_build_object(
        'id', v_item.id,
        'preparado', v_item.preparado,
        'possui_problema', v_item.possui_problema,
        'problema_tipo', v_item.problema_tipo,
        'problema_descricao', v_item.problema_descricao,
        'preparado_em', v_item.preparado_em,
        'preparado_por', v_item.preparado_por,
        'problema_em', v_item.problema_em,
        'problema_por', v_item.problema_por
      ),
      'pedido', v_pedido_estado
    );
  END IF;

  IF p_possui_problema THEN
    UPDATE public.ordem_producao_itens
    SET possui_problema = true,
        problema_tipo = p_tipo,
        problema_descricao = p_descricao,
        problema_em = now(),
        problema_por = v_usuario_id,
        preparado = false,
        preparado_em = null,
        preparado_por = null,
        atualizado_em = now()
    WHERE id = p_ordem_producao_item_id
    RETURNING * INTO v_item;
  ELSE
    UPDATE public.ordem_producao_itens
    SET possui_problema = false,
        problema_tipo = null,
        problema_descricao = null,
        problema_em = null,
        problema_por = null,
        atualizado_em = now()
    WHERE id = p_ordem_producao_item_id
    RETURNING * INTO v_item;
  END IF;

  v_correlation_id := gen_random_uuid();
  
  INSERT INTO public.historico (
    entidade,
    entidade_id,
    usuario,
    acao,
    descricao,
    dados_depois
  ) VALUES (
    'ordem_producao',
    v_item.ordem_producao_id,
    v_usuario_email,
    CASE WHEN p_possui_problema THEN 'ITEM_PROBLEMA_REGISTRADO'::public.historico_acao ELSE 'ITEM_PROBLEMA_REMOVIDO'::public.historico_acao END,
    'Item ' || v_item.id || ' da OP alterado para possui_problema = ' || p_possui_problema::text,
    jsonb_build_object(
      'schema_version', 1,
      'correlation_id', v_correlation_id,
      'itemId', v_item.id,
      'pedidoId', v_item.pedido_id,
      'ordemProducaoId', v_item.ordem_producao_id,
      'possui_problema', p_possui_problema,
      'problema_tipo', p_tipo
    )
  );

  v_pedido_estado := public.calcular_estado_pedido(v_item.pedido_id);
  
  RETURN jsonb_build_object(
    'item', jsonb_build_object(
      'id', v_item.id,
      'preparado', v_item.preparado,
      'possui_problema', v_item.possui_problema,
      'problema_tipo', v_item.problema_tipo,
      'problema_descricao', v_item.problema_descricao,
      'preparado_em', v_item.preparado_em,
      'preparado_por', v_item.preparado_por,
      'problema_em', v_item.problema_em,
      'problema_por', v_item.problema_por
    ),
    'pedido', v_pedido_estado
  );
END;
$$;
