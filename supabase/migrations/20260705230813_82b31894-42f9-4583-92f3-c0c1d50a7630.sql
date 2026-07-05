
-- Simplify pedido_status to 5 values: orcamento, aprovado, em_producao, pronto, entregue

-- 1) Migrate existing rows to the new set
UPDATE public.pedidos SET status = 'orcamento'::pedido_status
  WHERE status IN ('aguardando_aprovacao','cancelado');
UPDATE public.pedidos SET status = 'em_producao'::pedido_status
  WHERE status IN ('aguardando_producao','montagem','controle_qualidade');

-- 2) Drop default before altering the type
ALTER TABLE public.pedidos ALTER COLUMN status DROP DEFAULT;

-- 3) Rename old enum and create the new one
ALTER TYPE public.pedido_status RENAME TO pedido_status_old;
CREATE TYPE public.pedido_status AS ENUM ('orcamento','aprovado','em_producao','pronto','entregue');

-- 4) Convert the column to the new enum via text
ALTER TABLE public.pedidos
  ALTER COLUMN status TYPE public.pedido_status USING status::text::public.pedido_status;

-- 5) Restore a sensible default
ALTER TABLE public.pedidos ALTER COLUMN status SET DEFAULT 'orcamento'::public.pedido_status;

-- 6) Drop the legacy enum
DROP TYPE public.pedido_status_old;
