-- 1. Insert default cutting algorithms config mapping
INSERT INTO public.configuracoes_sistema (chave, valor, descricao)
VALUES (
  'estoque.algoritmos_corte',
  '{
    "barras": "barras_default",
    "chapas": "guillotine",
    "bobinas": "bobinas_default",
    "metro_linear": "padrao",
    "area": "padrao",
    "unidade": "padrao"
  }'::jsonb,
  'Mapeamento dos algoritmos de otimização de corte por Forma de Estoque'
)
ON CONFLICT (chave) DO NOTHING;

-- 2. Strategy: Barras Default
CREATE OR REPLACE FUNCTION public.stock_strategy_barras_default(
  _pedido_id UUID,
  _consumo_rec RECORD,
  _produto RECORD,
  _usuario TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reserva_id UUID;
  v_saldo_antes NUMERIC;
  v_saldo_depois NUMERIC;
  v_retalho RECORD;
  v_comp_barra NUMERIC;
  v_barras_dec NUMERIC;
  v_restante NUMERIC;
BEGIN
  v_comp_barra := public.cfg_num('estoque.comprimento_barra_cm', 270);
  v_restante := _consumo_rec.comprimento;

  -- Priorizar retalhos
  FOR v_retalho IN
    SELECT * FROM public.retalhos
    WHERE produto_id = _produto.id AND status = 'disponivel' AND comprimento_cm >= v_restante
    ORDER BY comprimento_cm ASC LIMIT 1
  LOOP
    v_saldo_antes := public.estoque_saldo_cm(_produto.id);
    UPDATE public.retalhos SET status='usado', pedido_uso_id=_pedido_id, data_uso=now() WHERE id = v_retalho.id;
    
    INSERT INTO public.reservas_estoque (pedido_id, pedido_item_id, produto_id, comprimento_cm, retalho_id, status, observacao)
    VALUES (_pedido_id, _consumo_rec.pedido_item_id, _produto.id, v_restante, v_retalho.id, 'ativa', 'Reserva via retalho (Estratégia Barras)')
    RETURNING id INTO v_reserva_id;
    
    v_saldo_depois := public.estoque_saldo_cm(_produto.id);
    INSERT INTO public.estoque_movimentacoes (produto_id, pedido_id, reserva_id, retalho_id, tipo, quantidade_cm, quantidade_barras, saldo_anterior_cm, saldo_posterior_cm, usuario, observacao)
    VALUES (_produto.id, _pedido_id, v_reserva_id, v_retalho.id, 'uso_retalho', v_restante, 0, v_saldo_antes, v_saldo_depois, _usuario, 'Retalho reservado para pedido (Estratégia Barras)');
    
    IF v_retalho.comprimento_cm - v_restante > 1 THEN
      INSERT INTO public.retalhos (produto_id, comprimento_cm, origem_pedido_id, observacao)
      VALUES (_produto.id, v_retalho.comprimento_cm - v_restante, _pedido_id, 'Sobra de retalho ' || v_retalho.id);
    END IF;
    
    v_restante := 0;
    EXIT;
  END LOOP;

  -- Se não for suficiente com retalho, consome barras inteiras
  IF v_restante > 0 THEN
    v_barras_dec := v_restante / v_comp_barra;
    v_saldo_antes := public.estoque_saldo_cm(_produto.id);
    UPDATE public.produtos SET estoque = GREATEST(0, COALESCE(estoque,0)::numeric - v_barras_dec)::integer WHERE id = _produto.id;
    
    INSERT INTO public.reservas_estoque (pedido_id, pedido_item_id, produto_id, comprimento_cm, status, observacao)
    VALUES (_pedido_id, _consumo_rec.pedido_item_id, _produto.id, v_restante, 'ativa', 'Reserva via barras (Estratégia Barras)')
    RETURNING id INTO v_reserva_id;
    
    v_saldo_depois := public.estoque_saldo_cm(_produto.id);
    INSERT INTO public.estoque_movimentacoes (produto_id, pedido_id, reserva_id, tipo, quantidade_cm, quantidade_barras, saldo_anterior_cm, saldo_posterior_cm, usuario, observacao)
    VALUES (_produto.id, _pedido_id, v_reserva_id, 'reserva', v_restante, v_barras_dec, v_saldo_antes, v_saldo_depois, _usuario, 'Reserva de barras para pedido (Estratégia Barras)');
  END IF;
END;
$$;

-- 3. Strategy: Chapas Guillotine
CREATE OR REPLACE FUNCTION public.stock_strategy_chapas_guillotine(
  _pedido_id UUID,
  _consumo_rec RECORD,
  _produto RECORD,
  _usuario TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reserva_id UUID;
  v_ped_larg NUMERIC;
  v_ped_alt NUMERIC;
  v_temp_swap NUMERIC;
  v_chapa_larg NUMERIC;
  v_chapa_alt NUMERIC;
  v_retalho_chapa RECORD;
  v_chapa RECORD;
  v_target_chapa_id UUID;
  v_target_retalho_id UUID;
  v_sobra_w NUMERIC;
  v_sobra_h NUMERIC;
BEGIN
  v_ped_larg := _consumo_rec.largura;
  v_ped_alt := _consumo_rec.altura;
  v_target_chapa_id := NULL;
  v_target_retalho_id := NULL;

  -- 1) Priorizar retalhos
  SELECT rc.* INTO v_retalho_chapa
  FROM public.retalhos_chapas rc
  JOIN public.chapas c ON rc.chapa_origem_id = c.id
  WHERE rc.status = 'disponivel' AND c.produto_id = _produto.id
    AND ((rc.largura >= v_ped_larg AND rc.altura >= v_ped_alt) OR (rc.altura >= v_ped_larg AND rc.largura >= v_ped_alt))
  ORDER BY rc.area ASC LIMIT 1;

  IF v_retalho_chapa.id IS NOT NULL THEN
    v_target_retalho_id := v_retalho_chapa.id;
    v_target_chapa_id := v_retalho_chapa.chapa_origem_id;
    v_chapa_larg := v_retalho_chapa.largura;
    v_chapa_alt := v_retalho_chapa.altura;

    UPDATE public.retalhos_chapas SET status = 'usado', updated_at = now() WHERE id = v_target_retalho_id;
  ELSE
    -- 2) Consumir chapa inteira
    SELECT * INTO v_chapa
    FROM public.chapas
    WHERE status = 'disponivel' AND produto_id = _produto.id
      AND ((largura >= v_ped_larg AND altura >= v_ped_alt) OR (altura >= v_ped_larg AND largura >= v_ped_alt))
    ORDER BY area ASC LIMIT 1;

    IF v_chapa.id IS NOT NULL THEN
      v_target_chapa_id := v_chapa.id;
      v_chapa_larg := v_chapa.largura;
      v_chapa_alt := v_chapa.altura;

      UPDATE public.chapas SET status = 'usada', updated_at = now() WHERE id = v_target_chapa_id;
    END IF;
  END IF;

  IF v_target_chapa_id IS NOT NULL THEN
    -- Rotacionar peça se necessário
    IF NOT (v_chapa_larg >= v_ped_larg AND v_chapa_alt >= v_ped_alt) THEN
      v_temp_swap := v_ped_larg;
      v_ped_larg := v_ped_alt;
      v_ped_alt := v_temp_swap;
    END IF;

    -- Registrar a reserva de chapa
    INSERT INTO public.reservas_estoque (
      pedido_id, pedido_item_id, produto_id, comprimento_cm, 
      chapa_id, retalho_chapa_id, status, observacao
    ) VALUES (
      _pedido_id, _consumo_rec.pedido_item_id, _produto.id, 0, 
      v_target_chapa_id, v_target_retalho_id, 'ativa', 'Reserva de chapa (Estratégia Guillotine)'
    ) RETURNING id INTO v_reserva_id;

    -- Sobras do corte de guilhotina
    v_sobra_w := v_chapa_larg - v_ped_larg;
    v_sobra_h := v_chapa_alt - v_ped_alt;

    IF v_sobra_w >= 5 AND v_chapa_alt >= 5 THEN
      INSERT INTO public.retalhos_chapas (chapa_origem_id, largura, altura, area, status)
      VALUES (v_target_chapa_id, v_sobra_w, v_chapa_alt, (v_sobra_w * v_chapa_alt) / 10000.0, 'disponivel');
    END IF;

    IF v_ped_larg >= 5 AND v_sobra_h >= 5 THEN
      INSERT INTO public.retalhos_chapas (chapa_origem_id, largura, altura, area, status)
      VALUES (v_target_chapa_id, v_ped_larg, v_sobra_h, (v_ped_larg * v_sobra_h) / 10000.0, 'disponivel');
    END IF;

    -- Atualizar a Ordem de Produção
    IF _produto.tipo = 'passe_partout' THEN
      UPDATE public.ordens_producao 
      SET passe_partout_chapa_id = v_target_chapa_id, passe_partout_retalho_chapa_id = v_target_retalho_id
      WHERE pedido_item_id = _consumo_rec.pedido_item_id;
    ELSIF _produto.tipo = 'protecao_frontal' THEN
      UPDATE public.ordens_producao 
      SET protecao_chapa_id = v_target_chapa_id, protecao_retalho_chapa_id = v_target_retalho_id
      WHERE pedido_item_id = _consumo_rec.pedido_item_id;
    ELSIF _produto.tipo = 'fundo' THEN
      UPDATE public.ordens_producao 
      SET fundo_chapa_id = v_target_chapa_id, fundo_retalho_chapa_id = v_target_retalho_id
      WHERE pedido_item_id = _consumo_rec.pedido_item_id;
    END IF;

    -- Gravar movimentação
    INSERT INTO public.estoque_movimentacoes (
      produto_id, pedido_id, reserva_id, tipo, quantidade_cm, quantidade_barras, 
      saldo_anterior_cm, saldo_posterior_cm, usuario, observacao
    ) VALUES (
      _produto.id, _pedido_id, v_reserva_id, 'consumo', 0, 0, 
      0, 0, _usuario, 'Reserva via Estratégia Guillotine'
    );
  END IF;
END;
$$;

-- 4. Strategy: Bobinas Default
CREATE OR REPLACE FUNCTION public.stock_strategy_bobinas_default(
  _pedido_id UUID,
  _consumo_rec RECORD,
  _produto RECORD,
  _usuario TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reserva_id UUID;
  v_ped_larg NUMERIC;
  v_ped_alt NUMERIC;
  v_bobina RECORD;
  v_consumo_len NUMERIC;
  v_sobra_w NUMERIC;
BEGIN
  v_ped_larg := _consumo_rec.largura;
  v_ped_alt := _consumo_rec.altura;

  -- 1) Localizar a menor bobina ativa compatível
  SELECT * INTO v_bobina
  FROM public.bobinas
  WHERE status = 'ativa' AND produto_id = _produto.id
    AND (largura >= v_ped_larg OR largura >= v_ped_alt)
  ORDER BY largura ASC, comprimento_restante ASC LIMIT 1;

  IF v_bobina.id IS NOT NULL THEN
    -- 2) Escolher a orientação que minimiza o comprimento linear consumido
    IF v_bobina.largura >= GREATEST(v_ped_larg, v_ped_alt) THEN
      v_consumo_len := LEAST(v_ped_larg, v_ped_alt) * _consumo_rec.quantidade;
    ELSE
      v_consumo_len := GREATEST(v_ped_larg, v_ped_alt) * _consumo_rec.quantidade;
    END IF;

    IF v_bobina.comprimento_restante >= v_consumo_len THEN
      INSERT INTO public.reservas_estoque (
        pedido_id, pedido_item_id, produto_id, comprimento_cm, 
        bobina_id, status, observacao
      ) VALUES (
        _pedido_id, _consumo_rec.pedido_item_id, _produto.id, v_consumo_len, 
        v_bobina.id, 'ativa', 'Reserva de bobina (Estratégia Bobinas)'
      ) RETURNING id INTO v_reserva_id;

      -- Desperdício em m²
      v_sobra_w := ((v_bobina.largura * v_consumo_len) / 10000.0) - COALESCE(_consumo_rec.area, 0);

      UPDATE public.bobinas 
      SET comprimento_restante = comprimento_restante - v_consumo_len,
          area_restante = GREATEST(0, area_restante - ((largura * v_consumo_len) / 10000.0)),
          status = CASE WHEN comprimento_restante - v_consumo_len <= 1 THEN 'esgotada'::text ELSE 'ativa'::text END,
          updated_at = now()
      WHERE id = v_bobina.id;

      UPDATE public.ordens_producao 
      SET impressao_bobina_id = v_bobina.id
      WHERE pedido_item_id = _consumo_rec.pedido_item_id;

      INSERT INTO public.estoque_movimentacoes (
        produto_id, pedido_id, reserva_id, tipo, quantidade_cm, quantidade_barras, 
        saldo_anterior_cm, saldo_posterior_cm, usuario, observacao
      ) VALUES (
        _produto.id, _pedido_id, v_reserva_id, 'consumo', v_consumo_len, 0, 
        v_bobina.comprimento_restante + v_consumo_len, v_bobina.comprimento_restante, 
        _usuario, 'Consumo Estratégia Bobinas. Lote ' || COALESCE(v_bobina.lote, '-') || '. Desperdício m²: ' || ROUND(v_sobra_w, 4)
      );
    END IF;
  END IF;
END;
$$;

-- 5. Strategy: Padrão (Metro linear, Área, Unidade)
CREATE OR REPLACE FUNCTION public.stock_strategy_padrao(
  _pedido_id UUID,
  _consumo_rec RECORD,
  _produto RECORD,
  _usuario TEXT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reserva_id UUID;
  v_consumo NUMERIC;
BEGIN
  -- Decréscimo direto no estoque geral (compatibilidade com unidade/area/metro_linear)
  IF _consumo_rec.forma_estoque = 'area' THEN
    v_consumo := COALESCE(_consumo_rec.area, 0);
  ELSIF _consumo_rec.forma_estoque = 'metro_linear' THEN
    -- Consumo em metros lineares
    v_consumo := COALESCE(_consumo_rec.comprimento, 0) / 100.0;
  ELSE
    v_consumo := COALESCE(_consumo_rec.quantidade, 1);
  END IF;

  UPDATE public.produtos 
  SET estoque = GREATEST(0, COALESCE(estoque,0)::numeric - v_consumo)::integer 
  WHERE id = _produto.id;

  INSERT INTO public.reservas_estoque (
    pedido_id, pedido_item_id, produto_id, comprimento_cm, status, observacao
  ) VALUES (
    _pedido_id, _consumo_rec.pedido_item_id, _produto.id, 0, 'ativa', 'Reserva padrão direta (Estratégia Padrão)'
  ) RETURNING id INTO v_reserva_id;

  INSERT INTO public.estoque_movimentacoes (
    produto_id, pedido_id, reserva_id, tipo, quantidade_cm, quantidade_barras, 
    saldo_anterior_cm, saldo_posterior_cm, usuario, observacao
  ) VALUES (
    _produto.id, _pedido_id, v_reserva_id, 'consumo', 0, v_consumo, 
    0, 0, _usuario, 'Estoque decrescido diretamente via Estratégia Padrão'
  );
END;
$$;

-- 6. Refactor Stock Engine trigger to implement the Strategy Router
CREATE OR REPLACE FUNCTION public.processar_reserva_pedido(_pedido_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_consumo_rec RECORD;
  v_produto RECORD;
  v_usuario TEXT;
  v_largfin NUMERIC;
  v_altfin NUMERIC;
  v_item RECORD;
  v_algoritmos JSONB;
  v_estrategia TEXT;
BEGIN
  v_usuario := COALESCE(current_setting('request.jwt.claim.email', true), 'sistema');

  IF EXISTS (SELECT 1 FROM public.reservas_estoque WHERE pedido_id = _pedido_id AND status = 'ativa') THEN
    RETURN;
  END IF;

  -- 1) Invocar Manufacturing Engine
  PERFORM public.gerar_consumo_estoque_pedido(_pedido_id);

  -- 2) Carregar configurações de algoritmos de corte
  SELECT valor INTO v_algoritmos 
  FROM public.configuracoes_sistema 
  WHERE chave = 'estoque.algoritmos_corte';

  IF v_algoritmos IS NULL THEN
    v_algoritmos := '{
      "barras": "barras_default",
      "chapas": "guillotine",
      "bobinas": "bobinas_default",
      "metro_linear": "padrao",
      "area": "padrao",
      "unidade": "padrao"
    }'::jsonb;
  END IF;

  -- 3) Loop orquestrador do Stock Engine delegando para cada estratégia
  FOR v_consumo_rec IN SELECT * FROM public.consumo_estoque WHERE pedido_id = _pedido_id LOOP
    SELECT * INTO v_produto FROM public.produtos WHERE id = v_consumo_rec.produto_id;
    CONTINUE WHEN v_produto.id IS NULL;

    -- Obter a estratégia correspondente
    v_estrategia := v_algoritmos->>v_consumo_rec.forma_estoque;
    IF v_estrategia IS NULL THEN
      v_estrategia := 'padrao';
    END IF;

    -- Strategy Router
    IF v_estrategia = 'barras_default' THEN
      PERFORM public.stock_strategy_barras_default(_pedido_id, v_consumo_rec, v_produto, v_usuario);
    ELSIF v_estrategia = 'guillotine' THEN
      PERFORM public.stock_strategy_chapas_guillotine(_pedido_id, v_consumo_rec, v_produto, v_usuario);
    ELSIF v_estrategia = 'bobinas_default' THEN
      PERFORM public.stock_strategy_bobinas_default(_pedido_id, v_consumo_rec, v_produto, v_usuario);
    ELSE
      PERFORM public.stock_strategy_padrao(_pedido_id, v_consumo_rec, v_produto, v_usuario);
    END IF;

  END LOOP;

  -- 4) Gerar ordens de produção
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
      COALESCE((SELECT SUM(comprimento_cm) FROM public.reservas_estoque WHERE pedido_item_id = v_item.id AND chapa_id IS NULL AND bobina_id IS NULL),0),
      (v_largfin * v_altfin / 10000.0) * COALESCE(v_item.quantidade, 1),
      (v_largfin * v_altfin / 10000.0) * COALESCE(v_item.quantidade, 1),
      v_item.metadados
    WHERE NOT EXISTS (SELECT 1 FROM public.ordens_producao WHERE pedido_item_id = v_item.id);
  END LOOP;
END;
$$;
