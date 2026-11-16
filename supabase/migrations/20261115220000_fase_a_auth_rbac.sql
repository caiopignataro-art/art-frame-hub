-- ============================================================================
-- MIGRATION: Fase A — Autenticação, Usuários Internos, Perfis e Permissões (RBAC)
-- Data: 2026-11-15
-- Descrição:
--   1. Cria modelo interno de usuários (`app_users`) independente de provedor.
--   2. Cria vínculo desacoplado de identidades (`auth_identities`) sem FK para `auth.users`.
--   3. Cria tabelas de perfis (`roles`), permissões (`permissions`), vínculos
--      (`user_roles`, `role_permissions`) e auditoria de segurança (`auth_audit_log`).
--   4. Define funções auxiliares e políticas RLS restritivas (sem `USING (true)` aberto).
--   5. Executa seed idempotente dos 6 perfis iniciais e 56 permissões granulares.
-- ============================================================================

-- 1. TABELA: app_users (Cadastro interno de usuários do ERP)
CREATE TABLE IF NOT EXISTS public.app_users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL CHECK (length(btrim(name)) >= 2),
  email          TEXT NOT NULL CHECK (length(btrim(email)) >= 3),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'invited', 'suspended')),
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at  TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_lower ON public.app_users (lower(email));
CREATE INDEX IF NOT EXISTS idx_app_users_status ON public.app_users (status);

DROP TRIGGER IF EXISTS trg_app_users_updated_at ON public.app_users;
CREATE TRIGGER trg_app_users_updated_at
  BEFORE UPDATE ON public.app_users
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. TABELA: auth_identities (Vínculo desacoplado com provedor de autenticação)
-- Nota: `provider_subject` armazena o ID externo (ex.: `sub` do Supabase Auth ou ID local futuro)
-- sem Foreign Key para `auth.users`, permitindo migração transparente para PostgreSQL local.
CREATE TABLE IF NOT EXISTS public.auth_identities (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id           UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL CHECK (length(btrim(provider)) > 0),
  provider_subject      TEXT NOT NULL CHECK (length(btrim(provider_subject)) > 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_authenticated_at TIMESTAMPTZ,
  CONSTRAINT uq_auth_identities_provider_subject UNIQUE (provider, provider_subject)
);

CREATE INDEX IF NOT EXISTS idx_auth_identities_app_user_id ON public.auth_identities (app_user_id);

-- 3. TABELA: roles (Perfis de acesso)
CREATE TABLE IF NOT EXISTS public.roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE CHECK (length(btrim(code)) >= 2),
  name        TEXT NOT NULL CHECK (length(btrim(name)) >= 2),
  description TEXT,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roles_active ON public.roles (active);

DROP TRIGGER IF EXISTS trg_roles_updated_at ON public.roles;
CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 4. TABELA: permissions (Permissões granulares por módulo e operação)
CREATE TABLE IF NOT EXISTS public.permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT NOT NULL UNIQUE CHECK (length(btrim(code)) >= 3),
  name        TEXT NOT NULL CHECK (length(btrim(name)) >= 2),
  module      TEXT NOT NULL CHECK (length(btrim(module)) >= 2),
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions (module);

-- 5. TABELA: user_roles (Associação N:N entre usuários e perfis)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles (role_id);

-- 6. TABELA: role_permissions (Associação N:N entre perfis e permissões)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id       UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_role_permissions_role_perm UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions (role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON public.role_permissions (permission_id);

-- 7. TABELA: auth_audit_log (Trilha imutável de auditoria de segurança e acessos)
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  actor_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  event_type    TEXT NOT NULL CHECK (length(btrim(event_type)) > 0),
  description   TEXT NOT NULL CHECK (length(btrim(description)) > 0),
  ip_address    TEXT,
  user_agent    TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_log_user_id ON public.auth_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_event_type ON public.auth_audit_log (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_log_created_at ON public.auth_audit_log (created_at DESC);

-- ============================================================================
-- 8. FUNÇÕES AUXILIARES DE IDENTIDADE E AUTORIZAÇÃO (INDEPENDENTES DE auth.users)
-- ============================================================================

-- Obtém o ID do usuário interno (`app_users.id`) correspondente aos claims da requisição atual
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub   TEXT;
  v_email TEXT;
  v_uid   UUID;
BEGIN
  v_sub := NULLIF(current_setting('request.jwt.claim.sub', true), '');
  v_email := NULLIF(lower(current_setting('request.jwt.claim.email', true)), '');

  IF v_sub IS NOT NULL THEN
    SELECT ai.app_user_id INTO v_uid
    FROM public.auth_identities ai
    WHERE ai.provider_subject = v_sub
    LIMIT 1;

    IF v_uid IS NOT NULL THEN
      RETURN v_uid;
    END IF;
  END IF;

  IF v_email IS NOT NULL THEN
    SELECT u.id INTO v_uid
    FROM public.app_users u
    WHERE lower(u.email) = v_email
    LIMIT 1;
  END IF;

  RETURN v_uid;
END;
$$;

-- Verifica se já existe ao menos um administrador ativo cadastrado em `app_users`
CREATE OR REPLACE FUNCTION public.has_any_active_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.app_users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE u.status = 'active'
      AND r.code = 'admin'
      AND r.active = true
  );
END;
$$;

-- Verifica se o usuário autenticado atual está ativo e possui determinada permissão granular
CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_permission_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := public.current_app_user_id();
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Verifica se o usuário está ativo
  IF NOT EXISTS (
    SELECT 1 FROM public.app_users u WHERE u.id = v_uid AND u.status = 'active'
  ) THEN
    RETURN FALSE;
  END IF;

  -- Verifica se possui o perfil 'admin' ativo ou a permissão específica em um perfil ativo
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
    LEFT JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = v_uid
      AND r.active = true
      AND (r.code = 'admin' OR p.code = p_permission_code)
  );
END;
$$;

-- ============================================================================
-- 9. GRANTS E POLÍTICAS RLS RESTRITIVAS (SEM `USING (true)` ABERTO)
-- ============================================================================

GRANT SELECT ON public.permissions, public.roles, public.role_permissions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.roles, public.role_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.app_users, public.auth_identities TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT SELECT, INSERT ON public.auth_audit_log TO anon, authenticated;
GRANT ALL ON public.app_users, public.auth_identities, public.roles, public.permissions, public.user_roles, public.role_permissions, public.auth_audit_log TO service_role;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies para `permissions` (catálogo somente leitura para usuários autenticados ou bootstrap)
DROP POLICY IF EXISTS "permissions_select_policy" ON public.permissions;
CREATE POLICY "permissions_select_policy" ON public.permissions
  FOR SELECT
  USING (
    public.current_app_user_id() IS NOT NULL
    OR NOT public.has_any_active_admin()
  );

-- Policies para `roles`
DROP POLICY IF EXISTS "roles_select_policy" ON public.roles;
CREATE POLICY "roles_select_policy" ON public.roles
  FOR SELECT
  USING (
    public.current_app_user_id() IS NOT NULL
    OR NOT public.has_any_active_admin()
  );

DROP POLICY IF EXISTS "roles_write_policy" ON public.roles;
CREATE POLICY "roles_write_policy" ON public.roles
  FOR ALL
  USING (
    public.current_user_has_permission('roles.manage')
    OR public.current_user_has_permission('perfis.create')
    OR public.current_user_has_permission('perfis.update')
    OR public.current_user_has_permission('perfis.delete')
  )
  WITH CHECK (
    public.current_user_has_permission('roles.manage')
    OR public.current_user_has_permission('perfis.create')
    OR public.current_user_has_permission('perfis.update')
    OR public.current_user_has_permission('perfis.delete')
  );

-- Policies para `role_permissions`
DROP POLICY IF EXISTS "role_permissions_select_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_select_policy" ON public.role_permissions
  FOR SELECT
  USING (
    public.current_app_user_id() IS NOT NULL
    OR NOT public.has_any_active_admin()
  );

DROP POLICY IF EXISTS "role_permissions_write_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_write_policy" ON public.role_permissions
  FOR ALL
  USING (
    public.current_user_has_permission('permissions.manage')
    OR public.current_user_has_permission('roles.manage')
  )
  WITH CHECK (
    public.current_user_has_permission('permissions.manage')
    OR public.current_user_has_permission('roles.manage')
  );

-- Policies para `app_users`
DROP POLICY IF EXISTS "app_users_select_policy" ON public.app_users;
CREATE POLICY "app_users_select_policy" ON public.app_users
  FOR SELECT
  USING (
    id = public.current_app_user_id()
    OR public.current_user_has_permission('usuarios.view')
    OR NOT public.has_any_active_admin()
  );

DROP POLICY IF EXISTS "app_users_insert_policy" ON public.app_users;
CREATE POLICY "app_users_insert_policy" ON public.app_users
  FOR INSERT
  WITH CHECK (
    public.current_user_has_permission('usuarios.create')
    OR (
      NOT public.has_any_active_admin()
      AND NULLIF(current_setting('request.jwt.claim.sub', true), '') IS NOT NULL
    )
  );

DROP POLICY IF EXISTS "app_users_update_policy" ON public.app_users;
CREATE POLICY "app_users_update_policy" ON public.app_users
  FOR UPDATE
  USING (
    id = public.current_app_user_id()
    OR public.current_user_has_permission('usuarios.update')
    OR public.current_user_has_permission('usuarios.deactivate')
  )
  WITH CHECK (
    id = public.current_app_user_id()
    OR public.current_user_has_permission('usuarios.update')
    OR public.current_user_has_permission('usuarios.deactivate')
  );

-- Policies para `auth_identities`
DROP POLICY IF EXISTS "auth_identities_select_policy" ON public.auth_identities;
CREATE POLICY "auth_identities_select_policy" ON public.auth_identities
  FOR SELECT
  USING (
    app_user_id = public.current_app_user_id()
    OR public.current_user_has_permission('usuarios.view')
    OR NOT public.has_any_active_admin()
  );

DROP POLICY IF EXISTS "auth_identities_write_policy" ON public.auth_identities;
CREATE POLICY "auth_identities_write_policy" ON public.auth_identities
  FOR ALL
  USING (
    app_user_id = public.current_app_user_id()
    OR public.current_user_has_permission('usuarios.create')
    OR public.current_user_has_permission('usuarios.update')
    OR (
      NOT public.has_any_active_admin()
      AND NULLIF(current_setting('request.jwt.claim.sub', true), '') IS NOT NULL
    )
  )
  WITH CHECK (
    app_user_id = public.current_app_user_id()
    OR public.current_user_has_permission('usuarios.create')
    OR public.current_user_has_permission('usuarios.update')
    OR (
      NOT public.has_any_active_admin()
      AND NULLIF(current_setting('request.jwt.claim.sub', true), '') IS NOT NULL
    )
  );

-- Policies para `user_roles`
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
CREATE POLICY "user_roles_select_policy" ON public.user_roles
  FOR SELECT
  USING (
    user_id = public.current_app_user_id()
    OR public.current_user_has_permission('usuarios.view')
    OR public.current_user_has_permission('perfis.view')
    OR NOT public.has_any_active_admin()
  );

DROP POLICY IF EXISTS "user_roles_write_policy" ON public.user_roles;
CREATE POLICY "user_roles_write_policy" ON public.user_roles
  FOR ALL
  USING (
    public.current_user_has_permission('usuarios.create')
    OR public.current_user_has_permission('usuarios.update')
    OR public.current_user_has_permission('roles.manage')
    OR (
      NOT public.has_any_active_admin()
      AND NULLIF(current_setting('request.jwt.claim.sub', true), '') IS NOT NULL
    )
  )
  WITH CHECK (
    public.current_user_has_permission('usuarios.create')
    OR public.current_user_has_permission('usuarios.update')
    OR public.current_user_has_permission('roles.manage')
    OR (
      NOT public.has_any_active_admin()
      AND NULLIF(current_setting('request.jwt.claim.sub', true), '') IS NOT NULL
    )
  );

-- Policies para `auth_audit_log` (Append-Only para inserção; leitura restrita a gestores)
DROP POLICY IF EXISTS "auth_audit_log_select_policy" ON public.auth_audit_log;
CREATE POLICY "auth_audit_log_select_policy" ON public.auth_audit_log
  FOR SELECT
  USING (
    public.current_user_has_permission('usuarios.view')
    OR public.current_user_has_permission('historico.view')
  );

DROP POLICY IF EXISTS "auth_audit_log_insert_policy" ON public.auth_audit_log;
CREATE POLICY "auth_audit_log_insert_policy" ON public.auth_audit_log
  FOR INSERT
  WITH CHECK (
    length(btrim(event_type)) > 0
    AND length(btrim(description)) > 0
  );

-- ============================================================================
-- 10. SEED IDEMPOTENTE: PERFIS INICIAIS, PERMISSÕES E MATRIZ DE PERMISSÕES
-- ============================================================================

-- 10.1. Inserir Perfis Iniciais do Sistema
INSERT INTO public.roles (code, name, description, is_system, active)
VALUES
  ('admin',       'Administrador', 'Acesso total a todos os módulos, configurações, usuários e permissões do ERP.', true, true),
  ('atendimento', 'Atendimento',   'Gestão comercial de clientes, calculadora, orçamentos e operação de pedidos.', true, true),
  ('financeiro',  'Financeiro',    'Gestão completa de pagamentos, recebimentos e consulta comercial.', true, true),
  ('estoque',     'Estoque',       'Gestão total de estoque, retalhos, movimentações e operação do catálogo de produtos.', true, true),
  ('producao',    'Produção',      'Gestão total de Ordens de Produção (OP), preparação de itens, apontamentos e consumo de estoque.', true, true),
  ('consulta',    'Consulta',      'Acesso exclusivo de leitura e visualização aos módulos operacionais do ERP.', true, true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = true;

-- 10.2. Inserir Catálogo de Permissões Granulares
INSERT INTO public.permissions (code, name, module, description)
VALUES
  -- Dashboard
  ('dashboard.view', 'Visualizar Dashboard', 'dashboard', 'Permite visualizar indicadores de faturamento, produção e alertas no Dashboard.'),

  -- Clientes
  ('clientes.view',   'Visualizar Clientes', 'clientes', 'Permite listar, buscar e consultar clientes.'),
  ('clientes.create', 'Cadastrar Clientes',  'clientes', 'Permite cadastrar novos clientes.'),
  ('clientes.update', 'Editar Clientes',     'clientes', 'Permite atualizar dados de clientes existentes.'),
  ('clientes.delete', 'Excluir Clientes',    'clientes', 'Permite remover clientes sem pedidos vinculados.'),

  -- Produtos
  ('produtos.view',        'Visualizar Produtos',              'produtos', 'Permite consultar catálogo de produtos, molduras e insumos.'),
  ('produtos.create',      'Cadastrar Produtos',               'produtos', 'Permite cadastrar produtos essenciais e de catálogo.'),
  ('produtos.update',      'Editar Produtos',                  'produtos', 'Permite editar preços, estoque e atributos de produtos.'),
  ('produtos.delete',      'Excluir Produtos',                 'produtos', 'Permite excluir produtos do catálogo.'),
  ('produtos.bulk_update', 'Atualização em Massa de Preços',   'produtos', 'Permite simular e aplicar reajustes de preço em lote.'),
  ('produtos.import',      'Importar Planilhas de Produtos',   'produtos', 'Permite importar catálogos XLSX de molduras e passe-partouts.'),

  -- Orçamentos
  ('orcamentos.view',   'Visualizar Orçamentos', 'orcamentos', 'Permite visualizar orçamentos e usar a calculadora.'),
  ('orcamentos.create', 'Criar Orçamentos',      'orcamentos', 'Permite elaborar novos orçamentos.'),
  ('orcamentos.update', 'Editar Orçamentos',     'orcamentos', 'Permite atualizar orçamentos existentes.'),
  ('orcamentos.delete', 'Excluir Orçamentos',    'orcamentos', 'Permite excluir orçamentos.'),

  -- Pedidos
  ('pedidos.view',     'Visualizar Pedidos',             'pedidos', 'Permite listar e visualizar detalhes de pedidos.'),
  ('pedidos.create',   'Criar Pedidos',                  'pedidos', 'Permite criar novos pedidos e itens.'),
  ('pedidos.update',   'Editar Pedidos',                 'pedidos', 'Permite editar pedidos e atualizar seus status operacionais.'),
  ('pedidos.delete',   'Excluir Pedidos',                'pedidos', 'Permite excluir pedidos.'),
  ('pedidos.approve',  'Aprovar Pedidos',                'pedidos', 'Permite aprovar orçamentos transformando-os em pedidos aprovados.'),
  ('pedidos.cancel',   'Cancelar / Reverter Aprovação',  'pedidos', 'Permite reverter aprovação de pedidos ou cancelá-los.'),
  ('pedidos.archive',  'Arquivar Pedidos',               'pedidos', 'Permite arquivar pedidos em orçamento em lote.'),
  ('pedidos.reopen',   'Reabrir / Retornar Pedidos',     'pedidos', 'Permite retornar pedidos de produção para aprovado.'),
  ('pedidos.whatsapp', 'Enviar Pedido por WhatsApp/PDF', 'pedidos', 'Permite gerar PDF e registrar envio de notificações via WhatsApp.'),

  -- Pagamentos
  ('pagamentos.view',   'Visualizar Pagamentos',         'pagamentos', 'Permite consultar pagamentos e saldos financeiros.'),
  ('pagamentos.create', 'Registrar Pagamentos',          'pagamentos', 'Permite registrar novos recebimentos e sinais.'),
  ('pagamentos.update', 'Editar Pagamentos',             'pagamentos', 'Permite alterar status e valores de pagamentos.'),
  ('pagamentos.delete', 'Excluir Pagamentos',            'pagamentos', 'Permite remover lançamentos de pagamento.'),
  ('pagamentos.manage', 'Gerenciar Financeiro Completo', 'pagamentos', 'Permite gerenciar todas as operações financeiras e estornos.'),

  -- Estoque
  ('estoque.view',           'Visualizar Estoque',             'estoque', 'Permite visualizar saldos de barras, retalhos, reservas e movimentações.'),
  ('estoque.create',         'Registrar Entrada de Estoque',   'estoque', 'Permite registrar entradas de materiais no estoque.'),
  ('estoque.update',         'Atualizar Estoque',              'estoque', 'Permite atualizar dados operacionais de estoque.'),
  ('estoque.delete',         'Excluir Registros de Estoque',   'estoque', 'Permite remover registros manuais de estoque quando aplicável.'),
  ('estoque.adjust',         'Ajustar Saldo de Estoque',       'estoque', 'Permite realizar ajustes manuais de entrada e baixa de barras.'),
  ('estoque.discard',        'Descartar Retalhos',             'estoque', 'Permite marcar retalhos disponíveis como descartados.'),
  ('estoque.manage_minimum', 'Gerenciar Estoque Mínimo',       'estoque', 'Permite configurar limites de estoque mínimo por produto e fabricante.'),

  -- Produção
  ('producao.view',              'Visualizar Produção',                    'producao', 'Permite visualizar o Kanban de produção e Ordens de Produção (OP).'),
  ('producao.create',            'Criar Registros de Produção',            'producao', 'Permite iniciar fluxos de produção.'),
  ('producao.update',            'Atualizar Produção',                     'producao', 'Permite atualizar andamento de itens e pedidos na produção.'),
  ('producao.delete',            'Remover Registros de Produção',          'producao', 'Permite remover vínculos produtivos quando autorizado.'),
  ('producao.create_order',      'Criar Ordem de Produção (OP)',           'producao', 'Permite agrupar pedidos aprovados em uma nova Ordem de Produção.'),
  ('producao.prepare_component', 'Preparar Componentes na OP',             'producao', 'Permite marcar ou desmarcar componentes individuais como preparados.'),
  ('producao.mark_problem',      'Apontar Problemas na Produção',          'producao', 'Permite registrar e remover apontamentos de problema em itens da OP.'),
  ('producao.complete_item',     'Concluir Item de Produção',              'producao', 'Permite marcar um item completo da OP como pronto.'),
  ('producao.complete_order',    'Concluir Pedido / Ordem de Produção',    'producao', 'Permite concluir pedidos prontos na OP e finalizar a Ordem de Produção.'),
  ('producao.cancel_order',      'Cancelar Ordem de Produção',             'producao', 'Permite cancelar uma OP retornando seus pedidos para Aprovado.'),
  ('producao.archive_order',     'Arquivar Ordem de Produção',             'producao', 'Permite arquivar Ordens de Produção concluídas ou sem pedidos ativos.'),
  ('producao.remove_order_item', 'Remover Pedido de uma OP',               'producao', 'Permite desvincular seletivamente um pedido de uma Ordem de Produção.'),

  -- Histórico
  ('historico.view', 'Visualizar Histórico', 'historico', 'Permite consultar a trilha de auditoria de alterações do sistema.'),

  -- Configurações
  ('configuracoes.view',   'Visualizar Configurações',          'configuracoes', 'Permite visualizar parâmetros do sistema.'),
  ('configuracoes.update', 'Atualizar Configurações',           'configuracoes', 'Permite alterar parâmetros de barra, perda de corte e parcelamento.'),
  ('configuracoes.manage', 'Gerenciar Configurações do Sistema','configuracoes', 'Permite administração completa das configurações globais.'),

  -- Usuários
  ('usuarios.view',       'Visualizar Usuários',         'usuarios', 'Permite listar usuários, seus perfis e logs de acesso.'),
  ('usuarios.create',     'Criar / Convidar Usuários',   'usuarios', 'Permite cadastrar novos usuários e atribuir perfis.'),
  ('usuarios.update',     'Editar Usuários',             'usuarios', 'Permite atualizar dados cadastrais e perfis de usuários.'),
  ('usuarios.delete',     'Remover Vínculos de Usuário', 'usuarios', 'Permite gerenciar remoção lógica e vínculos de usuários.'),
  ('usuarios.deactivate', 'Ativar / Desativar Usuários', 'usuarios', 'Permite suspender, desativar ou reativar o acesso de usuários ao ERP.'),

  -- Perfis
  ('perfis.view',        'Visualizar Perfis e Permissões',     'perfis', 'Permite consultar perfis de acesso e matriz de permissões.'),
  ('perfis.create',      'Criar Perfis Personalizados',        'perfis', 'Permite criar novos perfis de acesso.'),
  ('perfis.update',      'Editar Perfis',                      'perfis', 'Permite editar nome, descrição e status de perfis.'),
  ('perfis.delete',      'Excluir Perfis Personalizados',      'perfis', 'Permite excluir perfis personalizados que não sejam de sistema.'),
  ('roles.manage',       'Gerenciar Perfis de Acesso',         'perfis', 'Permite administrar perfis e atribuí-los aos usuários.'),
  ('permissions.manage', 'Configurar Permissões de Perfis',    'perfis', 'Permite alterar as permissões granulares associadas a cada perfil.')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  description = EXCLUDED.description;

-- 10.3. Associar Permissões aos Perfis Iniciais (Matriz Inicial)

-- Administrador: Todas as permissões
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Atendimento
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'dashboard.view',
  'clientes.view', 'clientes.create', 'clientes.update', 'clientes.delete',
  'produtos.view',
  'orcamentos.view', 'orcamentos.create', 'orcamentos.update', 'orcamentos.delete',
  'pedidos.view', 'pedidos.create', 'pedidos.update', 'pedidos.approve', 'pedidos.archive', 'pedidos.whatsapp',
  'pagamentos.view', 'pagamentos.create',
  'estoque.view',
  'producao.view',
  'historico.view'
)
WHERE r.code = 'atendimento'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Financeiro
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'dashboard.view',
  'clientes.view',
  'produtos.view',
  'orcamentos.view',
  'pedidos.view',
  'pagamentos.view', 'pagamentos.create', 'pagamentos.update', 'pagamentos.delete', 'pagamentos.manage',
  'estoque.view',
  'historico.view'
)
WHERE r.code = 'financeiro'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Estoque
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'dashboard.view',
  'clientes.view',
  'produtos.view', 'produtos.create', 'produtos.update', 'produtos.bulk_update', 'produtos.import',
  'pedidos.view',
  'estoque.view', 'estoque.create', 'estoque.update', 'estoque.delete', 'estoque.adjust', 'estoque.discard', 'estoque.manage_minimum',
  'producao.view',
  'historico.view'
)
WHERE r.code = 'estoque'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Produção
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'dashboard.view',
  'clientes.view',
  'produtos.view',
  'pedidos.view', 'pedidos.update', 'pedidos.reopen',
  'estoque.view', 'estoque.update', 'estoque.discard',
  'producao.view', 'producao.create', 'producao.update', 'producao.delete',
  'producao.create_order', 'producao.prepare_component', 'producao.mark_problem',
  'producao.complete_item', 'producao.complete_order', 'producao.cancel_order',
  'producao.archive_order', 'producao.remove_order_item',
  'historico.view'
)
WHERE r.code = 'producao'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Consulta
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  'dashboard.view',
  'clientes.view',
  'produtos.view',
  'orcamentos.view',
  'pedidos.view',
  'pagamentos.view',
  'estoque.view',
  'producao.view',
  'historico.view'
)
WHERE r.code = 'consulta'
ON CONFLICT (role_id, permission_id) DO NOTHING;
