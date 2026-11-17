-- ============================================================================
-- MIGRATION: Fase A — Autenticação, Usuários Internos, Perfis e Permissões (RBAC)
-- Data: 2026-11-15 (Revisada em 2026-11-16)
-- Descrição:
--   1. Garante função utilitária `tg_set_updated_at()` para compatibilidade com PostgreSQL local.
--   2. Cria modelo interno de usuários (`app_users`) independente de provedor.
--   3. Cria vínculo desacoplado de identidades (`auth_identities`) sem FK para `auth.users`.
--   4. Cria tabelas de perfis (`roles`), permissões (`permissions`), vínculos
--      (`user_roles`, `role_permissions`) e auditoria de segurança (`auth_audit_log`).
--   5. Define funções auxiliares (`current_app_user_id`, `app_user_has_permission`,
--      `current_user_has_permission`, `has_any_active_admin`, `bootstrap_first_admin`,
--      `link_and_touch_current_identity`) e políticas RLS estritas (sem bypass aberto).
--   6. Executa seed idempotente dos 6 perfis iniciais e 63 permissões granulares.
-- ============================================================================

-- 0. COMPATIBILIDADE POSTGRESQL LOCAL: Função utilitária de updated_at
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
-- 8. FUNÇÕES AUXILIARES DE IDENTIDADE, AUTORIZAÇÃO E BOOTSTRAP ATÔMICO
-- ============================================================================

-- Obtém o ID do usuário interno (`app_users.id`) correspondente à sessão/JWT atual.
-- Compatível tanto com Supabase PostgREST (`request.jwt.claim.*` / `request.jwt.claims`)
-- quanto com PostgreSQL local futuro (`app.current_user_id`).
CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_local_uid  TEXT;
  v_claims_raw TEXT;
  v_sub        TEXT;
  v_email      TEXT;
  v_uid        UUID;
BEGIN
  v_local_uid := NULLIF(btrim(COALESCE(current_setting('app.current_user_id', true), '')), '');
  IF v_local_uid IS NOT NULL AND v_local_uid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN v_local_uid::uuid;
  END IF;

  v_claims_raw := NULLIF(btrim(COALESCE(current_setting('request.jwt.claims', true), '')), '');

  v_sub := NULLIF(
    btrim(
      COALESCE(
        NULLIF(current_setting('request.jwt.claim.sub', true), ''),
        CASE WHEN v_claims_raw IS NOT NULL THEN v_claims_raw::jsonb ->> 'sub' ELSE NULL END,
        ''
      )
    ),
    ''
  );

  v_email := NULLIF(
    lower(
      btrim(
        COALESCE(
          NULLIF(current_setting('request.jwt.claim.email', true), ''),
          CASE WHEN v_claims_raw IS NOT NULL THEN v_claims_raw::jsonb ->> 'email' ELSE NULL END,
          ''
        )
      )
    ),
    ''
  );

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

-- Verifica se o usuário interno da sessão atual possui status 'active'
CREATE OR REPLACE FUNCTION public.is_current_app_user_active()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_users u
    WHERE u.id = public.current_app_user_id()
      AND u.status = 'active'
  );
$$;

-- Verifica se o usuário interno da sessão atual possui vínculo com determinado perfil
CREATE OR REPLACE FUNCTION public.current_app_user_has_role(p_role_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.app_users u ON u.id = ur.user_id
    WHERE ur.role_id = p_role_id
      AND ur.user_id = public.current_app_user_id()
      AND u.status IN ('active', 'invited')
  );
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

-- Verifica se determinado usuário (`p_user_id`) está ativo e possui uma permissão granular
CREATE OR REPLACE FUNCTION public.app_user_has_permission(
  p_user_id UUID,
  p_permission_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL OR NULLIF(btrim(COALESCE(p_permission_code, '')), '') IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.app_users u WHERE u.id = p_user_id AND u.status = 'active'
  ) THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    LEFT JOIN public.role_permissions rp ON rp.role_id = r.id
    LEFT JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
      AND r.active = true
      AND (r.code = 'admin' OR p.code = p_permission_code)
  );
END;
$$;

-- Sobrecarga conveniente para políticas RLS usando o usuário autenticado atual
CREATE OR REPLACE FUNCTION public.app_user_has_permission(p_permission_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_user_has_permission(public.current_app_user_id(), p_permission_code);
$$;

-- Alias mantido para compatibilidade com referências existentes
CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_permission_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_user_has_permission(public.current_app_user_id(), p_permission_code);
$$;

-- Vínculo seguro e atualização de último acesso apenas da própria identidade autenticada
-- (impede que usuários comuns precisem de permissão de UPDATE direta em `app_users` ou `auth_identities`)
CREATE OR REPLACE FUNCTION public.link_and_touch_current_identity(p_provider TEXT DEFAULT 'supabase')
RETURNS public.auth_identities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims_raw     TEXT;
  v_sub            TEXT;
  v_email          TEXT;
  v_clean_provider TEXT;
  v_user_id        UUID;
  v_status         TEXT;
  v_identity       public.auth_identities;
BEGIN
  v_clean_provider := lower(btrim(COALESCE(p_provider, 'supabase')));
  IF length(v_clean_provider) = 0 THEN
    v_clean_provider := 'supabase';
  END IF;

  v_claims_raw := NULLIF(btrim(COALESCE(current_setting('request.jwt.claims', true), '')), '');
  v_sub := NULLIF(
    btrim(
      COALESCE(
        NULLIF(current_setting('request.jwt.claim.sub', true), ''),
        CASE WHEN v_claims_raw IS NOT NULL THEN v_claims_raw::jsonb ->> 'sub' ELSE NULL END,
        ''
      )
    ),
    ''
  );
  v_email := NULLIF(
    lower(
      btrim(
        COALESCE(
          NULLIF(current_setting('request.jwt.claim.email', true), ''),
          CASE WHEN v_claims_raw IS NOT NULL THEN v_claims_raw::jsonb ->> 'email' ELSE NULL END,
          ''
        )
      )
    ),
    ''
  );

  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Identidade JWT ausente para vínculo.' USING ERRCODE = '42501';
  END IF;

  SELECT ai.app_user_id INTO v_user_id
  FROM public.auth_identities ai
  WHERE ai.provider = v_clean_provider
    AND ai.provider_subject = v_sub
  LIMIT 1;

  IF v_user_id IS NULL AND v_email IS NOT NULL THEN
    SELECT u.id INTO v_user_id
    FROM public.app_users u
    WHERE lower(u.email) = v_email
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário interno não encontrado em app_users.' USING ERRCODE = '42501';
  END IF;

  SELECT u.status INTO v_status
  FROM public.app_users u
  WHERE u.id = v_user_id;

  IF v_status NOT IN ('active', 'invited') THEN
    RAISE EXCEPTION 'Conta inativa ou suspensa.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.auth_identities ai
    WHERE ai.provider = v_clean_provider
      AND ai.provider_subject = v_sub
      AND ai.app_user_id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'Identidade externa já vinculada a outro usuário.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.auth_identities (
    app_user_id,
    provider,
    provider_subject,
    last_authenticated_at
  )
  VALUES (v_user_id, v_clean_provider, v_sub, now())
  ON CONFLICT (provider, provider_subject) DO UPDATE SET
    last_authenticated_at = now()
  RETURNING * INTO v_identity;

  UPDATE public.app_users
  SET last_login_at = now(),
      status = CASE WHEN status = 'invited' THEN 'active' ELSE status END
  WHERE id = v_user_id;

  RETURN v_identity;
END;
$$;

-- Provisionamento atômico e protegido contra concorrência do primeiro administrador.
-- Acesso restrito a `service_role` (ou DBA/owner no PostgreSQL local) — nunca exposto a `anon` ou `authenticated`.
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(
  p_name TEXT,
  p_email TEXT,
  p_provider TEXT,
  p_provider_subject TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean_name     TEXT;
  v_clean_email    TEXT;
  v_clean_provider TEXT;
  v_clean_subject  TEXT;
  v_admin_role_id  UUID;
  v_user_id        UUID;
BEGIN
  v_clean_name := btrim(COALESCE(p_name, ''));
  v_clean_email := lower(btrim(COALESCE(p_email, '')));
  v_clean_provider := lower(btrim(COALESCE(p_provider, 'supabase')));
  v_clean_subject := btrim(COALESCE(p_provider_subject, ''));

  IF length(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'Nome inválido para o primeiro administrador (mínimo 2 caracteres).'
      USING ERRCODE = 'P0001';
  END IF;

  IF length(v_clean_email) < 3 OR position('@' IN v_clean_email) = 0 THEN
    RAISE EXCEPTION 'E-mail inválido para o primeiro administrador.'
      USING ERRCODE = 'P0001';
  END IF;

  IF length(v_clean_provider) = 0 OR length(v_clean_subject) = 0 THEN
    RAISE EXCEPTION 'Identidade externa inválida para bootstrap.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Lock transacional exclusivo para impedir corrida entre duas requisições simultâneas
  PERFORM pg_advisory_xact_lock(hashtext('art_frame_hub_bootstrap_first_admin'));
  LOCK TABLE public.app_users IN EXCLUSIVE MODE;

  -- Verificação atômica: exige inexistência total de usuários e ausência de administrador ativo
  IF EXISTS (SELECT 1 FROM public.app_users LIMIT 1) OR public.has_any_active_admin() THEN
    RAISE EXCEPTION 'BOOTSTRAP_ALREADY_COMPLETED: o sistema já possui usuários ou administrador provisionado.'
      USING ERRCODE = '42501';
  END IF;

  SELECT r.id INTO v_admin_role_id
  FROM public.roles r
  WHERE r.code = 'admin' AND r.active = true
  LIMIT 1;

  IF v_admin_role_id IS NULL THEN
    RAISE EXCEPTION 'Perfil "admin" não encontrado ou inativo na tabela roles.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.app_users (name, email, status, last_login_at)
  VALUES (v_clean_name, v_clean_email, 'active', now())
  RETURNING id INTO v_user_id;

  INSERT INTO public.auth_identities (
    app_user_id,
    provider,
    provider_subject,
    last_authenticated_at
  )
  VALUES (v_user_id, v_clean_provider, v_clean_subject, now());

  INSERT INTO public.user_roles (user_id, role_id, assigned_by)
  VALUES (v_user_id, v_admin_role_id, v_user_id);

  INSERT INTO public.auth_audit_log (
    user_id,
    actor_user_id,
    event_type,
    description,
    ip_address,
    user_agent,
    metadata
  )
  VALUES (
    v_user_id,
    v_user_id,
    'FIRST_ADMIN_PROVISIONED',
    format('Primeiro administrador provisionado no sistema: "%s" (%s).', v_clean_name, v_clean_email),
    p_ip_address,
    p_user_agent,
    jsonb_build_object(
      'email', v_clean_email,
      'provider', v_clean_provider,
      'role', 'admin',
      'atomic_bootstrap', true
    )
  );

  RETURN v_user_id;
END;
$$;

-- ============================================================================
-- 9. GRANTS (COMPATÍVEL COM SUPABASE E POSTGRESQL LOCAL) E POLÍTICAS RLS
-- ============================================================================

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_current_app_user_active() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_user_has_role(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_any_active_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_user_has_permission(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_user_has_permission(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_has_permission(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.link_and_touch_current_identity(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON public.app_users, public.auth_identities, public.roles, public.permissions, public.user_roles, public.role_permissions, public.auth_audit_log FROM anon;
    GRANT INSERT ON public.auth_audit_log TO anon;
    GRANT EXECUTE ON FUNCTION public.has_any_active_admin() TO anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON public.app_users, public.auth_identities, public.roles, public.permissions, public.user_roles, public.role_permissions, public.auth_audit_log FROM authenticated;
    GRANT SELECT ON public.permissions, public.roles, public.role_permissions TO authenticated;
    GRANT INSERT, UPDATE, DELETE ON public.roles, public.role_permissions TO authenticated;
    GRANT SELECT, INSERT, UPDATE ON public.app_users, public.auth_identities TO authenticated;
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
    GRANT SELECT, INSERT ON public.auth_audit_log TO authenticated;

    GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.is_current_app_user_active() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.current_app_user_has_role(UUID) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.has_any_active_admin() TO authenticated;
    GRANT EXECUTE ON FUNCTION public.app_user_has_permission(UUID, TEXT) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.app_user_has_permission(TEXT) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.current_user_has_permission(TEXT) TO authenticated;
    GRANT EXECUTE ON FUNCTION public.link_and_touch_current_identity(TEXT) TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON public.app_users, public.auth_identities, public.roles, public.permissions, public.user_roles, public.role_permissions, public.auth_audit_log TO service_role;
    GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO service_role;
    GRANT EXECUTE ON FUNCTION public.is_current_app_user_active() TO service_role;
    GRANT EXECUTE ON FUNCTION public.current_app_user_has_role(UUID) TO service_role;
    GRANT EXECUTE ON FUNCTION public.has_any_active_admin() TO service_role;
    GRANT EXECUTE ON FUNCTION public.app_user_has_permission(UUID, TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.app_user_has_permission(TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.current_user_has_permission(TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.link_and_touch_current_identity(TEXT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
  END IF;
END
$$;

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Policies para `permissions` (catálogo somente leitura restrito a usuários internos ativos)
DROP POLICY IF EXISTS "permissions_select_policy" ON public.permissions;
CREATE POLICY "permissions_select_policy" ON public.permissions
  FOR SELECT
  USING (public.is_current_app_user_active());

-- Policies para `roles`
DROP POLICY IF EXISTS "roles_select_policy" ON public.roles;
CREATE POLICY "roles_select_policy" ON public.roles
  FOR SELECT
  USING (
    public.current_app_user_has_role(id)
    OR public.app_user_has_permission('perfis.view')
    OR public.app_user_has_permission('roles.manage')
    OR public.app_user_has_permission('usuarios.view')
  );

DROP POLICY IF EXISTS "roles_write_policy" ON public.roles;
CREATE POLICY "roles_write_policy" ON public.roles
  FOR ALL
  USING (
    public.app_user_has_permission('roles.manage')
    OR public.app_user_has_permission('perfis.create')
    OR public.app_user_has_permission('perfis.update')
    OR public.app_user_has_permission('perfis.delete')
  )
  WITH CHECK (
    public.app_user_has_permission('roles.manage')
    OR public.app_user_has_permission('perfis.create')
    OR public.app_user_has_permission('perfis.update')
    OR public.app_user_has_permission('perfis.delete')
  );

-- Policies para `role_permissions`
DROP POLICY IF EXISTS "role_permissions_select_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_select_policy" ON public.role_permissions
  FOR SELECT
  USING (
    public.current_app_user_has_role(role_id)
    OR public.app_user_has_permission('perfis.view')
    OR public.app_user_has_permission('roles.manage')
    OR public.app_user_has_permission('permissions.manage')
  );

DROP POLICY IF EXISTS "role_permissions_write_policy" ON public.role_permissions;
CREATE POLICY "role_permissions_write_policy" ON public.role_permissions
  FOR ALL
  USING (
    public.app_user_has_permission('permissions.manage')
    OR public.app_user_has_permission('roles.manage')
  )
  WITH CHECK (
    public.app_user_has_permission('permissions.manage')
    OR public.app_user_has_permission('roles.manage')
  );

-- Policies para `app_users` (sem bypass de bootstrap aberto)
DROP POLICY IF EXISTS "app_users_select_policy" ON public.app_users;
CREATE POLICY "app_users_select_policy" ON public.app_users
  FOR SELECT
  USING (
    id = public.current_app_user_id()
    OR public.app_user_has_permission('usuarios.view')
  );

DROP POLICY IF EXISTS "app_users_insert_policy" ON public.app_users;
CREATE POLICY "app_users_insert_policy" ON public.app_users
  FOR INSERT
  WITH CHECK (public.app_user_has_permission('usuarios.create'));

DROP POLICY IF EXISTS "app_users_update_policy" ON public.app_users;
CREATE POLICY "app_users_update_policy" ON public.app_users
  FOR UPDATE
  USING (
    public.app_user_has_permission('usuarios.update')
    OR public.app_user_has_permission('usuarios.deactivate')
  )
  WITH CHECK (
    public.app_user_has_permission('usuarios.update')
    OR public.app_user_has_permission('usuarios.deactivate')
  );

-- Policies para `auth_identities` (escrita restrita a gestores; auto-vínculo via RPC `link_and_touch_current_identity`)
DROP POLICY IF EXISTS "auth_identities_select_policy" ON public.auth_identities;
CREATE POLICY "auth_identities_select_policy" ON public.auth_identities
  FOR SELECT
  USING (
    app_user_id = public.current_app_user_id()
    OR public.app_user_has_permission('usuarios.view')
  );

DROP POLICY IF EXISTS "auth_identities_write_policy" ON public.auth_identities;
CREATE POLICY "auth_identities_write_policy" ON public.auth_identities
  FOR ALL
  USING (
    public.app_user_has_permission('usuarios.create')
    OR public.app_user_has_permission('usuarios.update')
  )
  WITH CHECK (
    public.app_user_has_permission('usuarios.create')
    OR public.app_user_has_permission('usuarios.update')
  );

-- Policies para `user_roles` (sem bypass de bootstrap aberto)
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
CREATE POLICY "user_roles_select_policy" ON public.user_roles
  FOR SELECT
  USING (
    user_id = public.current_app_user_id()
    OR public.app_user_has_permission('usuarios.view')
    OR public.app_user_has_permission('perfis.view')
    OR public.app_user_has_permission('roles.manage')
  );

DROP POLICY IF EXISTS "user_roles_write_policy" ON public.user_roles;
CREATE POLICY "user_roles_write_policy" ON public.user_roles
  FOR ALL
  USING (
    public.app_user_has_permission('usuarios.create')
    OR public.app_user_has_permission('usuarios.update')
    OR public.app_user_has_permission('roles.manage')
  )
  WITH CHECK (
    public.app_user_has_permission('usuarios.create')
    OR public.app_user_has_permission('usuarios.update')
    OR public.app_user_has_permission('roles.manage')
  );

-- Policies para `auth_audit_log` (Append-Only para inserção controlada; leitura restrita a gestores)
DROP POLICY IF EXISTS "auth_audit_log_select_policy" ON public.auth_audit_log;
CREATE POLICY "auth_audit_log_select_policy" ON public.auth_audit_log
  FOR SELECT
  USING (
    public.app_user_has_permission('usuarios.view')
    OR public.app_user_has_permission('historico.view')
  );

DROP POLICY IF EXISTS "auth_audit_log_insert_policy" ON public.auth_audit_log;
CREATE POLICY "auth_audit_log_insert_policy" ON public.auth_audit_log
  FOR INSERT
  WITH CHECK (
    length(btrim(event_type)) > 0
    AND length(btrim(description)) > 0
    AND (
      public.current_app_user_id() IS NOT NULL
      OR (
        user_id IS NULL
        AND actor_user_id IS NULL
        AND event_type IN ('LOGIN_FAILED', 'PASSWORD_RESET_REQUESTED', 'UNAUTHORIZED_ACCESS')
      )
      OR (
        event_type IN ('LOGIN_FAILED', 'LOGIN_SUCCESS', 'UNAUTHORIZED_ACCESS')
        AND NULLIF(
          btrim(
            COALESCE(
              NULLIF(current_setting('request.jwt.claim.sub', true), ''),
              CASE
                WHEN NULLIF(btrim(COALESCE(current_setting('request.jwt.claims', true), '')), '') IS NOT NULL
                THEN current_setting('request.jwt.claims', true)::jsonb ->> 'sub'
                ELSE NULL
              END,
              ''
            )
          ),
          ''
        ) IS NOT NULL
      )
    )
  );

-- ============================================================================
-- 10. SEED IDEMPOTENTE: PERFIS INICIAIS, PERMISSÕES E MATRIZ DE PERMISSÕES
-- ============================================================================

-- 10.1. Inserir Perfis Iniciais do Sistema (6 perfis)
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

-- 10.2. Inserir Catálogo de Permissões Granulares (63 permissões)
INSERT INTO public.permissions (code, name, module, description)
VALUES
  -- Dashboard (1)
  ('dashboard.view', 'Visualizar Dashboard', 'dashboard', 'Permite visualizar indicadores de faturamento, produção e alertas no Dashboard.'),

  -- Clientes (4)
  ('clientes.view',   'Visualizar Clientes', 'clientes', 'Permite listar, buscar e consultar clientes.'),
  ('clientes.create', 'Cadastrar Clientes',  'clientes', 'Permite cadastrar novos clientes.'),
  ('clientes.update', 'Editar Clientes',     'clientes', 'Permite atualizar dados de clientes existentes.'),
  ('clientes.delete', 'Excluir Clientes',    'clientes', 'Permite remover clientes sem pedidos vinculados.'),

  -- Produtos (6)
  ('produtos.view',        'Visualizar Produtos',              'produtos', 'Permite consultar catálogo de produtos, molduras e insumos.'),
  ('produtos.create',      'Cadastrar Produtos',               'produtos', 'Permite cadastrar produtos essenciais e de catálogo.'),
  ('produtos.update',      'Editar Produtos',                  'produtos', 'Permite editar preços, estoque e atributos de produtos.'),
  ('produtos.delete',      'Excluir Produtos',                 'produtos', 'Permite excluir produtos do catálogo.'),
  ('produtos.bulk_update', 'Atualização em Massa de Preços',   'produtos', 'Permite simular e aplicar reajustes de preço em lote.'),
  ('produtos.import',      'Importar Planilhas de Produtos',   'produtos', 'Permite importar catálogos XLSX de molduras e passe-partouts.'),

  -- Orçamentos (4)
  ('orcamentos.view',   'Visualizar Orçamentos', 'orcamentos', 'Permite visualizar orçamentos e usar a calculadora.'),
  ('orcamentos.create', 'Criar Orçamentos',      'orcamentos', 'Permite elaborar novos orçamentos.'),
  ('orcamentos.update', 'Editar Orçamentos',     'orcamentos', 'Permite atualizar orçamentos existentes.'),
  ('orcamentos.delete', 'Excluir Orçamentos',    'orcamentos', 'Permite excluir orçamentos.'),

  -- Pedidos (9)
  ('pedidos.view',     'Visualizar Pedidos',             'pedidos', 'Permite listar e visualizar detalhes de pedidos.'),
  ('pedidos.create',   'Criar Pedidos',                  'pedidos', 'Permite criar novos pedidos e itens.'),
  ('pedidos.update',   'Editar Pedidos',                 'pedidos', 'Permite editar pedidos e atualizar seus status operacionais.'),
  ('pedidos.delete',   'Excluir Pedidos',                'pedidos', 'Permite excluir pedidos.'),
  ('pedidos.approve',  'Aprovar Pedidos',                'pedidos', 'Permite aprovar orçamentos transformando-os em pedidos aprovados.'),
  ('pedidos.cancel',   'Cancelar / Reverter Aprovação',  'pedidos', 'Permite reverter aprovação de pedidos ou cancelá-los.'),
  ('pedidos.archive',  'Arquivar Pedidos',               'pedidos', 'Permite arquivar pedidos em orçamento em lote.'),
  ('pedidos.reopen',   'Reabrir / Retornar Pedidos',     'pedidos', 'Permite retornar pedidos de produção para aprovado.'),
  ('pedidos.whatsapp', 'Enviar Pedido por WhatsApp/PDF', 'pedidos', 'Permite gerar PDF e registrar envio de notificações via WhatsApp.'),

  -- Pagamentos (5)
  ('pagamentos.view',   'Visualizar Pagamentos',         'pagamentos', 'Permite consultar pagamentos e saldos financeiros.'),
  ('pagamentos.create', 'Registrar Pagamentos',          'pagamentos', 'Permite registrar novos recebimentos e sinais.'),
  ('pagamentos.update', 'Editar Pagamentos',             'pagamentos', 'Permite alterar status e valores de pagamentos.'),
  ('pagamentos.delete', 'Excluir Pagamentos',            'pagamentos', 'Permite remover lançamentos de pagamento.'),
  ('pagamentos.manage', 'Gerenciar Financeiro Completo', 'pagamentos', 'Permite gerenciar todas as operações financeiras e estornos.'),

  -- Estoque (7)
  ('estoque.view',           'Visualizar Estoque',             'estoque', 'Permite visualizar saldos de barras, retalhos, reservas e movimentações.'),
  ('estoque.create',         'Registrar Entrada de Estoque',   'estoque', 'Permite registrar entradas de materiais no estoque.'),
  ('estoque.update',         'Atualizar Estoque',              'estoque', 'Permite atualizar dados operacionais de estoque.'),
  ('estoque.delete',         'Excluir Registros de Estoque',   'estoque', 'Permite remover registros manuais de estoque quando aplicável.'),
  ('estoque.adjust',         'Ajustar Saldo de Estoque',       'estoque', 'Permite realizar ajustes manuais de entrada e baixa de barras.'),
  ('estoque.discard',        'Descartar Retalhos',             'estoque', 'Permite marcar retalhos disponíveis como descartados.'),
  ('estoque.manage_minimum', 'Gerenciar Estoque Mínimo',       'estoque', 'Permite configurar limites de estoque mínimo por produto e fabricante.'),

  -- Produção (12)
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

  -- Histórico (1)
  ('historico.view', 'Visualizar Histórico', 'historico', 'Permite consultar a trilha de auditoria de alterações do sistema.'),

  -- Configurações (3)
  ('configuracoes.view',   'Visualizar Configurações',          'configuracoes', 'Permite visualizar parâmetros do sistema.'),
  ('configuracoes.update', 'Atualizar Configurações',           'configuracoes', 'Permite alterar parâmetros de barra, perda de corte e parcelamento.'),
  ('configuracoes.manage', 'Gerenciar Configurações do Sistema','configuracoes', 'Permite administração completa das configurações globais.'),

  -- Usuários (5)
  ('usuarios.view',       'Visualizar Usuários',         'usuarios', 'Permite listar usuários, seus perfis e logs de acesso.'),
  ('usuarios.create',     'Criar / Convidar Usuários',   'usuarios', 'Permite cadastrar novos usuários e atribuir perfis.'),
  ('usuarios.update',     'Editar Usuários',             'usuarios', 'Permite atualizar dados cadastrais e perfis de usuários.'),
  ('usuarios.delete',     'Remover Vínculos de Usuário', 'usuarios', 'Permite gerenciar remoção lógica e vínculos de usuários.'),
  ('usuarios.deactivate', 'Ativar / Desativar Usuários', 'usuarios', 'Permite suspender, desativar ou reativar o acesso de usuários ao ERP.'),

  -- Perfis (6)
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
