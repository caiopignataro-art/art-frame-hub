-- 1. Create tables for Bobinas
CREATE TABLE IF NOT EXISTS public.bobinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    largura NUMERIC(10,2) NOT NULL,
    comprimento_original NUMERIC(10,2) NOT NULL,
    comprimento_restante NUMERIC(10,2) NOT NULL,
    area_restante NUMERIC(12,4) NOT NULL,
    fabricante VARCHAR(255),
    lote VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'esgotada', 'descartada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and add open policies
ALTER TABLE public.bobinas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "bobinas acesso aberto" ON public.bobinas;
CREATE POLICY "bobinas acesso aberto" ON public.bobinas FOR ALL USING (true) WITH CHECK (true);

-- 2. Add tracking fields to reserves and production orders
ALTER TABLE public.reservas_estoque
  ADD COLUMN IF NOT EXISTS bobina_id UUID REFERENCES public.bobinas(id) ON DELETE SET NULL;

ALTER TABLE public.ordens_producao 
  ADD COLUMN IF NOT EXISTS impressao_bobina_id UUID REFERENCES public.bobinas(id) ON DELETE SET NULL;

-- 3. Update Manufacturing Engine to extract bobinas consumption
CREATE OR REPLACE FUNCTION public.gerar_consumo_estoque_pedido(_pedido_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item RECORD; v_mold JSONB; v_pp JSONB; v_produto RECORD; v_qtd_quadros NUMERIC;
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

    -- Loop through passe-partouts
    FOR v_pp IN SELECT jsonb_array_elements(COALESCE(v_item.metadados->'entrada'->'passe_partouts', '[]'::jsonb)) LOOP
      SELECT * INTO v_produto FROM public.produtos WHERE id = (v_pp->>'produto_id')::uuid;
      CONTINUE WHEN v_produto.id IS NULL;

      INSERT INTO public.consumo_estoque (
        produto_id, codigo, forma_estoque, unidade, quantidade,
        largura, altura, comprimento, area, observacoes, pedido_id, pedido_item_id
      ) VALUES (
        v_produto.id, v_produto.codigo, v_produto.forma_estoque, 'un', v_qtd_quadros,
        v_largfin, v_altfin, NULL, (v_largfin * v_altfin / 10000.0) * v_qtd_quadros,
        'Consumo de Passe-partout (Chapas)', _pedido_id, v_item.id
      );
    END LOOP;

    -- Proteção Frontal (Glass, Acrylic, etc.)
    IF (v_item.metadados->'entrada'->>'protecao_id') IS NOT NULL THEN
      SELECT * INTO v_produto FROM public.produtos WHERE id = (v_item.metadados->'entrada'->>'protecao_id')::uuid;
      IF v_produto.id IS NOT NULL THEN
        INSERT INTO public.consumo_estoque (
          produto_id, codigo, forma_estoque, unidade, quantidade,
          largura, altura, comprimento, area, observacoes, pedido_id, pedido_item_id
        ) VALUES (
          v_produto.id, v_produto.codigo, v_produto.forma_estoque, 'un', v_qtd_quadros,
          v_largfin, v_altfin, NULL, (v_largfin * v_altfin / 10000.0) * v_qtd_quadros,
          'Consumo de Proteção Frontal (Chapas)', _pedido_id, v_item.id
        );
      END IF;
    END IF;

    -- Fundo (MDF, Foamboard, etc.)
    IF (v_item.metadados->'entrada'->>'fundo_id') IS NOT NULL THEN
      SELECT * INTO v_produto FROM public.produtos WHERE id = (v_item.metadados->'entrada'->>'fundo_id')::uuid;
      IF v_produto.id IS NOT NULL THEN
        INSERT INTO public.consumo_estoque (
          produto_id, codigo, forma_estoque, unidade, quantidade,
          largura, altura, comprimento, area, observacoes, pedido_id, pedido_item_id
        ) VALUES (
          v_produto.id, v_produto.codigo, v_produto.forma_estoque, 'un', v_qtd_quadros,
          v_largfin, v_altfin, NULL, (v_largfin * v_altfin / 10000.0) * v_qtd_quadros,
          'Consumo de Fundo (Chapas)', _pedido_id, v_item.id
        );
      END IF;
    END IF;

    -- Impressão (Canvas, Papel Fotográfico, Vinil, Fine Art)
    IF (v_item.metadados->'entrada'->>'impressao_id') IS NOT NULL THEN
      SELECT * INTO v_produto FROM public.produtos WHERE id = (v_item.metadados->'entrada'->>'impressao_id')::uuid;
      IF v_produto.id IS NOT NULL THEN
        INSERT INTO public.consumo_estoque (
          produto_id, codigo, forma_estoque, unidade, quantidade,
          largura, altura, comprimento, area, observacoes, pedido_id, pedido_item_id
        ) VALUES (
          v_produto.id, v_produto.codigo, v_produto.forma_estoque, 'un', v_qtd_quadros,
          v_largfin, v_altfin, NULL, (v_largfin * v_altfin / 10000.0) * v_qtd_quadros,
          'Consumo de Impressão (Bobinas)', _pedido_id, v_item.id
        );
      END IF;
    END IF;

  END LOOP;
END;
$$;

-- 5. Refactor Stock Engine to support Barras, Chapas, and Bobinas Processors
CREATE OR REPLACE FUNCTION public.processar_reserva_pedido(_pedido_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_consumo_rec RECORD; v_produto RECORD; v_reserva_id UUID;
  v_saldo_antes NUMERIC; v_saldo_depois NUMERIC;
  v_retalho RECORD; v_comp_barra NUMERIC; v_barras_dec NUMERIC;
  v_usuario TEXT; v_restante NUMERIC;
  v_item RECORD; v_largfin NUMERIC; v_altfin NUMERIC;
  
  -- Chapas variables
  v_chapa_larg NUMERIC; v_chapa_alt NUMERIC;
  v_ped_larg NUMERIC; v_ped_alt NUMERIC;
  v_temp_swap NUMERIC;
  v_retalho_chapa RECORD;
  v_chapa RECORD;
  v_target_chapa_id UUID;
  v_target_retalho_id UUID;
  v_sobra_w NUMERIC; v_sobra_h NUMERIC;

  -- Bobinas variables
  v_bobina RECORD;
  v_consumo_len NUMERIC;
BEGIN
  v_usuario := COALESCE(current_setting('request.jwt.claim.email', true), 'sistema');
  v_comp_barra := public.cfg_num('estoque.comprimento_barra_cm', 270);

  IF EXISTS (SELECT 1 FROM public.reservas_estoque WHERE pedido_id = _pedido_id AND status = 'ativa') THEN
    RETURN;
  END IF;

  -- 1) Invoke the Manufacturing Engine to populate consumo_estoque
  PERFORM public.gerar_consumo_estoque_pedido(_pedido_id);

  -- 2) Stock Engine loop consuming from consumo_estoque
  FOR v_consumo_rec IN SELECT * FROM public.consumo_estoque WHERE pedido_id = _pedido_id LOOP
    SELECT * INTO v_produto FROM public.produtos WHERE id = v_consumo_rec.produto_id;
    CONTINUE WHEN v_produto.id IS NULL;

    -- PROCESSADOR DE BARRAS
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

    -- PROCESSADOR DE CHAPAS (2D Guillotine Cut)
    ELSIF v_consumo_rec.forma_estoque = 'chapas' THEN
      v_ped_larg := v_consumo_rec.largura;
      v_ped_alt := v_consumo_rec.altura;
      v_target_chapa_id := NULL;
      v_target_retalho_id := NULL;

      -- 1) Tentar retalho de chapa disponível que comporte o corte (ordenando pela menor área)
      SELECT rc.* INTO v_retalho_chapa
      FROM public.retalhos_chapas rc
      JOIN public.chapas c ON rc.chapa_origem_id = c.id
      WHERE rc.status = 'disponivel' AND c.produto_id = v_produto.id
        AND ((rc.largura >= v_ped_larg AND rc.altura >= v_ped_alt) OR (rc.altura >= v_ped_larg AND rc.largura >= v_ped_alt))
      ORDER BY rc.area ASC LIMIT 1;

      IF v_retalho_chapa.id IS NOT NULL THEN
        v_target_retalho_id := v_retalho_chapa.id;
        v_target_chapa_id := v_retalho_chapa.chapa_origem_id;
        v_chapa_larg := v_retalho_chapa.largura;
        v_chapa_alt := v_retalho_chapa.altura;

        -- Marcar retalho utilizado
        UPDATE public.retalhos_chapas SET status = 'usado', updated_at = now() WHERE id = v_target_retalho_id;
      ELSE
        -- 2) Tentar chapa inteira disponível (ordenando pela menor área)
        SELECT * INTO v_chapa
        FROM public.chapas
        WHERE status = 'disponivel' AND produto_id = v_produto.id
          AND ((largura >= v_ped_larg AND altura >= v_ped_alt) OR (altura >= v_ped_larg AND largura >= v_ped_alt))
        ORDER BY area ASC LIMIT 1;

        IF v_chapa.id IS NOT NULL THEN
          v_target_chapa_id := v_chapa.id;
          v_chapa_larg := v_chapa.largura;
          v_chapa_alt := v_chapa.altura;

          -- Marcar chapa inteira utilizada
          UPDATE public.chapas SET status = 'usada', updated_at = now() WHERE id = v_target_chapa_id;
        END IF;
      END IF;

      -- Se encontrou uma chapa ou retalho de chapa para usar
      IF v_target_chapa_id IS NOT NULL THEN
        -- Rotacionar peça se necessário para alinhar com o corte do retalho
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
          _pedido_id, v_consumo_rec.pedido_item_id, v_produto.id, 0, 
          v_target_chapa_id, v_target_retalho_id, 'ativa', 'Reserva de chapa'
        ) RETURNING id INTO v_reserva_id;

        -- Gerar sobras (retalhos de chapa) se maior que 5x5 cm
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

        -- Atualizar a Ordem de Produção registrando os IDs reservados de acordo com o tipo
        IF v_produto.tipo = 'passe_partout' THEN
          UPDATE public.ordens_producao 
          SET passe_partout_chapa_id = v_target_chapa_id, passe_partout_retalho_chapa_id = v_target_retalho_id
          WHERE pedido_item_id = v_consumo_rec.pedido_item_id;
        ELSIF v_produto.tipo = 'protecao_frontal' THEN
          UPDATE public.ordens_producao 
          SET protecao_chapa_id = v_target_chapa_id, protecao_retalho_chapa_id = v_target_retalho_id
          WHERE pedido_item_id = v_consumo_rec.pedido_item_id;
        ELSIF v_produto.tipo = 'fundo' THEN
          UPDATE public.ordens_producao 
          SET fundo_chapa_id = v_target_chapa_id, fundo_retalho_chapa_id = v_target_retalho_id
          WHERE pedido_item_id = v_consumo_rec.pedido_item_id;
        END IF;

        -- Gravar movimentação de auditoria
        INSERT INTO public.estoque_movimentacoes (
          produto_id, pedido_id, reserva_id, tipo, quantidade_cm, quantidade_barras, 
          saldo_anterior_cm, saldo_posterior_cm, usuario, observacao
        ) VALUES (
          v_produto.id, _pedido_id, v_reserva_id, 'consumo', 0, 0, 
          0, 0, v_usuario, 'Reserva de chapa / retalho efetuada'
        );
      END IF;

    -- PROCESSADOR DE BOBINAS (Linear roll consumption based on min piece dimension)
    ELSIF v_consumo_rec.forma_estoque = 'bobinas' THEN
      v_ped_larg := v_consumo_rec.largura;
      v_ped_alt := v_consumo_rec.altura;

      -- 1) Localizar a menor bobina ativa compatível (largura comporta pelo menos uma dimensão)
      SELECT * INTO v_bobina
      FROM public.bobinas
      WHERE status = 'ativa' AND produto_id = v_produto.id
        AND (largura >= v_ped_larg OR largura >= v_ped_alt)
      ORDER BY largura ASC, comprimento_restante ASC LIMIT 1;

      IF v_bobina.id IS NOT NULL THEN
        -- 2) Determinar o comprimento linear necessário
        -- Se a largura comporta a maior dimensão, o consumo é a menor dimensão.
        -- Caso contrário, consome a maior dimensão.
        IF v_bobina.largura >= GREATEST(v_ped_larg, v_ped_alt) THEN
          v_consumo_len := LEAST(v_ped_larg, v_ped_alt) * v_consumo_rec.quantidade;
        ELSE
          v_consumo_len := GREATEST(v_ped_larg, v_ped_alt) * v_consumo_rec.quantidade;
        END IF;

        IF v_bobina.comprimento_restante >= v_consumo_len THEN
          -- Efetuar a reserva
          INSERT INTO public.reservas_estoque (
            pedido_id, pedido_item_id, produto_id, comprimento_cm, 
            bobina_id, status, observacao
          ) VALUES (
            _pedido_id, v_consumo_rec.pedido_item_id, v_produto.id, v_consumo_len, 
            v_bobina.id, 'ativa', 'Reserva de bobina'
          ) RETURNING id INTO v_reserva_id;

          -- Calcular desperdício em m²
          -- Desperdício = (largura_bobina * comprimento_consumido) - area_utilizada
          v_sobra_w := ((v_bobina.largura * v_consumo_len) / 10000.0) - COALESCE(v_consumo_rec.area, 0);

          -- Atualizar comprimento e área restante da bobina
          UPDATE public.bobinas 
          SET comprimento_restante = comprimento_restante - v_consumo_len,
              area_restante = GREATEST(0, area_restante - ((largura * v_consumo_len) / 10000.0)),
              status = CASE WHEN comprimento_restante - v_consumo_len <= 1 THEN 'esgotada'::text ELSE 'ativa'::text END,
              updated_at = now()
          WHERE id = v_bobina.id;

          -- Registrar o ID da bobina reservada na Ordem de Produção
          UPDATE public.ordens_producao 
          SET impressao_bobina_id = v_bobina.id
          WHERE pedido_item_id = v_consumo_rec.pedido_item_id;

          -- Gravar movimentação de auditoria
          INSERT INTO public.estoque_movimentacoes (
            produto_id, pedido_id, reserva_id, tipo, quantidade_cm, quantidade_barras, 
            saldo_anterior_cm, saldo_posterior_cm, usuario, observacao
          ) VALUES (
            v_produto.id, _pedido_id, v_reserva_id, 'consumo', v_consumo_len, 0, 
            v_bobina.comprimento_restante + v_consumo_len, v_bobina.comprimento_restante, 
            v_usuario, 'Consumo de Bobina Lote ' || COALESCE(v_bobina.lote, '-') || '. Desperdício m²: ' || ROUND(v_sobra_w, 4)
          );
        END IF;
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
      COALESCE((SELECT SUM(comprimento_cm) FROM public.reservas_estoque WHERE pedido_item_id = v_item.id AND chapa_id IS NULL AND bobina_id IS NULL),0),
      (v_largfin * v_altfin / 10000.0) * COALESCE(v_item.quantidade, 1),
      (v_largfin * v_altfin / 10000.0) * COALESCE(v_item.quantidade, 1),
      v_item.metadados
    WHERE NOT EXISTS (SELECT 1 FROM public.ordens_producao WHERE pedido_item_id = v_item.id);
  END LOOP;
END;
$$;

-- 6. Update Estornar Reservas to handle Bobinas
CREATE OR REPLACE FUNCTION public.estornar_reservas_pedido(_pedido_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res RECORD; v_comp_barra NUMERIC; v_saldo_antes NUMERIC; v_saldo_depois NUMERIC;
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(current_setting('request.jwt.claim.email', true), 'sistema');
  v_comp_barra := public.cfg_num('estoque.comprimento_barra_cm', 270);
  FOR v_res IN SELECT * FROM public.reservas_estoque WHERE pedido_id = _pedido_id AND status = 'ativa' LOOP
    IF v_res.chapa_id IS NOT NULL THEN
      -- Estorno de Chapas
      IF v_res.retalho_chapa_id IS NOT NULL THEN
        UPDATE public.retalhos_chapas SET status = 'disponivel', updated_at = now() WHERE id = v_res.retalho_chapa_id;
      ELSE
        UPDATE public.chapas SET status = 'disponivel', updated_at = now() WHERE id = v_res.chapa_id;
      END IF;
      DELETE FROM public.retalhos_chapas WHERE chapa_origem_id = v_res.chapa_id AND created_at >= v_res.created_at;

    ELSIF v_res.bobina_id IS NOT NULL THEN
      -- Estorno de Bobinas
      UPDATE public.bobinas 
      SET comprimento_restante = comprimento_restante + v_res.comprimento_cm,
          area_restante = area_restante + ((largura * v_res.comprimento_cm) / 10000.0),
          status = 'ativa',
          updated_at = now()
      WHERE id = v_res.bobina_id;

    ELSE
      -- Estorno de Barras
      v_saldo_antes := public.estoque_saldo_cm(v_res.produto_id);
      IF v_res.retalho_id IS NOT NULL THEN
        UPDATE public.retalhos SET status='disponivel', pedido_uso_id=NULL, data_uso=NULL WHERE id = v_res.retalho_id;
      ELSE
        UPDATE public.produtos SET estoque = (COALESCE(estoque,0)::numeric + (v_res.comprimento_cm / v_comp_barra))::integer WHERE id = v_res.produto_id;
      END IF;
      v_saldo_depois := public.estoque_saldo_cm(v_res.produto_id);
      INSERT INTO public.estoque_movimentacoes (produto_id, pedido_id, reserva_id, retalho_id, tipo, quantidade_cm, quantidade_barras, saldo_anterior_cm, saldo_posterior_cm, usuario, observacao)
      VALUES (v_res.produto_id, _pedido_id, v_res.id, v_res.retalho_id, 'estorno_reserva', v_res.comprimento_cm, v_res.comprimento_cm/v_comp_barra, v_saldo_antes, v_saldo_depois, v_usuario, 'Estorno de reserva');
    END IF;
    
    UPDATE public.reservas_estoque SET status='estornada' WHERE id = v_res.id;
  END LOOP;
END; $$;
