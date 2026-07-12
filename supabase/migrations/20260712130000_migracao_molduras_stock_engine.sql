-- Add linking fields to consumo_estoque
ALTER TABLE public.consumo_estoque ADD COLUMN IF NOT EXISTS pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE;
ALTER TABLE public.consumo_estoque ADD COLUMN IF NOT EXISTS pedido_item_id UUID REFERENCES public.pedido_itens(id) ON DELETE CASCADE;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_consumo_estoque_pedido ON public.consumo_estoque(pedido_id);

-- Manufacturing Engine: Translates calculator metadata into consumption rows
CREATE OR REPLACE FUNCTION public.gerar_consumo_estoque_pedido(_pedido_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item RECORD; v_mold JSONB; v_produto RECORD; v_qtd_quadros NUMERIC;
  v_largfin NUMERIC; v_altfin NUMERIC; v_consumo NUMERIC;
BEGIN
  -- Clean up prior consumption records for this order
  DELETE FROM public.consumo_estoque WHERE pedido_id = _pedido_id;

  FOR v_item IN SELECT * FROM public.pedido_itens WHERE pedido_id = _pedido_id LOOP
    v_qtd_quadros := COALESCE(v_item.quantidade, 1);
    v_largfin := COALESCE((v_item.metadados->'calculo'->>'largura_final_cm')::numeric, v_item.largura_cm);
    v_altfin  := COALESCE((v_item.metadados->'calculo'->>'altura_final_cm')::numeric,  v_item.altura_cm);

    -- Loop through frames (molduras)
    FOR v_mold IN SELECT jsonb_array_elements(COALESCE(v_item.metadados->'entrada'->'molduras', '[]'::jsonb)) LOOP
      SELECT * INTO v_produto FROM public.produtos WHERE id = (v_mold->>'produto_id')::uuid;
      CONTINUE WHEN v_produto.id IS NULL;

      v_consumo := public.calcular_consumo_moldura(v_largfin, v_altfin, COALESCE(v_produto.largura_cm,0)) * v_qtd_quadros;

      INSERT INTO public.consumo_estoque (
        produto_id, codigo, forma_estoque, unidade, quantidade,
        largura, altura, comprimento, area, observacoes, pedido_id, pedido_item_id
      ) VALUES (
        v_produto.id, v_produto.codigo, v_produto.forma_estoque, 'cm', v_qtd_quadros,
        v_largfin, v_altfin, v_consumo, NULL, 'Consumo de Moldura (Barras)', _pedido_id, v_item.id
      );
    END LOOP;
  END LOOP;
END;
$$;

-- Stock Engine Orchestrator: Processes reservations exclusively through consumo_estoque
CREATE OR REPLACE FUNCTION public.processar_reserva_pedido(_pedido_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_consumo_rec RECORD; v_produto RECORD; v_reserva_id UUID;
  v_saldo_antes NUMERIC; v_saldo_depois NUMERIC;
  v_retalho RECORD; v_comp_barra NUMERIC; v_barras_dec NUMERIC;
  v_usuario TEXT; v_restante NUMERIC;
  v_item RECORD;
BEGIN
  v_usuario := COALESCE(current_setting('request.jwt.claim.email', true), 'sistema');
  v_comp_barra := public.cfg_num('estoque.comprimento_barra_cm', 270);

  IF EXISTS (SELECT 1 FROM public.reservas_estoque WHERE pedido_id = _pedido_id AND status = 'ativa') THEN
    RETURN;
  END IF;

  -- 1) Invoke the Manufacturing Engine to populate consumo_estoque
  PERFORM public.gerar_consumo_estoque_pedido(_pedido_id);

  -- 2) Stock Engine loop consuming exclusively from consumo_estoque
  FOR v_consumo_rec IN SELECT * FROM public.consumo_estoque WHERE pedido_id = _pedido_id LOOP
    SELECT * INTO v_produto FROM public.produtos WHERE id = v_consumo_rec.produto_id;
    CONTINUE WHEN v_produto.id IS NULL;

    -- Processador de Barras (for 'barras' stock form)
    IF v_consumo_rec.forma_estoque = 'barras' THEN
      v_restante := v_consumo_rec.comprimento;

      FOR v_retalho IN
        SELECT * FROM public.retalhos
        WHERE produto_id = v_produto.id AND status = 'disponivel' AND comprimento_cm >= v_restante
        ORDER BY comprimento_cm ASC LIMIT 1
      LOOP
        v_saldo_antes := public.estoque_saldo_cm(v_produto.id);
        UPDATE public.retalhos SET status='usado', pedido_uso_id=_pedido_id, data_uso=now() WHERE id = v_retalho.id;
        INSERT INTO public.reservas_estoque (pedido_id, pedido_item_id, produto_id, comprimento_cm, retalho_id, status, observacao)
        VALUES (_pedido_id, v_consumo_rec.pedido_item_id, v_produto.id, v_restante, v_retalho.id, 'ativa', 'Reserva via retalho')
        RETURNING id INTO v_reserva_id;
        v_saldo_depois := public.estoque_saldo_cm(v_produto.id);
        INSERT INTO public.estoque_movimentacoes (produto_id, pedido_id, reserva_id, retalho_id, tipo, quantidade_cm, quantidade_barras, saldo_anterior_cm, saldo_posterior_cm, usuario, observacao)
        VALUES (v_produto.id, _pedido_id, v_reserva_id, v_retalho.id, 'uso_retalho', v_restante, 0, v_saldo_antes, v_saldo_depois, v_usuario, 'Retalho reservado para pedido');
        
        IF v_retalho.comprimento_cm - v_restante > 1 THEN
          INSERT INTO public.retalhos (produto_id, comprimento_cm, origem_pedido_id, observacao)
          VALUES (v_produto.id, v_retalho.comprimento_cm - v_restante, _pedido_id, 'Sobra de retalho ' || v_retalho.id);
        END IF;
        
        v_restante := 0;
        EXIT;
      END LOOP;

      IF v_restante > 0 THEN
        v_barras_dec := v_restante / v_comp_barra;
        v_saldo_antes := public.estoque_saldo_cm(v_produto.id);
        UPDATE public.produtos SET estoque = GREATEST(0, COALESCE(estoque,0)::numeric - v_barras_dec)::integer WHERE id = v_produto.id;
        INSERT INTO public.reservas_estoque (pedido_id, pedido_item_id, produto_id, comprimento_cm, status, observacao)
        VALUES (_pedido_id, v_consumo_rec.pedido_item_id, v_produto.id, v_restante, 'ativa', 'Reserva via barras')
        RETURNING id INTO v_reserva_id;
        v_saldo_depois := public.estoque_saldo_cm(v_produto.id);
        INSERT INTO public.estoque_movimentacoes (produto_id, pedido_id, reserva_id, tipo, quantidade_cm, quantidade_barras, saldo_anterior_cm, saldo_posterior_cm, usuario, observacao)
        VALUES (v_produto.id, _pedido_id, v_reserva_id, 'reserva', v_restante, v_barras_dec, v_saldo_antes, v_saldo_depois, v_usuario, 'Reserva de barras para pedido');
      END IF;
    END IF;
  END LOOP;

  -- 3) Create production orders (Manufacturing Engine)
  FOR v_item IN SELECT * FROM public.pedido_itens WHERE pedido_id = _pedido_id LOOP
    v_largfin := COALESCE((v_item.metadados->'calculo'->>'largura_final_cm')::numeric, v_item.largura_cm);
    v_altfin  := COALESCE((v_item.metadados->'calculo'->>'altura_final_cm')::numeric,  v_item.altura_cm);

    INSERT INTO public.ordens_producao (
      pedido_id, pedido_item_id,
      perfil_produto_id,
      passe_partout_produto_id, protecao_produto_id, fundo_produto_id,
      largura_arte_cm, altura_arte_cm, largura_final_cm, altura_final_cm,
      largura_externa_cm, altura_externa_cm,
      consumo_moldura_cm, consumo_vidro_m2, consumo_fundo_m2,
      metadados
    )
    SELECT
      _pedido_id, v_item.id,
      ((COALESCE(v_item.metadados->'entrada'->'molduras','[]'::jsonb)->0)->>'produto_id')::uuid,
      ((COALESCE(v_item.metadados->'entrada'->'passe_partouts','[]'::jsonb)->0)->>'produto_id')::uuid,
      (v_item.metadados->'entrada'->>'protecao_id')::uuid,
      (v_item.metadados->'entrada'->>'fundo_id')::uuid,
      (v_item.metadados->'entrada'->>'largura_interna_cm')::numeric,
      (v_item.metadados->'entrada'->>'altura_interna_cm')::numeric,
      v_largfin, v_altfin,
      v_largfin + COALESCE((SELECT largura_cm FROM public.produtos WHERE id = ((COALESCE(v_item.metadados->'entrada'->'molduras','[]'::jsonb)->0)->>'produto_id')::uuid),0)*2,
      v_altfin  + COALESCE((SELECT largura_cm FROM public.produtos WHERE id = ((COALESCE(v_item.metadados->'entrada'->'molduras','[]'::jsonb)->0)->>'produto_id')::uuid),0)*2,
      COALESCE((SELECT SUM(comprimento_cm) FROM public.reservas_estoque WHERE pedido_item_id = v_item.id),0),
      (v_largfin * v_altfin / 10000.0) * COALESCE(v_item.quantidade, 1),
      (v_largfin * v_altfin / 10000.0) * COALESCE(v_item.quantidade, 1),
      v_item.metadados
    WHERE NOT EXISTS (SELECT 1 FROM public.ordens_producao WHERE pedido_item_id = v_item.id);
  END LOOP;
END;
$$;
