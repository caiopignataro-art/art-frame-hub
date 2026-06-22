
-- =========================================================
-- 1. CONFIGURAÇÕES DO SISTEMA (chave/valor)
-- =========================================================
CREATE TABLE public.configuracoes_sistema (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave TEXT NOT NULL UNIQUE,
  valor JSONB NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_sistema TO anon, authenticated;
GRANT ALL ON public.configuracoes_sistema TO service_role;
ALTER TABLE public.configuracoes_sistema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "configuracoes_sistema acesso aberto" ON public.configuracoes_sistema FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER tg_configuracoes_updated_at BEFORE UPDATE ON public.configuracoes_sistema
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

INSERT INTO public.configuracoes_sistema (chave, valor, descricao) VALUES
  ('estoque.comprimento_barra_cm', '270'::jsonb, 'Comprimento padrão da barra de moldura em cm'),
  ('estoque.perda_corte_percentual', '15'::jsonb, 'Perda de corte em % aplicada ao consumo de moldura'),
  ('estoque.estoque_minimo_barras_default', '2'::jsonb, 'Estoque mínimo padrão (em barras) por perfil');

-- =========================================================
-- 2. PRODUTOS: campos de estoque mínimo / fabricante
-- =========================================================
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS estoque_minimo_barras NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE public.fabricante_estoque_minimo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fabricante TEXT NOT NULL UNIQUE,
  estoque_minimo_barras NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fabricante_estoque_minimo TO anon, authenticated;
GRANT ALL ON public.fabricante_estoque_minimo TO service_role;
ALTER TABLE public.fabricante_estoque_minimo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fab_min acesso aberto" ON public.fabricante_estoque_minimo FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER tg_fab_min_updated_at BEFORE UPDATE ON public.fabricante_estoque_minimo
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- 3. ENUMS de estoque
-- =========================================================
CREATE TYPE public.estoque_movimento_tipo AS ENUM (
  'entrada','ajuste','reserva','estorno_reserva','consumo','estorno_consumo','uso_retalho','geracao_retalho','descarte_retalho'
);
CREATE TYPE public.reserva_status AS ENUM ('ativa','consumida','estornada');
CREATE TYPE public.retalho_status AS ENUM ('disponivel','usado','descartado');
CREATE TYPE public.ordem_producao_status AS ENUM ('aberta','em_andamento','concluida','cancelada');

-- =========================================================
-- 4. RETALHOS
-- =========================================================
CREATE TABLE public.retalhos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  comprimento_cm NUMERIC(12,2) NOT NULL CHECK (comprimento_cm > 0),
  status public.retalho_status NOT NULL DEFAULT 'disponivel',
  origem_pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  pedido_uso_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  data_corte TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_uso TIMESTAMPTZ,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_retalhos_produto_status ON public.retalhos(produto_id, status);
CREATE INDEX idx_retalhos_disponivel ON public.retalhos(produto_id, comprimento_cm) WHERE status = 'disponivel';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.retalhos TO anon, authenticated;
GRANT ALL ON public.retalhos TO service_role;
ALTER TABLE public.retalhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "retalhos acesso aberto" ON public.retalhos FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER tg_retalhos_updated_at BEFORE UPDATE ON public.retalhos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- 5. RESERVAS DE ESTOQUE
-- =========================================================
CREATE TABLE public.reservas_estoque (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  pedido_item_id UUID REFERENCES public.pedido_itens(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  comprimento_cm NUMERIC(12,2) NOT NULL CHECK (comprimento_cm > 0),
  retalho_id UUID REFERENCES public.retalhos(id) ON DELETE SET NULL,
  status public.reserva_status NOT NULL DEFAULT 'ativa',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reservas_pedido ON public.reservas_estoque(pedido_id);
CREATE INDEX idx_reservas_produto_status ON public.reservas_estoque(produto_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservas_estoque TO anon, authenticated;
GRANT ALL ON public.reservas_estoque TO service_role;
ALTER TABLE public.reservas_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservas acesso aberto" ON public.reservas_estoque FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER tg_reservas_updated_at BEFORE UPDATE ON public.reservas_estoque
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========================================================
-- 6. MOVIMENTAÇÕES DE ESTOQUE (auditoria)
-- =========================================================
CREATE TABLE public.estoque_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
  reserva_id UUID REFERENCES public.reservas_estoque(id) ON DELETE SET NULL,
  retalho_id UUID REFERENCES public.retalhos(id) ON DELETE SET NULL,
  tipo public.estoque_movimento_tipo NOT NULL,
  quantidade_cm NUMERIC(12,2) NOT NULL,
  quantidade_barras NUMERIC(12,4) NOT NULL DEFAULT 0,
  saldo_anterior_cm NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_posterior_cm NUMERIC(14,2) NOT NULL DEFAULT 0,
  usuario TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_estmov_produto ON public.estoque_movimentacoes(produto_id, created_at DESC);
CREATE INDEX idx_estmov_pedido ON public.estoque_movimentacoes(pedido_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_movimentacoes TO anon, authenticated;
GRANT ALL ON public.estoque_movimentacoes TO service_role;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "estmov acesso aberto" ON public.estoque_movimentacoes FOR ALL USING (true) WITH CHECK (true);

-- =========================================================
-- 7. ORDENS DE PRODUÇÃO
-- =========================================================
CREATE SEQUENCE IF NOT EXISTS public.ordens_producao_numero_seq START 1000;

CREATE TABLE public.ordens_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_op TEXT NOT NULL UNIQUE DEFAULT ('OP-' || lpad(nextval('public.ordens_producao_numero_seq')::text, 6, '0')),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  pedido_item_id UUID REFERENCES public.pedido_itens(id) ON DELETE SET NULL,
  perfil_produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  passe_partout_produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  protecao_produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  fundo_produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  largura_arte_cm NUMERIC(10,2),
  altura_arte_cm NUMERIC(10,2),
  largura_final_cm NUMERIC(10,2),
  altura_final_cm NUMERIC(10,2),
  largura_externa_cm NUMERIC(10,2),
  altura_externa_cm NUMERIC(10,2),
  consumo_moldura_cm NUMERIC(12,2) NOT NULL DEFAULT 0,
  consumo_vidro_m2 NUMERIC(12,4) NOT NULL DEFAULT 0,
  consumo_fundo_m2 NUMERIC(12,4) NOT NULL DEFAULT 0,
  status public.ordem_producao_status NOT NULL DEFAULT 'aberta',
  observacao TEXT,
  metadados JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_op_pedido ON public.ordens_producao(pedido_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_producao TO anon, authenticated;
GRANT ALL ON public.ordens_producao TO service_role;
ALTER TABLE public.ordens_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op acesso aberto" ON public.ordens_producao FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER tg_op_updated_at BEFORE UPDATE ON public.ordens_producao
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER tg_op_audit AFTER INSERT OR UPDATE OR DELETE ON public.ordens_producao
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_historico_simples();

-- =========================================================
-- 8. FUNÇÕES AUXILIARES
-- =========================================================

-- Lê configuração numérica
CREATE OR REPLACE FUNCTION public.cfg_num(_chave TEXT, _default NUMERIC)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v JSONB;
BEGIN
  SELECT valor INTO v FROM public.configuracoes_sistema WHERE chave = _chave;
  IF v IS NULL THEN RETURN _default; END IF;
  RETURN (v::text)::numeric;
EXCEPTION WHEN OTHERS THEN RETURN _default;
END; $$;

-- Saldo total em cm de um produto (quantidade de barras * comprimento_barra + retalhos disponíveis)
CREATE OR REPLACE FUNCTION public.estoque_saldo_cm(_produto_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_barras NUMERIC; v_comprimento NUMERIC; v_retalhos NUMERIC;
BEGIN
  SELECT COALESCE(quantidade,0) INTO v_barras FROM public.produtos WHERE id = _produto_id;
  v_comprimento := public.cfg_num('estoque.comprimento_barra_cm', 270);
  SELECT COALESCE(SUM(comprimento_cm),0) INTO v_retalhos FROM public.retalhos WHERE produto_id = _produto_id AND status = 'disponivel';
  RETURN (COALESCE(v_barras,0) * v_comprimento) + COALESCE(v_retalhos,0);
END; $$;

-- Calcula consumo de uma moldura para um item de pedido
CREATE OR REPLACE FUNCTION public.calcular_consumo_moldura(
  _largura_final NUMERIC, _altura_final NUMERIC, _larg_perfil NUMERIC
) RETURNS NUMERIC LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE v_largext NUMERIC; v_altext NUMERIC; v_perim NUMERIC; v_perda NUMERIC;
BEGIN
  v_perda := public.cfg_num('estoque.perda_corte_percentual', 15);
  v_largext := COALESCE(_largura_final,0) + COALESCE(_larg_perfil,0) * 2;
  v_altext  := COALESCE(_altura_final,0)  + COALESCE(_larg_perfil,0) * 2;
  v_perim   := (v_largext + v_altext) * 2;
  RETURN v_perim * (1 + v_perda/100.0);
END; $$;

-- Cria reservas para um pedido (consome retalhos primeiro, depois barras)
CREATE OR REPLACE FUNCTION public.processar_reserva_pedido(_pedido_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item RECORD; v_mold JSONB; v_produto RECORD; v_qtd_quadros NUMERIC;
  v_largfin NUMERIC; v_altfin NUMERIC; v_consumo NUMERIC; v_restante NUMERIC;
  v_retalho RECORD; v_uso NUMERIC; v_comp_barra NUMERIC; v_barras_dec NUMERIC;
  v_saldo_antes NUMERIC; v_saldo_depois NUMERIC; v_reserva_id UUID;
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(current_setting('request.jwt.claim.email', true), 'sistema');
  v_comp_barra := public.cfg_num('estoque.comprimento_barra_cm', 270);

  -- Evita duplicidade
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

      -- 1) Tenta retalhos disponíveis (menor que atenda)
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
        -- Se sobrou pedaço do retalho, registra novo retalho
        IF v_retalho.comprimento_cm - v_restante > 1 THEN
          INSERT INTO public.retalhos (produto_id, comprimento_cm, origem_pedido_id, observacao)
          VALUES (v_produto.id, v_retalho.comprimento_cm - v_restante, _pedido_id, 'Sobra de retalho ' || v_retalho.id);
        END IF;
        v_restante := 0;
        EXIT;
      END LOOP;

      -- 2) Consome barras (decimal)
      IF v_restante > 0 THEN
        v_barras_dec := v_restante / v_comp_barra;
        v_saldo_antes := public.estoque_saldo_cm(v_produto.id);
        UPDATE public.produtos SET quantidade = GREATEST(0, COALESCE(quantidade,0) - v_barras_dec) WHERE id = v_produto.id;
        INSERT INTO public.reservas_estoque (pedido_id, pedido_item_id, produto_id, comprimento_cm, status, observacao)
        VALUES (_pedido_id, v_item.id, v_produto.id, v_restante, 'ativa', 'Reserva via barras')
        RETURNING id INTO v_reserva_id;
        v_saldo_depois := public.estoque_saldo_cm(v_produto.id);
        INSERT INTO public.estoque_movimentacoes (produto_id, pedido_id, reserva_id, tipo, quantidade_cm, quantidade_barras, saldo_anterior_cm, saldo_posterior_cm, usuario, observacao)
        VALUES (v_produto.id, _pedido_id, v_reserva_id, 'reserva', v_restante, v_barras_dec, v_saldo_antes, v_saldo_depois, v_usuario, 'Reserva de barras para pedido');
      END IF;
    END LOOP;

    -- Cria/atualiza ordem de produção do item
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

-- Estorna reservas ativas de um pedido (devolve barras e retalhos)
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
      UPDATE public.produtos SET quantidade = COALESCE(quantidade,0) + (v_res.comprimento_cm / v_comp_barra) WHERE id = v_res.produto_id;
    END IF;
    UPDATE public.reservas_estoque SET status='estornada' WHERE id = v_res.id;
    v_saldo_depois := public.estoque_saldo_cm(v_res.produto_id);
    INSERT INTO public.estoque_movimentacoes (produto_id, pedido_id, reserva_id, retalho_id, tipo, quantidade_cm, quantidade_barras, saldo_anterior_cm, saldo_posterior_cm, usuario, observacao)
    VALUES (v_res.produto_id, _pedido_id, v_res.id, v_res.retalho_id, 'estorno_reserva', v_res.comprimento_cm, v_res.comprimento_cm/v_comp_barra, v_saldo_antes, v_saldo_depois, v_usuario, 'Estorno de reserva');
  END LOOP;
END; $$;

-- Converte reservas ativas em consumo efetivo e gera retalhos das sobras
CREATE OR REPLACE FUNCTION public.consumir_reservas_pedido(_pedido_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_res RECORD; v_comp_barra NUMERIC; v_sobra NUMERIC; v_saldo_antes NUMERIC; v_saldo_depois NUMERIC;
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(current_setting('request.jwt.claim.email', true), 'sistema');
  v_comp_barra := public.cfg_num('estoque.comprimento_barra_cm', 270);
  FOR v_res IN SELECT * FROM public.reservas_estoque WHERE pedido_id = _pedido_id AND status = 'ativa' LOOP
    v_saldo_antes := public.estoque_saldo_cm(v_res.produto_id);
    UPDATE public.reservas_estoque SET status='consumida' WHERE id = v_res.id;
    -- Sobra: se reserva consumiu barra inteira (comp_barra) e usou menos, gera retalho
    IF v_res.retalho_id IS NULL THEN
      v_sobra := v_comp_barra - (v_res.comprimento_cm % v_comp_barra);
      IF v_sobra > 1 AND v_sobra < v_comp_barra THEN
        INSERT INTO public.retalhos (produto_id, comprimento_cm, origem_pedido_id, observacao)
        VALUES (v_res.produto_id, v_sobra, _pedido_id, 'Sobra de corte');
        INSERT INTO public.estoque_movimentacoes (produto_id, pedido_id, reserva_id, tipo, quantidade_cm, quantidade_barras, saldo_anterior_cm, saldo_posterior_cm, usuario, observacao)
        VALUES (v_res.produto_id, _pedido_id, v_res.id, 'geracao_retalho', v_sobra, 0, v_saldo_antes, public.estoque_saldo_cm(v_res.produto_id), v_usuario, 'Retalho gerado pelo corte');
      END IF;
    END IF;
    v_saldo_depois := public.estoque_saldo_cm(v_res.produto_id);
    INSERT INTO public.estoque_movimentacoes (produto_id, pedido_id, reserva_id, retalho_id, tipo, quantidade_cm, quantidade_barras, saldo_anterior_cm, saldo_posterior_cm, usuario, observacao)
    VALUES (v_res.produto_id, _pedido_id, v_res.id, v_res.retalho_id, 'consumo', v_res.comprimento_cm, v_res.comprimento_cm/v_comp_barra, v_saldo_antes, v_saldo_depois, v_usuario, 'Consumo efetivo');
  END LOOP;

  UPDATE public.ordens_producao SET status='concluida' WHERE pedido_id = _pedido_id AND status <> 'concluida';
END; $$;

-- =========================================================
-- 9. TRIGGERS no pedido para orquestrar o estoque
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_pedidos_estoque()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('aguardando_producao','em_producao','montagem','controle_qualidade') THEN
      PERFORM public.processar_reserva_pedido(NEW.id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'aguardando_producao' AND OLD.status NOT IN ('aguardando_producao','em_producao','montagem','controle_qualidade','pronto','entregue') THEN
        PERFORM public.processar_reserva_pedido(NEW.id);
      ELSIF NEW.status = 'cancelado' THEN
        PERFORM public.estornar_reservas_pedido(NEW.id);
        UPDATE public.ordens_producao SET status='cancelada' WHERE pedido_id = NEW.id AND status <> 'concluida';
      ELSIF NEW.status IN ('pronto','entregue') AND OLD.status NOT IN ('pronto','entregue') THEN
        PERFORM public.consumir_reservas_pedido(NEW.id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END; $$;

DROP TRIGGER IF EXISTS tg_pedidos_estoque ON public.pedidos;
CREATE TRIGGER tg_pedidos_estoque
AFTER INSERT OR UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.tg_pedidos_estoque();

-- Trigger para reservar quando itens forem inseridos APÓS o pedido já estar em produção
-- (caso comum: criar pedido sem itens e depois adicionar)
CREATE OR REPLACE FUNCTION public.tg_pedido_itens_estoque()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.pedido_status;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_status FROM public.pedidos WHERE id = NEW.pedido_id;
    IF v_status IN ('aguardando_producao','em_producao','montagem','controle_qualidade') THEN
      -- Apenas reprocessa se não existe reserva para ESTE item
      IF NOT EXISTS (SELECT 1 FROM public.reservas_estoque WHERE pedido_item_id = NEW.id) THEN
        -- Reusamos a função geral (ela checa duplicidade por pedido; aqui forçamos por item)
        DELETE FROM public.reservas_estoque WHERE pedido_id = NEW.pedido_id AND status='ativa';
        PERFORM public.processar_reserva_pedido(NEW.pedido_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS tg_pedido_itens_estoque ON public.pedido_itens;
CREATE TRIGGER tg_pedido_itens_estoque
AFTER INSERT ON public.pedido_itens
FOR EACH ROW EXECUTE FUNCTION public.tg_pedido_itens_estoque();
