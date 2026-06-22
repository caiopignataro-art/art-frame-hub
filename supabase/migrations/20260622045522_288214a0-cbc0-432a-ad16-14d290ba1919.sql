
CREATE OR REPLACE FUNCTION public.estoque_saldo_cm(_produto_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_barras NUMERIC; v_comprimento NUMERIC; v_retalhos NUMERIC;
BEGIN
  SELECT COALESCE(estoque,0) INTO v_barras FROM public.produtos WHERE id = _produto_id;
  v_comprimento := public.cfg_num('estoque.comprimento_barra_cm', 270);
  SELECT COALESCE(SUM(comprimento_cm),0) INTO v_retalhos FROM public.retalhos WHERE produto_id = _produto_id AND status = 'disponivel';
  RETURN (COALESCE(v_barras,0) * v_comprimento) + COALESCE(v_retalhos,0);
END; $$;

CREATE OR REPLACE FUNCTION public.processar_reserva_pedido(_pedido_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item RECORD; v_mold JSONB; v_produto RECORD; v_qtd_quadros NUMERIC;
  v_largfin NUMERIC; v_altfin NUMERIC; v_consumo NUMERIC; v_restante NUMERIC;
  v_retalho RECORD; v_comp_barra NUMERIC; v_barras_dec NUMERIC;
  v_saldo_antes NUMERIC; v_saldo_depois NUMERIC; v_reserva_id UUID;
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(current_setting('request.jwt.claim.email', true), 'sistema');
  v_comp_barra := public.cfg_num('estoque.comprimento_barra_cm', 270);

  IF EXISTS (SELECT 1 FROM public.reservas_estoque WHERE pedido_id = _pedido_id AND status = 'ativa') THEN
    RETURN;
  END IF;

  FOR v_item IN SELECT * FROM public.pedido_itens WHERE pedido_id = _pedido_id LOOP
    v_qtd_quadros := COALESCE(v_item.quantidade,1);
    v_largfin := COALESCE((v_item.metadados->'calculo'->>'largura_final_cm')::numeric, v_item.largura_cm);
    v_altfin  := COALESCE((v_item.metadados->'calculo'->>'altura_final_cm')::numeric,  v_item.altura_cm);

    FOR v_mold IN SELECT jsonb_array_elements(COALESCE(v_item.metadados->'entrada'->'molduras', '[]'::jsonb)) LOOP
      SELECT * INTO v_produto FROM public.produtos WHERE id = (v_mold->>'produto_id')::uuid;
      CONTINUE WHEN v_produto.id IS NULL;

      v_consumo := public.calcular_consumo_moldura(v_largfin, v_altfin, COALESCE(v_produto.largura_cm,0)) * v_qtd_quadros;
      v_restante := v_consumo;

      FOR v_retalho IN
        SELECT * FROM public.retalhos
        WHERE produto_id = v_produto.id AND status = 'disponivel' AND comprimento_cm >= v_restante
        ORDER BY comprimento_cm ASC LIMIT 1
      LOOP
        v_saldo_antes := public.estoque_saldo_cm(v_produto.id);
        UPDATE public.retalhos SET status='usado', pedido_uso_id=_pedido_id, data_uso=now() WHERE id = v_retalho.id;
        INSERT INTO public.reservas_estoque (pedido_id, pedido_item_id, produto_id, comprimento_cm, retalho_id, status, observacao)
        VALUES (_pedido_id, v_item.id, v_produto.id, v_restante, v_retalho.id, 'ativa', 'Reserva via retalho')
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
        VALUES (_pedido_id, v_item.id, v_produto.id, v_restante, 'ativa', 'Reserva via barras')
        RETURNING id INTO v_reserva_id;
        v_saldo_depois := public.estoque_saldo_cm(v_produto.id);
        INSERT INTO public.estoque_movimentacoes (produto_id, pedido_id, reserva_id, tipo, quantidade_cm, quantidade_barras, saldo_anterior_cm, saldo_posterior_cm, usuario, observacao)
        VALUES (v_produto.id, _pedido_id, v_reserva_id, 'reserva', v_restante, v_barras_dec, v_saldo_antes, v_saldo_depois, v_usuario, 'Reserva de barras para pedido');
      END IF;
    END LOOP;

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
      (v_largfin * v_altfin / 10000.0) * v_qtd_quadros,
      (v_largfin * v_altfin / 10000.0) * v_qtd_quadros,
      v_item.metadados
    WHERE NOT EXISTS (SELECT 1 FROM public.ordens_producao WHERE pedido_item_id = v_item.id);
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.estornar_reservas_pedido(_pedido_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res RECORD; v_comp_barra NUMERIC; v_saldo_antes NUMERIC; v_saldo_depois NUMERIC;
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(current_setting('request.jwt.claim.email', true), 'sistema');
  v_comp_barra := public.cfg_num('estoque.comprimento_barra_cm', 270);
  FOR v_res IN SELECT * FROM public.reservas_estoque WHERE pedido_id = _pedido_id AND status = 'ativa' LOOP
    v_saldo_antes := public.estoque_saldo_cm(v_res.produto_id);
    IF v_res.retalho_id IS NOT NULL THEN
      UPDATE public.retalhos SET status='disponivel', pedido_uso_id=NULL, data_uso=NULL WHERE id = v_res.retalho_id;
    ELSE
      UPDATE public.produtos SET estoque = (COALESCE(estoque,0)::numeric + (v_res.comprimento_cm / v_comp_barra))::integer WHERE id = v_res.produto_id;
    END IF;
    UPDATE public.reservas_estoque SET status='estornada' WHERE id = v_res.id;
    v_saldo_depois := public.estoque_saldo_cm(v_res.produto_id);
    INSERT INTO public.estoque_movimentacoes (produto_id, pedido_id, reserva_id, retalho_id, tipo, quantidade_cm, quantidade_barras, saldo_anterior_cm, saldo_posterior_cm, usuario, observacao)
    VALUES (v_res.produto_id, _pedido_id, v_res.id, v_res.retalho_id, 'estorno_reserva', v_res.comprimento_cm, v_res.comprimento_cm/v_comp_barra, v_saldo_antes, v_saldo_depois, v_usuario, 'Estorno de reserva');
  END LOOP;
END; $$;
