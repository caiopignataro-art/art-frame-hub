-- 1. Create table public.ordem_producao_item_componentes
CREATE TABLE IF NOT EXISTS public.ordem_producao_item_componentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_item_id UUID NOT NULL REFERENCES public.ordem_producao_itens(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('MOLDURA', 'VIDRO', 'FUNDO', 'PASSEPARTOUT', 'CHASSI', 'IMPRESSAO')),
  descricao TEXT NOT NULL,
  ordem SMALLINT NOT NULL,
  preparado BOOLEAN NOT NULL DEFAULT false,
  preparado_em TIMESTAMPTZ NULL,
  preparado_por UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ordem_producao_item_id, tipo)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_op_comp_item_id ON public.ordem_producao_item_componentes(ordem_producao_item_id);
CREATE INDEX IF NOT EXISTS idx_op_comp_preparado ON public.ordem_producao_item_componentes(preparado);

-- 2. Update public.criar_ordem_producao RPC to insert components deterministically
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
  v_pi RECORD;
  v_material JSONB;
  v_comp_tipo TEXT;
  v_comp_desc TEXT;
  v_comp_ordem SMALLINT;
  v_op_item_id UUID;
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

  -- 2. Validate metadata of all items before inserting anything
  FOR v_pi IN 
    SELECT pi.id, pi.pedido_id, pi.metadados 
    FROM public.pedido_itens pi 
    WHERE pi.pedido_id = any(p_pedidos_ids)
  LOOP
    IF v_pi.metadados IS NULL OR NOT (v_pi.metadados ? 'calculo') OR NOT (v_pi.metadados->'calculo' ? 'materiais') OR NOT (jsonb_typeof(v_pi.metadados->'calculo'->'materiais') = 'array') THEN
      RAISE EXCEPTION 'Erro de inconsistência: O item % do pedido % não possui metadados de materiais válidos para produção.', v_pi.id, v_pi.pedido_id;
    END IF;
  END LOOP;

  -- 3. Create the OP
  INSERT INTO public.ordem_producao (status, criado_por, observacoes)
  VALUES ('aberta'::public.ordem_producao_status, auth.uid(), p_observacoes)
  RETURNING id, numero INTO v_op_id, v_op_numero;

  -- 4. Bind orders to the OP and update status to 'em_producao'
  UPDATE public.pedidos
  SET status = 'em_producao',
      ordem_producao_id = v_op_id,
      updated_at = now()
  WHERE id = any(p_pedidos_ids);

  -- 5. Create items in ordem_producao_itens and parse components in the same transaction
  FOR v_pi IN 
    SELECT pi.id, pi.pedido_id, pi.metadados 
    FROM public.pedido_itens pi 
    WHERE pi.pedido_id = any(p_pedidos_ids)
  LOOP
    -- Insert into items
    INSERT INTO public.ordem_producao_itens (ordem_producao_id, pedido_id, item_pedido_id, preparado)
    VALUES (v_op_id, v_pi.pedido_id, v_pi.id, false)
    RETURNING id INTO v_op_item_id;

    -- Extract components from materials array deterministically
    v_comp_ordem := 1;
    FOR v_material IN SELECT * FROM jsonb_array_elements(v_pi.metadados->'calculo'->'materiais')
    LOOP
      v_comp_tipo := CASE v_material->>'origem'
        WHEN 'perfil_moldura' THEN 'MOLDURA'
        WHEN 'protecao_frontal' THEN 'VIDRO'
        WHEN 'fundo' THEN 'FUNDO'
        WHEN 'passe_partout' THEN 'PASSEPARTOUT'
        WHEN 'chassi' THEN 'CHASSI'
        WHEN 'impressao' THEN 'IMPRESSAO'
        ELSE NULL
      END;

      IF v_comp_tipo IS NOT NULL THEN
        v_comp_desc := v_material->>'descricao';
        
        -- Insert component, avoiding duplicates via constraint or ON CONFLICT DO NOTHING
        INSERT INTO public.ordem_producao_item_componentes (
          ordem_producao_item_id,
          tipo,
          descricao,
          ordem,
          preparado
        ) VALUES (
          v_op_item_id,
          v_comp_tipo,
          v_comp_desc,
          v_comp_ordem,
          false
        ) ON CONFLICT (ordem_producao_item_id, tipo) DO NOTHING;
        
        v_comp_ordem := v_comp_ordem + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- 6. Write history log
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
    'Ordem de Produção criada com ' || v_pedidos_count::text || ' pedido(s) vinculados: #' || array_to_string(v_pedidos_numeros, ', #'),
    jsonb_build_object(
      'op_id', v_op_id,
      'numero', v_op_numero,
      'pedidos_ids', p_pedidos_ids,
      'observacoes', p_observacoes
    )
  );

  RETURN v_op_id;
END;
$$;

-- 3. Create public.rpc_marcar_componente_preparado RPC
CREATE OR REPLACE FUNCTION public.rpc_marcar_componente_preparado(
  p_componente_id UUID,
  p_preparado BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_componente RECORD;
  v_item RECORD;
  v_op RECORD;
  v_pedido_estado JSONB;
  v_usuario_id UUID;
  v_usuario_email TEXT;
  v_correlation_id UUID;
  v_historico_descricao TEXT;
BEGIN
  v_usuario_id := auth.uid();
  SELECT email INTO v_usuario_email FROM auth.users WHERE id = v_usuario_id;
  IF v_usuario_email IS NULL THEN
    v_usuario_email := 'sistema';
  END IF;

  -- Validate component and Lock
  SELECT * INTO v_componente
  FROM public.ordem_producao_item_componentes
  WHERE id = p_componente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Componente da Ordem de Produção não encontrado.';
  END IF;

  -- Idempotency check: return immediately if state has not changed
  IF v_componente.preparado = p_preparado THEN
    SELECT * INTO v_item FROM public.ordem_producao_itens WHERE id = v_componente.ordem_producao_item_id;
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

  -- Fetch item, pedido, and OP to validate active state
  SELECT * INTO v_item FROM public.ordem_producao_itens WHERE id = v_componente.ordem_producao_item_id;
  
  IF EXISTS (SELECT 1 FROM public.pedidos WHERE id = v_item.pedido_id AND status = 'pronto') THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de um pedido concluído na produção.';
  END IF;

  SELECT * INTO v_op FROM public.ordem_producao WHERE id = v_item.ordem_producao_id;
  IF v_op.status IN ('concluida', 'cancelada') THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de uma Ordem de Produção concluída ou arquivada.';
  END IF;

  -- 1. Update component status
  UPDATE public.ordem_producao_item_componentes
  SET preparado = p_preparado,
      preparado_em = CASE WHEN p_preparado THEN now() ELSE null END,
      preparado_por = CASE WHEN p_preparado THEN v_usuario_id ELSE null END,
      updated_at = now()
  WHERE id = p_componente_id
  RETURNING * INTO v_componente;

  -- 2. Automatic regression: if component is desmarked, parent item MUST become unprepared
  IF NOT p_preparado AND v_item.preparado THEN
    UPDATE public.ordem_producao_itens
    SET preparado = false,
        preparado_em = null,
        preparado_por = null,
        atualizado_em = now()
    WHERE id = v_item.id
    RETURNING * INTO v_item;
  END IF;

  -- 3. Write semantic history log for component state change
  v_correlation_id := gen_random_uuid();
  v_historico_descricao := CASE 
    WHEN p_preparado THEN initcap(lower(v_componente.tipo)) || ' preparado.' 
    ELSE initcap(lower(v_componente.tipo)) || ' desmarcado.' 
  END;

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
    v_historico_descricao,
    jsonb_build_object(
      'schema_version', 1,
      'correlation_id', v_correlation_id,
      'componenteId', v_componente.id,
      'itemId', v_item.id,
      'pedidoId', v_item.pedido_id,
      'tipo', v_componente.tipo,
      'preparado', p_preparado
    )
  );

  -- 4. Calculate aggregate states
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

-- 4. Create public.rpc_concluir_item_producao RPC
CREATE OR REPLACE FUNCTION public.rpc_concluir_item_producao(
  p_ordem_producao_item_id UUID,
  p_pronto BOOLEAN
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
  v_comp_pendentes INT;
BEGIN
  v_usuario_id := auth.uid();
  SELECT email INTO v_usuario_email FROM auth.users WHERE id = v_usuario_id;
  IF v_usuario_email IS NULL THEN
    v_usuario_email := 'sistema';
  END IF;

  -- Validate item and Lock
  SELECT * INTO v_item
  FROM public.ordem_producao_itens
  WHERE id = p_ordem_producao_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da Ordem de Produção não encontrado.';
  END IF;

  -- Idempotency check: return immediately if state has not changed
  IF v_item.preparado = p_pronto THEN
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

  -- Validate Pedido status
  SELECT * INTO v_pedido
  FROM public.pedidos
  WHERE id = v_item.pedido_id;

  IF v_pedido.status = 'pronto' THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de um pedido concluído na produção.';
  END IF;

  -- Validate OP status
  SELECT * INTO v_op
  FROM public.ordens_producao
  WHERE id = v_item.ordem_producao_id;

  IF v_op.status IN ('concluida', 'cancelada') THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de uma Ordem de Produção concluída ou arquivada.';
  END IF;

  -- If setting to true, validate that ALL components are prepared
  IF p_pronto THEN
    SELECT COUNT(1) INTO v_comp_pendentes
    FROM public.ordem_producao_item_componentes
    WHERE ordem_producao_item_id = p_ordem_producao_item_id AND preparado = false;

    IF v_comp_pendentes > 0 THEN
      RAISE EXCEPTION 'Não é permitido marcar o produto como pronto enquanto houver componentes pendentes.';
    END IF;

    -- Update parent item
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
    -- Update parent item to false
    UPDATE public.ordem_producao_itens
    SET preparado = false,
        preparado_em = null,
        preparado_por = null,
        atualizado_em = now()
    WHERE id = p_ordem_producao_item_id
    RETURNING * INTO v_item;
  END IF;

  -- Write semantic history log
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
    CASE WHEN p_pronto THEN 'ITEM_PREPARADO'::public.historico_acao ELSE 'ITEM_DESMARCADO'::public.historico_acao END,
    CASE WHEN p_pronto THEN 'Produto marcado como pronto.' ELSE 'Produto voltou para pendente.' END,
    jsonb_build_object(
      'schema_version', 1,
      'correlation_id', v_correlation_id,
      'itemId', v_item.id,
      'pedidoId', v_item.pedido_id,
      'preparado', p_pronto
    )
  );

  -- Calculate aggregate states
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

-- 5. Update public.obter_detalhe_ordem_producao to return components ordered
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

  -- Fetch item tracking statuses decorated with ordered components
  SELECT jsonb_agg(
    to_jsonb(oi) || jsonb_build_object(
      'componentes', COALESCE((
        SELECT jsonb_agg(to_jsonb(comp))
        FROM (
          SELECT *
          FROM public.ordem_producao_item_componentes
          WHERE ordem_producao_item_id = oi.id
          ORDER BY ordem ASC
        ) comp
      ), '[]'::jsonb)
    )
  ) INTO v_op_itens
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
