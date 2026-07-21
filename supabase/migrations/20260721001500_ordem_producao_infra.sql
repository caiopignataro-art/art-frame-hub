-- 1. Create table ordem_producao
CREATE TABLE IF NOT EXISTS public.ordem_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero SERIAL NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Em Preparação', 'Concluída', 'Arquivada')) DEFAULT 'Em Preparação',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  concluido_em TIMESTAMPTZ,
  criado_por UUID,
  observacoes TEXT
);

-- Index for sequential number
CREATE UNIQUE INDEX IF NOT EXISTS idx_ordem_producao_numero ON public.ordem_producao(numero);

-- 2. Create table ordem_producao_itens
CREATE TABLE IF NOT EXISTS public.ordem_producao_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_producao_id UUID REFERENCES public.ordem_producao(id) ON DELETE CASCADE NOT NULL,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE NOT NULL,
  item_pedido_id UUID REFERENCES public.pedido_itens(id) ON DELETE CASCADE NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for items
CREATE INDEX IF NOT EXISTS idx_op_itens_ordem_producao_id ON public.ordem_producao_itens(ordem_producao_id);
CREATE INDEX IF NOT EXISTS idx_op_itens_pedido_id ON public.ordem_producao_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_op_itens_item_pedido_id ON public.ordem_producao_itens(item_pedido_id);

-- 3. Add column to pedidos
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS ordem_producao_id UUID REFERENCES public.ordem_producao(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pedidos_ordem_producao_id ON public.pedidos(ordem_producao_id);

-- 4. Enable RLS
ALTER TABLE public.ordem_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordem_producao_itens ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS Policies (open access for dev environment)
DROP POLICY IF EXISTS "dev open access ordem_producao" ON public.ordem_producao;
CREATE POLICY "dev open access ordem_producao" ON public.ordem_producao FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev open access ordem_producao_itens" ON public.ordem_producao_itens;
CREATE POLICY "dev open access ordem_producao_itens" ON public.ordem_producao_itens FOR ALL USING (true) WITH CHECK (true);

-- 6. Add Audit Triggers to the new tables
DROP TRIGGER IF EXISTS trg_audit_ordem_producao ON public.ordem_producao;
CREATE TRIGGER trg_audit_ordem_producao
  AFTER INSERT OR UPDATE OR DELETE ON public.ordem_producao
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_historico();

DROP TRIGGER IF EXISTS trg_audit_ordem_producao_itens ON public.ordem_producao_itens;
CREATE TRIGGER trg_audit_ordem_producao_itens
  AFTER INSERT OR UPDATE OR DELETE ON public.ordem_producao_itens
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_historico_simples();

-- 7. RPC: criar_ordem_producao
CREATE OR REPLACE FUNCTION public.criar_ordem_producao(
  p_pedidos_ids UUID[],
  p_observacoes TEXT,
  p_criado_por UUID
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
  VALUES ('Em Preparação', p_criado_por, p_observacoes)
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
  v_usuario := COALESCE(current_setting('request.jwt.claim.email', true), 'sistema');

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
    'criado',
    'Ordem de Produção criada. Status: Em Preparação. Pedidos: ' || array_to_string(v_pedidos_numeros, ', ') || '. Quantidade: ' || v_pedidos_count || ' pedido(s).',
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

-- 8. RPC: remover_pedido_da_ordem_producao
CREATE OR REPLACE FUNCTION public.remover_pedido_da_ordem_producao(
  p_pedido_id UUID,
  p_motivo TEXT,
  p_usuario_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op_id UUID;
  v_op_numero INT;
  v_pedido_numero INT;
  v_usuario TEXT;
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
END;
$$;
