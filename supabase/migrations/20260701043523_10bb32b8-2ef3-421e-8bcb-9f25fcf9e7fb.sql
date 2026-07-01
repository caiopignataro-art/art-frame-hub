
-- 1) Novas categorias
ALTER TYPE public.produto_tipo ADD VALUE IF NOT EXISTS 'impressao';
ALTER TYPE public.produto_tipo ADD VALUE IF NOT EXISTS 'chassi';

-- 2) Novos campos em produtos
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS unidade_venda   text,
  ADD COLUMN IF NOT EXISTS unidade_estoque text,
  ADD COLUMN IF NOT EXISTS estoque_ideal   numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estoque_minimo  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fornecedor      text,
  ADD COLUMN IF NOT EXISTS chapa_largura_cm numeric,
  ADD COLUMN IF NOT EXISTS chapa_altura_cm  numeric,
  ADD COLUMN IF NOT EXISTS preco_venda_acima_m2 numeric,
  ADD COLUMN IF NOT EXISTS preco_venda_limite_m2 numeric;

-- 3) Função para gerar código 4 dígitos único (0001-9999)
CREATE OR REPLACE FUNCTION public.proximo_codigo_produto()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int;
  v_next int;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '\D', '', 'g'), '')::int), 0)
    INTO v_max
    FROM public.produtos
    WHERE codigo ~ '^\d{1,4}$';
  v_next := GREATEST(v_max + 1, 1);
  IF v_next > 9999 THEN
    RAISE EXCEPTION 'Faixa de códigos de 4 dígitos esgotada';
  END IF;
  RETURN lpad(v_next::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.proximo_codigo_produto() TO anon, authenticated, service_role;
