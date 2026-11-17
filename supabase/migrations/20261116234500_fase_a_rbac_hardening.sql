-- ============================================================================
-- MIGRATION INCREMENTAL: Fase A — Endurecimento Final do RBAC e Isolamento RLS
-- Data: 2026-11-16
-- Objetivo:
--   Aplicar correções de segurança incrementais sobre a migration original
--   `20261115220000_fase_a_auth_rbac.sql` sem recriar tabelas nem alterar dados.
--
-- Correções incluídas:
--   1. `current_app_user_id()` passa a exigir vínculo explícito por `(provider, provider_subject)`
--      em `auth_identities` (ou `app.current_user_id` no PostgreSQL local), removendo fallback
--      ambíguo por e-mail não verificado.
--   2. `link_and_touch_current_identity()` exige `email_verified = true` e `status = 'invited'`
--      sem vínculo prévio no provedor para qualquer auto-associação inicial por e-mail.
--   3. `app_user_has_permission(UUID, TEXT)` é restringida (revogada de `PUBLIC`/`anon`/`authenticated`
--      e protegida internamente contra consulta arbitrária de terceiros), preservando
--      `app_user_has_permission(TEXT)` e `current_user_has_permission(TEXT)` para o próprio usuário.
--   4. `auth_audit_log_insert_policy` exige `actor_user_id = public.current_app_user_id()` para
--      usuários autenticados e proíbe falsificação de `actor_user_id`/`user_id`.
--   5. Revoga integralmente leitura/escrita de `anon` nas 7 tabelas RBAC (mantendo apenas
--      `INSERT` pré-autenticação estritamente filtrado em `auth_audit_log`) e remove
--      bypasses `OR NOT public.has_any_active_admin()` das políticas RLS.
--   6. Garante `bootstrap_first_admin(...)` atômico e restrito a `service_role`/DBA local.
-- ============================================================================

-- 1. Função utilitária de timestamp (garante compatibilidade com PostgreSQL local)
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

-- 2. Resolução inequívoca de identidade interna (sem fallback por e-mail não vinculado)
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
  v_provider   TEXT;
  v_sub        TEXT;
  v_uid        UUID;
BEGIN
  v_local_uid := NULLIF(btrim(COALESCE(current_setting('app.current_user_id', true), '')), '');
  IF v_local_uid IS NOT NULL AND v_local_uid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN v_local_uid::uuid;
  END IF;

  v_claims_raw := NULLIF(btrim(COALESCE(current_setting('request.jwt.claims', true), '')), '');
  v_provider := COALESCE(
    NULLIF(lower(btrim(COALESCE(current_setting('app.current_auth_provider', true), ''))), ''),
    'supabase'
  );

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

  IF v_sub IS NOT NULL THEN
    SELECT ai.app_user_id INTO v_uid
    FROM public.auth_identities ai
    WHERE ai.provider = v_provider
      AND ai.provider_subject = v_sub
    LIMIT 1;
  END IF;

  RETURN v_uid;
END;
$$;

-- 3. Auxiliares de status e vínculo de perfil (SECURITY DEFINER para evitar recursão RLS)
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

-- 4. Verificação granular de permissão com proteção contra consulta arbitrária de terceiros
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
DECLARE
  v_claims_raw   TEXT;
  v_caller_role  TEXT;
  v_current_uid  UUID;
BEGIN
  IF p_user_id IS NULL OR NULLIF(btrim(COALESCE(p_permission_code, '')), '') IS NULL THEN
    RETURN FALSE;
  END IF;

  v_claims_raw := NULLIF(btrim(COALESCE(current_setting('request.jwt.claims', true), '')), '');
  v_caller_role := lower(
    btrim(
      COALESCE(
        NULLIF(current_setting('request.jwt.claim.role', true), ''),
        CASE WHEN v_claims_raw IS NOT NULL THEN COALESCE(v_claims_raw::jsonb ->> 'role', '') ELSE '' END,
        ''
      )
    )
  );
  v_current_uid := public.current_app_user_id();

  IF v_caller_role IN ('anon', 'authenticated')
     AND (v_current_uid IS NULL OR p_user_id IS DISTINCT FROM v_current_uid) THEN
    IF v_current_uid IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.app_users cu
      JOIN public.user_roles cur ON cur.user_id = cu.id
      JOIN public.roles cr ON cr.id = cur.role_id
      LEFT JOIN public.role_permissions crp ON crp.role_id = cr.id
      LEFT JOIN public.permissions cp ON cp.id = crp.permission_id
      WHERE cu.id = v_current_uid
        AND cu.status = 'active'
        AND cr.active = true
        AND (cr.code = 'admin' OR cp.code IN ('usuarios.view', 'roles.manage'))
    ) THEN
      RAISE EXCEPTION 'Acesso negado: não é permitido consultar permissões de outro usuário.'
        USING ERRCODE = '42501';
    END IF;
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

CREATE OR REPLACE FUNCTION public.app_user_has_permission(p_permission_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_user_has_permission(public.current_app_user_id(), p_permission_code);
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_permission(p_permission_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.app_user_has_permission(public.current_app_user_id(), p_permission_code);
$$;

-- 5. Auto-vínculo seguro da própria identidade (bloqueia e-mail não verificado e contas já vinculadas)
CREATE OR REPLACE FUNCTION public.link_and_touch_current_identity(p_provider TEXT DEFAULT 'supabase')
RETURNS public.auth_identities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claims_raw     TEXT;
  v_claims_jsonb   JSONB;
  v_sub            TEXT;
  v_email          TEXT;
  v_email_verified BOOLEAN := false;
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
  IF v_claims_raw IS NOT NULL THEN
    v_claims_jsonb := v_claims_raw::jsonb;
  END IF;

  v_sub := NULLIF(
    btrim(
      COALESCE(
        NULLIF(current_setting('request.jwt.claim.sub', true), ''),
        CASE WHEN v_claims_jsonb IS NOT NULL THEN v_claims_jsonb ->> 'sub' ELSE NULL END,
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
          CASE WHEN v_claims_jsonb IS NOT NULL THEN v_claims_jsonb ->> 'email' ELSE NULL END,
          ''
        )
      )
    ),
    ''
  );

  IF v_claims_jsonb IS NOT NULL THEN
    v_email_verified := COALESCE(
      CASE
        WHEN jsonb_typeof(v_claims_jsonb -> 'email_verified') = 'boolean'
          THEN (v_claims_jsonb ->> 'email_verified')::boolean
        WHEN jsonb_typeof(v_claims_jsonb -> 'user_metadata' -> 'email_verified') = 'boolean'
          THEN (v_claims_jsonb -> 'user_metadata' ->> 'email_verified')::boolean
        ELSE NULL
      END,
      false
    );
  END IF;

  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Identidade JWT ausente para vínculo.' USING ERRCODE = '42501';
  END IF;

  SELECT ai.app_user_id INTO v_user_id
  FROM public.auth_identities ai
  WHERE ai.provider = v_clean_provider
    AND ai.provider_subject = v_sub
  LIMIT 1;

  -- Vínculo inicial por e-mail permitido apenas para contas convidadas, com e-mail verificado e sem vínculo prévio no provedor
  IF v_user_id IS NULL AND v_email IS NOT NULL AND v_email_verified IS TRUE THEN
    SELECT u.id INTO v_user_id
    FROM public.app_users u
    WHERE lower(u.email) = v_email
      AND u.status = 'invited'
      AND NOT EXISTS (
        SELECT 1
        FROM public.auth_identities ai2
        WHERE ai2.app_user_id = u.id
          AND ai2.provider = v_clean_provider
      )
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Identidade não vinculada ou e-mail não verificado para associação automática.'
      USING ERRCODE = '42501';
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

-- 6. Bootstrap atômico e protegido contra concorrência do primeiro administrador
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

  PERFORM pg_advisory_xact_lock(hashtext('art_frame_hub_bootstrap_first_admin'));
  LOCK TABLE public.app_users IN EXCLUSIVE MODE;

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

-- 7. Grants e privilégios estritos (compatível com Supabase e PostgreSQL local)
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

-- 8. Políticas RLS endurecidas nas 7 tabelas RBAC
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissions_select_policy" ON public.permissions;
CREATE POLICY "permissions_select_policy" ON public.permissions
  FOR SELECT
  USING (public.is_current_app_user_active());

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
      (
        public.current_app_user_id() IS NOT NULL
        AND actor_user_id IS NOT NULL
        AND actor_user_id = public.current_app_user_id()
      )
      OR (
        public.current_app_user_id() IS NULL
        AND user_id IS NULL
        AND actor_user_id IS NULL
        AND event_type IN ('LOGIN_FAILED', 'PASSWORD_RESET_REQUESTED', 'UNAUTHORIZED_ACCESS')
      )
      OR (
        public.current_app_user_id() IS NULL
        AND user_id IS NULL
        AND actor_user_id IS NULL
        AND event_type IN ('LOGIN_FAILED', 'LOGIN_SUCCESS', 'UNAUTHORIZED_ACCESS')
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
