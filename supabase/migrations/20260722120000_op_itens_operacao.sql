-- 1. Extend historico_acao ENUM
-- Since PostgreSQL ALTER TYPE ... ADD VALUE cannot run inside a multi-command transaction block in some versions,
-- we run it individually or commit transaction. We can run this directly.
ALTER TYPE public.historico_acao ADD VALUE IF NOT EXISTS 'ITEM_PREPARADO';
ALTER TYPE public.historico_acao ADD VALUE IF NOT EXISTS 'ITEM_DESMARCADO';
ALTER TYPE public.historico_acao ADD VALUE IF NOT EXISTS 'ITEM_PROBLEMA_REGISTRADO';
ALTER TYPE public.historico_acao ADD VALUE IF NOT EXISTS 'ITEM_PROBLEMA_REMOVIDO';

-- 2. Create enum for problem types
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'problema_tipo_enum') THEN
    CREATE TYPE public.problema_tipo_enum AS ENUM (
      'MATERIAL_FALTANTE',
      'MEDIDA_INCORRETA',
      'MOLDURA_DANIFICADA',
      'VIDRO_DANIFICADO',
      'PASSE_PARTOUT_DANIFICADO',
      'IMPRESSAO_INCORRETA',
      'OUTRO'
    );
  END IF;
END
$$;

-- 3. Add columns and CHECK constraint to public.ordem_producao_itens
ALTER TABLE public.ordem_producao_itens
  ADD COLUMN IF NOT EXISTS preparado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preparado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS preparado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS possui_problema BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS problema_tipo public.problema_tipo_enum,
  ADD COLUMN IF NOT EXISTS problema_descricao TEXT,
  ADD COLUMN IF NOT EXISTS problema_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS problema_por UUID REFERENCES auth.users(id);

-- Enforce mutual exclusivity at the database check constraint level
ALTER TABLE public.ordem_producao_itens DROP CONSTRAINT IF EXISTS chk_op_item_exclusivity;
ALTER TABLE public.ordem_producao_itens
  ADD CONSTRAINT chk_op_item_exclusivity CHECK (
    NOT (preparado = true AND possui_problema = true)
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_op_itens_preparado ON public.ordem_producao_itens(preparado);
CREATE INDEX IF NOT EXISTS idx_op_itens_possui_problema ON public.ordem_producao_itens(possui_problema);
CREATE INDEX IF NOT EXISTS idx_op_itens_problema_tipo ON public.ordem_producao_itens(problema_tipo);

-- 4. Create internal SQL helper function to calculate aggregate order operational status
CREATE OR REPLACE FUNCTION public.calcular_estado_pedido(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_itens_total INT;
  v_itens_preparados INT;
  v_itens_com_problema INT;
  v_pedido_pronto BOOLEAN;
BEGIN
  -- Compute counts
  SELECT COUNT(1),
         COUNT(1) FILTER (WHERE preparado = true),
         COUNT(1) FILTER (WHERE possui_problema = true)
  INTO v_itens_total, v_itens_preparados, v_itens_com_problema
  FROM public.ordem_producao_itens
  WHERE pedido_id = p_pedido_id;

  -- Define ready rule: total > 0, all prepared, none have problems
  IF v_itens_total > 0 AND v_itens_preparados = v_itens_total AND v_itens_com_problema = 0 THEN
    v_pedido_pronto := TRUE;
  ELSE
    v_pedido_pronto := FALSE;
  END IF;

  RETURN jsonb_build_object(
    'id', p_pedido_id,
    'itens_total', v_itens_total,
    'itens_preparados', v_itens_preparados,
    'itens_com_problema', v_itens_com_problema,
    'pedido_pronto', v_pedido_pronto
  );
END;
$$;

-- 5. Transactional RPC function for setting item as prepared
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
BEGIN
  -- Resolve user id internally (avoids spoofing)
  v_usuario_id := auth.uid();
  SELECT email INTO v_usuario_email FROM auth.users WHERE id = v_usuario_id;
  IF v_usuario_email IS NULL THEN
    v_usuario_email := 'sistema';
  END IF;

  -- Validate item existence and lock row
  SELECT * INTO v_item
  FROM public.ordem_producao_itens
  WHERE id = p_ordem_producao_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da Ordem de Produção não encontrado.';
  END IF;

  -- Validate OP existence and status
  SELECT * INTO v_op
  FROM public.ordem_producao
  WHERE id = v_item.ordem_producao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção associada não encontrada.';
  END IF;

  IF v_op.status IN ('concluida', 'cancelada') THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de uma Ordem de Produção concluída ou arquivada.';
  END IF;

  -- Transition Validation: skip update if state is identical
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

  -- Update state and reset problem parameters
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

  -- Audit History log entry
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

-- 6. Transactional RPC function for setting item as problem
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
BEGIN
  -- Resolve user id internally (avoids spoofing)
  v_usuario_id := auth.uid();
  SELECT email INTO v_usuario_email FROM auth.users WHERE id = v_usuario_id;
  IF v_usuario_email IS NULL THEN
    v_usuario_email := 'sistema';
  END IF;

  -- Validate item existence and lock row
  SELECT * INTO v_item
  FROM public.ordem_producao_itens
  WHERE id = p_ordem_producao_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item da Ordem de Produção não encontrado.';
  END IF;

  -- Validate OP existence and status
  SELECT * INTO v_op
  FROM public.ordem_producao
  WHERE id = v_item.ordem_producao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção associada não encontrada.';
  END IF;

  IF v_op.status IN ('concluida', 'cancelada') THEN
    RAISE EXCEPTION 'Não é permitido alterar itens de uma Ordem de Produção concluída ou arquivada.';
  END IF;

  -- Validate: tipo is required if setting a problem
  IF p_possui_problema AND p_tipo IS NULL THEN
    RAISE EXCEPTION 'O tipo do problema é obrigatório ao registrar um problema.';
  END IF;

  -- Transition Validation: skip update if state is identical
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

  -- Update state and reset preparation parameters
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

  -- Audit History log entry
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
