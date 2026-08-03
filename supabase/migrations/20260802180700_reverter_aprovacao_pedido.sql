-- Create public.rpc_reverter_aprovacao_pedido RPC
CREATE OR REPLACE FUNCTION public.rpc_reverter_aprovacao_pedido(
  p_pedido_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario TEXT;
  v_pedido_numero INT;
  v_status_atual public.pedido_status;
BEGIN
  -- Acquire lock on the Pedido row to prevent concurrent modification
  SELECT status, numero_pedido INTO v_status_atual, v_pedido_numero
  FROM public.pedidos
  WHERE id = p_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado.';
  END IF;

  -- Idempotency check: if already in 'orcamento', return successfully without errors
  IF v_status_atual = 'orcamento'::public.pedido_status THEN
    RETURN;
  END IF;

  -- Validate state: only 'aprovado' status can be reverted
  IF v_status_atual != 'aprovado'::public.pedido_status THEN
    RAISE EXCEPTION 'Apenas pedidos com status "Aprovado" podem ter a aprovação revertida.';
  END IF;

  -- 1. Delete associated payments
  DELETE FROM public.pagamentos
  WHERE pedido_id = p_pedido_id;

  -- 2. Update status, clear forma_pagamento and remove 'pagamento' key from metadados JSONB
  UPDATE public.pedidos
  SET status = 'orcamento'::public.pedido_status,
      forma_pagamento = NULL,
      metadados = COALESCE(metadados, '{}'::jsonb) - 'pagamento',
      updated_at = now()
  WHERE id = p_pedido_id;

  -- 3. Resolve current user for history logs
  v_usuario := COALESCE(
    NULLIF(current_setting('request.jwt.claim.email', true), ''),
    auth.uid()::text,
    'sistema'
  );

  -- 4. Insert dedicated semantic audit log entry in history
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
    'Aprovação revertida. Todos os lançamentos financeiros foram removidos. Pedido retornou para Orçamento.'
  );

END;
$$;
