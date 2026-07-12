-- Create Enum for Stock Forms
CREATE TYPE public.forma_estoque AS ENUM ('barras', 'chapas', 'bobinas', 'metro_linear', 'area', 'unidade');

-- Add new required column to produtos with a default value of 'unidade' for backward compatibility
ALTER TABLE public.produtos ADD COLUMN forma_estoque public.forma_estoque NOT NULL DEFAULT 'unidade';

-- Create table consumo_estoque
CREATE TABLE public.consumo_estoque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
    codigo VARCHAR(255),
    forma_estoque public.forma_estoque NOT NULL,
    unidade VARCHAR(50) NOT NULL,
    quantidade NUMERIC(12, 4) NOT NULL,
    largura NUMERIC(10, 2),
    altura NUMERIC(10, 2),
    comprimento NUMERIC(10, 2),
    area NUMERIC(12, 4),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and add a policy for development access
ALTER TABLE public.consumo_estoque ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consumo_estoque acesso aberto" 
ON public.consumo_estoque 
FOR ALL 
USING (true) 
WITH CHECK (true);
