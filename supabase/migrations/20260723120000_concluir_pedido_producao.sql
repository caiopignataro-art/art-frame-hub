-- 1. Extend historico_acao ENUM
ALTER TYPE public.historico_acao ADD VALUE IF NOT EXISTS 'PEDIDO_CONCLUIDO_PRODUCAO';
ALTER TYPE public.historico_acao ADD VALUE IF NOT EXISTS 'ORDEM_PRODUCAO_CONCLUIDA';

-- 2. Create obtaining details RPC function with backend evaluation of pedido_pronto and pedido_concluido
CREATE OR REPLACE FUNCTION public.obter_detalhe_ordem_producao(p_ordem_producao_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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
  -- 1. Fetch OP
  SELECT to_jsonb(o) INTO v_op
  FROM public.ordem_producao o
  WHERE id = p_ordem_producao_id;

  IF v_op IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Fetch Pedidos, decorating each with backend-evaluated variables
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
      'pedido_pronto', (SELECT (public.calcular_estado_pedido(p.id) ->> 'pedido_pronto')::BOOLEAN),
      'pedido_concluido', (p.status = 'pronto')
    )
  ) INTO v_pedidos
  FROM public.pedidos p
  LEFT JOIN public.clientes c ON p.cliente_id = c.id
  WHERE p.ordem_producao_id = p_ordem_producao_id;

  -- 3. Fetch opItens
  SELECT jsonb_agg(to_jsonb(oi)) INTO v_op_itens
  FROM public.ordem_producao_itens oi
  WHERE oi.ordem_producao_id = p_ordem_producao_id;

  -- 4. Fetch historico
  SELECT jsonb_agg(to_jsonb(h)) INTO v_historico
  FROM (
    SELECT *
    FROM public.historico
    WHERE entidade = 'ordem_producao' AND entidade_id = p_ordem_producao_id
    ORDER BY created_at ASC
  ) h;

  -- 5. Calculate global aggregates
  SELECT COALESCE(COUNT(1), 0), COALESCE(SUM((it.metadados->'quantidade')::text::int), 0)
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

-- 3. Transactional RPC for concluding a pedido in production
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
  v_estado_pedido JSONB;
  v_pedidos_restantes INT;
  v_pedidos_total INT;
  v_op_concluida BOOLEAN := false;
BEGIN
  -- Resolve operator
  v_usuario_id := auth.uid();
  SELECT email INTO v_usuario_email FROM auth.users WHERE id = v_usuario_id;
  IF v_usuario_email IS NULL THEN
    v_usuario_email := 'sistema';
  END IF;

  -- Lock and fetch Pedido
  SELECT * INTO v_pedido
  FROM public.pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  IF v_pedido.ordem_producao_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não está associado a nenhuma Ordem de Produção.';
  END IF;

  -- Lock and fetch OP
  SELECT * INTO v_op
  FROM public.ordem_producao
  WHERE id = v_pedido.ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção associada não encontrada.';
  END IF;

  -- Idempotency check: if status is already pronto, return immediately
  IF v_pedido.status = 'pronto' THEN
    SELECT COUNT(1), COUNT(1) FILTER (WHERE status = 'pronto')
    INTO v_pedidos_total, v_pedidos_restantes
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
        'concluida', (v_op.status = 'Concluída'),
        'pedidos_concluidos', v_pedidos_restantes,
        'pedidos_total', v_pedidos_total
      )
    );
  END IF;

  IF v_op.status IN ('Concluída', 'Arquivada') THEN
    RAISE EXCEPTION 'Não é permitido concluir pedidos de uma Ordem de Produção concluída ou arquivada.';
  END IF;

  -- Validate operational readiness via calcular_estado_pedido()
  v_estado_pedido := public.calcular_estado_pedido(p_pedido_id);
  IF NOT (v_estado_pedido ->> 'pedido_pronto')::BOOLEAN THEN
    RAISE EXCEPTION 'Pedido não está pronto para conclusão (existem itens pendentes ou com problemas).';
  END IF;

  -- Update status of Pedido
  UPDATE public.pedidos
  SET status = 'pronto',
      atualizado_em = now()
  WHERE id = p_pedido_id;

  -- Write structured log for pedido conclusion
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

  -- Check if all pedidos associated with this OP are now completed (status = 'pronto')
  SELECT COUNT(1), COUNT(1) FILTER (WHERE status = 'pronto')
  INTO v_pedidos_total, v_pedidos_restantes
  FROM public.pedidos
  WHERE ordem_producao_id = v_op.id;

  IF v_pedidos_total > 0 AND v_pedidos_restantes = v_pedidos_total THEN
    -- Conclude the OP automatically
    UPDATE public.ordem_producao
    SET status = 'Concluída',
        concluido_em = now(),
        atualizado_em = now()
    WHERE id = v_op.id;

    v_op_concluida := true;

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
      'Ordem de Produção concluída automaticamente após conclusão de todos os pedidos.',
      jsonb_build_object(
        'schema_version', 1,
        'correlation_id', v_correlation_id,
        'ordemProducaoId', v_op.id,
        'usuarioId', v_usuario_id,
        'resultado', 'CONCLUIDO'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'pedido', jsonb_build_object(
      'id', p_pedido_id,
      'concluido', true,
      'pedido_pronto', true
    ),
    'ordem_producao', jsonb_build_object(
      'id', v_op.id,
      'concluida', v_op_concluida,
      'pedidos_concluidos', v_pedidos_restantes,
      'pedidos_total', v_pedidos_total
    )
  );
END;
$$;

-- 4. Override marcar_item_preparado with check for completed orders
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
  v_usuario_id UUID;
  v_usuario_email TEXT;
  v_correlation_id UUID;
  v_pedido_estado JSONB;
  v_pedido_status TEXT;
BEGIN
  v_usuario_id := auth.uid();
  SELECT email INTO v_usuario_email FROM auth.users WHERE id = v_usuario_id;
  IF v_usuario_email IS NULL THEN
    v_usuario_email := 'sistema';
  END IF;

  -- Validate item existence
  SELECT * INTO v_item
  FROM public.ordem_producao_itens
  WHERE id = p_ordem_producao_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da Ordem de Produção não encontrado.';
  END IF;

  -- BLOCK edits if associated pedido is already pronto (concluded) (Correção 5)
  SELECT status INTO v_pedido_status FROM public.pedidos WHERE id = v_item.pedido_id;
  IF v_pedido_status = 'pronto' THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de um pedido concluído na produção.';
  END IF;

  -- Validate OP existence and status
  SELECT * INTO v_op
  FROM public.ordem_producao
  WHERE id = v_item.ordem_producao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção associada não encontrada.';
  END IF;

  IF v_op.status IN ('Concluída', 'Arquivada') THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de uma Ordem de Produção concluída ou arquivada.';
  END IF;

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

-- 5. Override marcar_item_problema with check for completed orders
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
  v_usuario_id UUID;
  v_usuario_email TEXT;
  v_correlation_id UUID;
  v_pedido_estado JSONB;
  v_pedido_status TEXT;
BEGIN
  v_usuario_id := auth.uid();
  SELECT email INTO v_usuario_email FROM auth.users WHERE id = v_usuario_id;
  IF v_usuario_email IS NULL THEN
    v_usuario_email := 'sistema';
  END IF;

  -- Validate item existence
  SELECT * INTO v_item
  FROM public.ordem_producao_itens
  WHERE id = p_ordem_producao_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da Ordem de Produção não encontrado.';
  END IF;

  -- BLOCK edits if associated pedido is already pronto (concluded) (Correção 5)
  SELECT status INTO v_pedido_status FROM public.pedidos WHERE id = v_item.pedido_id;
  IF v_pedido_status = 'pronto' THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de um pedido concluído na produção.';
  END IF;

  -- Validate OP existence and status
  SELECT * INTO v_op
  FROM public.ordem_producao
  WHERE id = v_item.ordem_producao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção associada não encontrada.';
  END IF;

  IF v_op.status IN ('Concluída', 'Arquivada') THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de uma Ordem de Produção concluída ou arquivada.';
  END IF;

  IF p_possui_problema AND p_tipo IS NULL THEN
    RAISE EXCEPTION 'O tipo do problema é obrigatório ao registrar um problema.';
  END IF;

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
