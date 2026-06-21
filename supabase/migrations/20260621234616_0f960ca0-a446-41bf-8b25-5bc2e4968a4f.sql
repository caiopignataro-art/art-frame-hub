
-- =========================================================================
-- ERP MOLDURARIA — Schema completo
-- =========================================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================================
-- ENUMS
-- =========================================================================
CREATE TYPE public.orcamento_status AS ENUM (
  'rascunho', 'enviado', 'aprovado', 'recusado', 'expirado', 'convertido'
);

CREATE TYPE public.pedido_status AS ENUM (
  'aguardando_producao', 'em_producao', 'pronto', 'entregue', 'cancelado'
);

CREATE TYPE public.pagamento_status AS ENUM (
  'pendente', 'pago', 'parcial', 'estornado', 'cancelado'
);

CREATE TYPE public.forma_pagamento AS ENUM (
  'dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'transferencia', 'boleto', 'outro'
);

CREATE TYPE public.produto_tipo AS ENUM (
  'moldura', 'vidro', 'paspatur', 'fundo', 'acessorio', 'servico', 'outro'
);

CREATE TYPE public.historico_acao AS ENUM (
  'criado', 'atualizado', 'excluido', 'status_alterado'
);

-- =========================================================================
-- FUNÇÕES UTILITÁRIAS
-- =========================================================================

-- Atualiza updated_at em UPDATE
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- =========================================================================
-- TABELA: clientes
-- =========================================================================
CREATE TABLE public.clientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  telefone      TEXT,
  whatsapp      TEXT,
  email         TEXT,
  cpf_cnpj      TEXT,
  observacoes   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clientes_nome_nao_vazio CHECK (length(btrim(nome)) > 0)
);

CREATE INDEX idx_clientes_nome      ON public.clientes (lower(nome));
CREATE INDEX idx_clientes_cpf_cnpj  ON public.clientes (cpf_cnpj) WHERE cpf_cnpj IS NOT NULL;
CREATE INDEX idx_clientes_email     ON public.clientes (lower(email)) WHERE email IS NOT NULL;

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO anon, authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open access clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- TABELA: produtos
-- =========================================================================
CREATE TABLE public.produtos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        TEXT UNIQUE,
  nome          TEXT NOT NULL,
  tipo          public.produto_tipo NOT NULL DEFAULT 'moldura',
  descricao     TEXT,
  unidade       TEXT NOT NULL DEFAULT 'm',           -- m, m2, un, etc
  preco_custo   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (preco_custo >= 0),
  preco_venda   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (preco_venda >= 0),
  estoque       NUMERIC(12,3) NOT NULL DEFAULT 0,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  observacoes   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_produtos_tipo  ON public.produtos (tipo);
CREATE INDEX idx_produtos_ativo ON public.produtos (ativo);
CREATE INDEX idx_produtos_nome  ON public.produtos (lower(nome));

CREATE TRIGGER trg_produtos_updated_at
  BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO anon, authenticated;
GRANT ALL ON public.produtos TO service_role;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open access produtos" ON public.produtos FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- TABELA: orcamentos
-- =========================================================================
CREATE SEQUENCE public.seq_orcamento_numero START 1000;

CREATE TABLE public.orcamentos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  numero_orcamento  INTEGER NOT NULL UNIQUE DEFAULT nextval('public.seq_orcamento_numero'),
  status            public.orcamento_status NOT NULL DEFAULT 'rascunho',
  valor_total       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  validade          DATE,
  observacoes       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER SEQUENCE public.seq_orcamento_numero OWNED BY public.orcamentos.numero_orcamento;

CREATE INDEX idx_orcamentos_cliente ON public.orcamentos (cliente_id);
CREATE INDEX idx_orcamentos_status  ON public.orcamentos (status);
CREATE INDEX idx_orcamentos_created ON public.orcamentos (created_at DESC);

CREATE TRIGGER trg_orcamentos_updated_at
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO anon, authenticated;
GRANT ALL ON public.orcamentos TO service_role;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open access orcamentos" ON public.orcamentos FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- TABELA: orcamento_itens
-- =========================================================================
CREATE TABLE public.orcamento_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id    UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  produto_id      UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao       TEXT,
  quantidade      INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  largura_cm      NUMERIC(8,2) CHECK (largura_cm IS NULL OR largura_cm > 0),
  altura_cm       NUMERIC(8,2) CHECK (altura_cm IS NULL OR altura_cm > 0),
  valor_unitario  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  valor_total     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orcamento_itens_orcamento ON public.orcamento_itens (orcamento_id);
CREATE INDEX idx_orcamento_itens_produto   ON public.orcamento_itens (produto_id);

CREATE TRIGGER trg_orcamento_itens_updated_at
  BEFORE UPDATE ON public.orcamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_itens TO anon, authenticated;
GRANT ALL ON public.orcamento_itens TO service_role;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open access orcamento_itens" ON public.orcamento_itens FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- TABELA: pedidos
-- =========================================================================
CREATE SEQUENCE public.seq_pedido_numero START 1000;

CREATE TABLE public.pedidos (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id              UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  orcamento_id            UUID REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  numero_pedido           INTEGER NOT NULL UNIQUE DEFAULT nextval('public.seq_pedido_numero'),
  status                  public.pedido_status NOT NULL DEFAULT 'aguardando_producao',
  valor_total             NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  data_entrega_prevista   DATE,
  data_entrega_realizada  DATE,
  observacoes             TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER SEQUENCE public.seq_pedido_numero OWNED BY public.pedidos.numero_pedido;

CREATE INDEX idx_pedidos_cliente   ON public.pedidos (cliente_id);
CREATE INDEX idx_pedidos_orcamento ON public.pedidos (orcamento_id);
CREATE INDEX idx_pedidos_status    ON public.pedidos (status);
CREATE INDEX idx_pedidos_entrega   ON public.pedidos (data_entrega_prevista);
CREATE INDEX idx_pedidos_created   ON public.pedidos (created_at DESC);

CREATE TRIGGER trg_pedidos_updated_at
  BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO anon, authenticated;
GRANT ALL ON public.pedidos TO service_role;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open access pedidos" ON public.pedidos FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- TABELA: pedido_itens
-- =========================================================================
CREATE TABLE public.pedido_itens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id       UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id      UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao       TEXT,
  quantidade      INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  largura_cm      NUMERIC(8,2) CHECK (largura_cm IS NULL OR largura_cm > 0),
  altura_cm       NUMERIC(8,2) CHECK (altura_cm IS NULL OR altura_cm > 0),
  valor_unitario  NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  valor_total     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedido_itens_pedido  ON public.pedido_itens (pedido_id);
CREATE INDEX idx_pedido_itens_produto ON public.pedido_itens (produto_id);

CREATE TRIGGER trg_pedido_itens_updated_at
  BEFORE UPDATE ON public.pedido_itens
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_itens TO anon, authenticated;
GRANT ALL ON public.pedido_itens TO service_role;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open access pedido_itens" ON public.pedido_itens FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- TABELA: pagamentos
-- =========================================================================
CREATE TABLE public.pagamentos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id        UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  valor            NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  forma_pagamento  public.forma_pagamento NOT NULL,
  status           public.pagamento_status NOT NULL DEFAULT 'pendente',
  data_pagamento   TIMESTAMPTZ,
  observacoes      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pagamentos_pedido ON public.pagamentos (pedido_id);
CREATE INDEX idx_pagamentos_status ON public.pagamentos (status);
CREATE INDEX idx_pagamentos_data   ON public.pagamentos (data_pagamento DESC);

CREATE TRIGGER trg_pagamentos_updated_at
  BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pagamentos TO anon, authenticated;
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open access pagamentos" ON public.pagamentos FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- TABELA: historico (auditoria automática)
-- =========================================================================
CREATE TABLE public.historico (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade     TEXT NOT NULL,
  entidade_id  UUID NOT NULL,
  usuario      TEXT,
  acao         public.historico_acao NOT NULL,
  descricao    TEXT,
  dados_antes  JSONB,
  dados_depois JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_historico_entidade ON public.historico (entidade, entidade_id);
CREATE INDEX idx_historico_created  ON public.historico (created_at DESC);

GRANT SELECT, INSERT ON public.historico TO anon, authenticated;
GRANT ALL ON public.historico TO service_role;
ALTER TABLE public.historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev open access historico" ON public.historico FOR ALL USING (true) WITH CHECK (true);

-- =========================================================================
-- TRIGGER GENÉRICO DE AUDITORIA
-- =========================================================================
CREATE OR REPLACE FUNCTION public.tg_audit_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao     public.historico_acao;
  v_id       UUID;
  v_usuario  TEXT;
  v_descricao TEXT;
BEGIN
  v_usuario := COALESCE(current_setting('request.jwt.claim.email', true), 'sistema');

  IF TG_OP = 'INSERT' THEN
    v_acao := 'criado';
    v_id := NEW.id;
    v_descricao := TG_TABLE_NAME || ' criado(a)';
    INSERT INTO public.historico (entidade, entidade_id, usuario, acao, descricao, dados_depois)
    VALUES (TG_TABLE_NAME, v_id, v_usuario, v_acao, v_descricao, to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF to_jsonb(NEW) = to_jsonb(OLD) THEN
      RETURN NEW;
    END IF;
    v_id := NEW.id;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      v_acao := 'status_alterado';
      v_descricao := 'status: ' || OLD.status::text || ' → ' || NEW.status::text;
    ELSE
      v_acao := 'atualizado';
      v_descricao := TG_TABLE_NAME || ' atualizado(a)';
    END IF;
    INSERT INTO public.historico (entidade, entidade_id, usuario, acao, descricao, dados_antes, dados_depois)
    VALUES (TG_TABLE_NAME, v_id, v_usuario, v_acao, v_descricao, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'excluido';
    v_id := OLD.id;
    v_descricao := TG_TABLE_NAME || ' excluído(a)';
    INSERT INTO public.historico (entidade, entidade_id, usuario, acao, descricao, dados_antes)
    VALUES (TG_TABLE_NAME, v_id, v_usuario, v_acao, v_descricao, to_jsonb(OLD));
    RETURN OLD;
  END IF;

  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Auditoria nunca deve quebrar a operação principal
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Variação para tabelas SEM coluna `status`
CREATE OR REPLACE FUNCTION public.tg_audit_historico_simples()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acao public.historico_acao;
  v_id UUID;
  v_usuario TEXT;
BEGIN
  v_usuario := COALESCE(current_setting('request.jwt.claim.email', true), 'sistema');

  IF TG_OP = 'INSERT' THEN
    v_acao := 'criado'; v_id := NEW.id;
    INSERT INTO public.historico (entidade, entidade_id, usuario, acao, descricao, dados_depois)
    VALUES (TG_TABLE_NAME, v_id, v_usuario, v_acao, TG_TABLE_NAME || ' criado(a)', to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
    v_acao := 'atualizado'; v_id := NEW.id;
    INSERT INTO public.historico (entidade, entidade_id, usuario, acao, descricao, dados_antes, dados_depois)
    VALUES (TG_TABLE_NAME, v_id, v_usuario, v_acao, TG_TABLE_NAME || ' atualizado(a)', to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    v_acao := 'excluido'; v_id := OLD.id;
    INSERT INTO public.historico (entidade, entidade_id, usuario, acao, descricao, dados_antes)
    VALUES (TG_TABLE_NAME, v_id, v_usuario, v_acao, TG_TABLE_NAME || ' excluído(a)', to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplica triggers de auditoria
CREATE TRIGGER trg_audit_clientes        AFTER INSERT OR UPDATE OR DELETE ON public.clientes        FOR EACH ROW EXECUTE FUNCTION public.tg_audit_historico_simples();
CREATE TRIGGER trg_audit_produtos        AFTER INSERT OR UPDATE OR DELETE ON public.produtos        FOR EACH ROW EXECUTE FUNCTION public.tg_audit_historico_simples();
CREATE TRIGGER trg_audit_orcamentos      AFTER INSERT OR UPDATE OR DELETE ON public.orcamentos      FOR EACH ROW EXECUTE FUNCTION public.tg_audit_historico();
CREATE TRIGGER trg_audit_orcamento_itens AFTER INSERT OR UPDATE OR DELETE ON public.orcamento_itens FOR EACH ROW EXECUTE FUNCTION public.tg_audit_historico_simples();
CREATE TRIGGER trg_audit_pedidos         AFTER INSERT OR UPDATE OR DELETE ON public.pedidos         FOR EACH ROW EXECUTE FUNCTION public.tg_audit_historico();
CREATE TRIGGER trg_audit_pedido_itens    AFTER INSERT OR UPDATE OR DELETE ON public.pedido_itens    FOR EACH ROW EXECUTE FUNCTION public.tg_audit_historico_simples();
CREATE TRIGGER trg_audit_pagamentos      AFTER INSERT OR UPDATE OR DELETE ON public.pagamentos      FOR EACH ROW EXECUTE FUNCTION public.tg_audit_historico();
