
-- Add new categories for product imports
ALTER TYPE public.produto_tipo ADD VALUE IF NOT EXISTS 'perfil_moldura';
ALTER TYPE public.produto_tipo ADD VALUE IF NOT EXISTS 'passe_partout';
ALTER TYPE public.produto_tipo ADD VALUE IF NOT EXISTS 'protecao_frontal';

-- Extend produtos with frame-profile specific fields
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS fabricante TEXT,
  ADD COLUMN IF NOT EXISTS perfil TEXT,
  ADD COLUMN IF NOT EXISTS acabamento TEXT,
  ADD COLUMN IF NOT EXISTS altura_cm NUMERIC,
  ADD COLUMN IF NOT EXISTS largura_cm NUMERIC;

-- Codigo must be unique when present (used as import key)
CREATE UNIQUE INDEX IF NOT EXISTS produtos_codigo_unique
  ON public.produtos (codigo) WHERE codigo IS NOT NULL;

-- Import history table
CREATE TABLE IF NOT EXISTS public.importacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria public.produto_tipo NOT NULL,
  arquivo_nome TEXT NOT NULL,
  total_linhas INTEGER NOT NULL DEFAULT 0,
  inseridos INTEGER NOT NULL DEFAULT 0,
  atualizados INTEGER NOT NULL DEFAULT 0,
  ignorados INTEGER NOT NULL DEFAULT 0,
  erros INTEGER NOT NULL DEFAULT 0,
  erros_detalhe JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'concluido',
  usuario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.importacoes TO anon, authenticated;
GRANT ALL ON public.importacoes TO service_role;

ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Importacoes acesso aberto (dev)"
  ON public.importacoes FOR ALL
  USING (true) WITH CHECK (true);

CREATE TRIGGER set_updated_at_importacoes
  BEFORE UPDATE ON public.importacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX IF NOT EXISTS importacoes_categoria_idx ON public.importacoes (categoria);
CREATE INDEX IF NOT EXISTS importacoes_created_at_idx ON public.importacoes (created_at DESC);
