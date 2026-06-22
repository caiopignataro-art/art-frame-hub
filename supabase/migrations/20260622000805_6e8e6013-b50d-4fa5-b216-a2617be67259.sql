
-- Calculator support: allow orderless creation and store breakdown metadata
ALTER TABLE public.pedidos ALTER COLUMN cliente_id DROP NOT NULL;

ALTER TABLE public.orcamentos       ADD COLUMN IF NOT EXISTS metadados JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.pedidos          ADD COLUMN IF NOT EXISTS metadados JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.orcamento_itens  ADD COLUMN IF NOT EXISTS metadados JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.pedido_itens     ADD COLUMN IF NOT EXISTS metadados JSONB NOT NULL DEFAULT '{}'::jsonb;
