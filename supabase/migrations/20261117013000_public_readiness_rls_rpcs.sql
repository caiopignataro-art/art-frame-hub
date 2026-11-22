-- ============================================================================
-- MIGRATION INCREMENTAL: Preparação Segura para Publicação Pública (RBAC + RLS + RPCs)
-- Data: 2026-11-17
-- Objetivo:
--   1. Endurecer `current_app_user_id()`, `link_and_touch_current_identity()`,
--      `has_any_active_admin()` e `auth_audit_log` (remover `user_metadata.email_verified`,
--      impedir spoofing de `app.current_user_id`, revogar `anon` de `auth_audit_log` e
--      `has_any_active_admin()`).
--   2. Revogar todo acesso anônimo (`anon`) às 20 tabelas operacionais, `inspect_func_result`,
--      à view `v_ordens_producao`, às sequences e aos default privileges do schema `public`.
--   3. Substituir todas as políticas abertas (`dev open access` / `USING (true)`) por
--      políticas RLS granulares por operação e permissão (`app_user_has_permission(...)`).
--   4. Configurar `v_ordens_producao` com `security_invoker = true`.
--   5. Envolver e restringir as 11 RPCs operacionais + RPCs de estoque para exigir usuário
--      interno ativo e permissão RBAC correspondente (preservando triggers internos).
-- ============================================================================

-- ============================================================================
-- 1. IDENTIDADE, AUDITORIA E CONTROLE DE BOOTSTRAP / ADMIN
-- ============================================================================

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claims_raw  TEXT;
  v_caller_role TEXT;
  v_local_uid   TEXT;
  v_provider    TEXT;
  v_sub         TEXT;
  v_uid         UUID;
BEGIN
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

  -- GUC `app.current_user_id` aceito exclusivamente em conexões confiáveis sem contexto PostgREST `anon`/`authenticated`
  IF v_claims_raw IS NULL AND v_caller_role NOT IN ('anon', 'authenticated') THEN
    v_local_uid := NULLIF(btrim(COALESCE(current_setting('app.current_user_id', true), '')), '');
    IF v_local_uid IS NOT NULL AND v_local_uid ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RETURN v_local_uid::uuid;
    END IF;
  END IF;

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

-- Nunca confiar em `user_metadata.email_verified` (editável pelo usuário via updateUser)
CREATE OR REPLACE FUNCTION public.link_and_touch_current_identity(p_provider TEXT DEFAULT 'supabase')
RETURNS public.auth_identities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

  -- Aceita exclusivamente claim top-level assinado `email_verified`, jamais `user_metadata.email_verified`
  IF v_claims_jsonb IS NOT NULL AND jsonb_typeof(v_claims_jsonb -> 'email_verified') = 'boolean' THEN
    v_email_verified := (v_claims_jsonb ->> 'email_verified')::boolean;
  END IF;

  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Identidade JWT ausente para vínculo.' USING ERRCODE = '42501';
  END IF;

  SELECT ai.app_user_id INTO v_user_id
  FROM public.auth_identities ai
  WHERE ai.provider = v_clean_provider
    AND ai.provider_subject = v_sub
  LIMIT 1;

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

-- Helper interno reutilizável para validar permissões dentro das RPCs operacionais
CREATE OR REPLACE FUNCTION public.assert_current_user_has_any_permission(p_permissions TEXT[])
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claims_raw  TEXT;
  v_caller_role TEXT;
  v_uid         UUID;
BEGIN
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

  -- Execuções internas de `service_role` ou triggers disparados após passagem pela RLS são permitidas
  IF v_caller_role = 'service_role' THEN
    RETURN;
  END IF;

  IF v_claims_raw IS NULL AND v_caller_role NOT IN ('anon', 'authenticated') AND pg_trigger_depth() > 0 THEN
    RETURN;
  END IF;

  v_uid := public.current_app_user_id();
  IF v_uid IS NULL OR NOT public.is_current_app_user_active() THEN
    RAISE EXCEPTION 'Acesso negado: usuário não autenticado ou inativo no ERP.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM unnest(p_permissions) AS req(code)
    WHERE public.app_user_has_permission(v_uid, req.code)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: permissão insuficiente para executar esta operação.'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_current_user_has_any_permission(TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_any_active_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_user_has_permission(UUID, TEXT) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION public.has_any_active_admin() FROM anon;
    REVOKE ALL ON FUNCTION public.assert_current_user_has_any_permission(TEXT[]) FROM anon;
    REVOKE ALL ON FUNCTION public.app_user_has_permission(UUID, TEXT) FROM anon;
    REVOKE ALL ON public.auth_audit_log FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON FUNCTION public.app_user_has_permission(UUID, TEXT) FROM authenticated;
    REVOKE ALL ON FUNCTION public.has_any_active_admin() FROM authenticated;
    GRANT EXECUTE ON FUNCTION public.assert_current_user_has_any_permission(TEXT[]) TO authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.has_any_active_admin() TO service_role;
    GRANT EXECUTE ON FUNCTION public.assert_current_user_has_any_permission(TEXT[]) TO service_role;
    GRANT EXECUTE ON FUNCTION public.app_user_has_permission(UUID, TEXT) TO service_role;
  END IF;
END
$$;

-- `auth_audit_log`: bloqueia INSERT/UPDATE/DELETE direto por anon e authenticated; escrita via backend (`service_role`) e `bootstrap_first_admin`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.auth_audit_log FROM authenticated;
    GRANT SELECT ON public.auth_audit_log TO authenticated;
  END IF;
END
$$;

DROP POLICY IF EXISTS "auth_audit_log_insert_policy" ON public.auth_audit_log;
CREATE POLICY "auth_audit_log_insert_policy" ON public.auth_audit_log
  FOR INSERT
  WITH CHECK (false);

-- ============================================================================
-- 2. REVOGAÇÃO DE `anon` E PROTEÇÃO DE TABELAS OPERACIONAIS, SEQUENCES E DEFAULTS
-- ============================================================================

DO $$
DECLARE
  v_tables TEXT[] := ARRAY[
    'clientes',
    'produtos',
    'orcamentos',
    'orcamento_itens',
    'pedidos',
    'pedido_itens',
    'pagamentos',
    'historico',
    'importacoes',
    'notificacoes_whatsapp',
    'configuracoes_sistema',
    'fabricante_estoque_minimo',
    'retalhos',
    'reservas_estoque',
    'estoque_movimentacoes',
    'ordens_producao',
    'ordem_producao',
    'ordem_producao_itens',
    'ordem_producao_item_componentes',
    'inspect_func_result'
  ];
  v_t TEXT;
  v_pol RECORD;
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    IF to_regclass(format('public.%I', v_t)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_t);

      -- Remove todas as policies legadas abertas (`dev open access ...`, `USING (true)`, etc.)
      FOR v_pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = v_t
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol.policyname, v_t);
      END LOOP;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE format('REVOKE ALL ON public.%I FROM anon', v_t);
      END IF;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', v_t);
        IF v_t = 'historico' THEN
          EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_t);
        ELSIF v_t <> 'inspect_func_result' THEN
          EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', v_t);
        END IF;
      END IF;

      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE format('GRANT ALL ON public.%I TO service_role', v_t);
      END IF;
    END IF;
  END LOOP;

  -- Bloqueio explícito de CREATE no schema public para PUBLIC, anon e authenticated
  REVOKE CREATE ON SCHEMA public FROM PUBLIC;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE CREATE ON SCHEMA public FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE CREATE ON SCHEMA public FROM authenticated;
  END IF;

  -- Revogação global + por schema de privilégios padrão (tabelas, sequências e funções) para PUBLIC, anon e authenticated
  ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC;
  ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC;
  ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

  REVOKE UPDATE ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
    ALTER DEFAULT PRIVILEGES REVOKE ALL ON FUNCTIONS FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
    ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated;
    ALTER DEFAULT PRIVILEGES REVOKE ALL ON FUNCTIONS FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated;
  END IF;

  -- Garantir revogação padrão para roles proprietárias quando o papel executor for membro; caso contrário registrar NOTICE explícito
  DECLARE
    v_owner_role TEXT;
  BEGIN
    FOREACH v_owner_role IN ARRAY ARRAY['postgres', 'supabase_admin'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = v_owner_role) THEN
        IF pg_has_role(current_user, v_owner_role, 'MEMBER') THEN
          EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON TABLES FROM PUBLIC', v_owner_role);
          EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC', v_owner_role);
          EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON SEQUENCES FROM PUBLIC', v_owner_role);
          EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC', v_owner_role);
          EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', v_owner_role);
          EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC', v_owner_role);
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON TABLES FROM anon', v_owner_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM anon', v_owner_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON SEQUENCES FROM anon', v_owner_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon', v_owner_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM anon', v_owner_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon', v_owner_role);
          END IF;
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON TABLES FROM authenticated', v_owner_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated', v_owner_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE ALL ON SEQUENCES FROM authenticated', v_owner_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated', v_owner_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I REVOKE EXECUTE ON FUNCTIONS FROM authenticated', v_owner_role);
            EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM authenticated', v_owner_role);
          END IF;
        ELSE
          RAISE NOTICE 'DEFAULT PRIVILEGES para role % não alterados: current_user (%) não é membro. Objetos criados por % exigem execução direta como %.',
            v_owner_role, current_user, v_owner_role, v_owner_role;
        END IF;
      END IF;
    END LOOP;
  END;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
  END IF;
END
$$;

-- ============================================================================
-- 3. POLICIES RLS GRANULARES POR TABELA E OPERAÇÃO
-- ============================================================================

-- clientes
CREATE POLICY "clientes_select_policy" ON public.clientes FOR SELECT
  USING (public.app_user_has_permission('clientes.view'));
CREATE POLICY "clientes_insert_policy" ON public.clientes FOR INSERT
  WITH CHECK (public.app_user_has_permission('clientes.create'));
CREATE POLICY "clientes_update_policy" ON public.clientes FOR UPDATE
  USING (public.app_user_has_permission('clientes.update'))
  WITH CHECK (public.app_user_has_permission('clientes.update'));
CREATE POLICY "clientes_delete_policy" ON public.clientes FOR DELETE
  USING (public.app_user_has_permission('clientes.delete'));

-- produtos
CREATE POLICY "produtos_select_policy" ON public.produtos FOR SELECT
  USING (public.app_user_has_permission('produtos.view'));
CREATE POLICY "produtos_insert_policy" ON public.produtos FOR INSERT
  WITH CHECK (
    public.app_user_has_permission('produtos.create')
    OR public.app_user_has_permission('produtos.import')
  );
CREATE POLICY "produtos_update_policy" ON public.produtos FOR UPDATE
  USING (
    public.app_user_has_permission('produtos.update')
    OR public.app_user_has_permission('produtos.bulk_update')
    OR public.app_user_has_permission('produtos.import')
  )
  WITH CHECK (
    public.app_user_has_permission('produtos.update')
    OR public.app_user_has_permission('produtos.bulk_update')
    OR public.app_user_has_permission('produtos.import')
  );
CREATE POLICY "produtos_delete_policy" ON public.produtos FOR DELETE
  USING (public.app_user_has_permission('produtos.delete'));

-- orcamentos & orcamento_itens
CREATE POLICY "orcamentos_select_policy" ON public.orcamentos FOR SELECT
  USING (public.app_user_has_permission('orcamentos.view'));
CREATE POLICY "orcamentos_insert_policy" ON public.orcamentos FOR INSERT
  WITH CHECK (public.app_user_has_permission('orcamentos.create'));
CREATE POLICY "orcamentos_update_policy" ON public.orcamentos FOR UPDATE
  USING (public.app_user_has_permission('orcamentos.update'))
  WITH CHECK (public.app_user_has_permission('orcamentos.update'));
CREATE POLICY "orcamentos_delete_policy" ON public.orcamentos FOR DELETE
  USING (public.app_user_has_permission('orcamentos.delete'));

CREATE POLICY "orcamento_itens_select_policy" ON public.orcamento_itens FOR SELECT
  USING (public.app_user_has_permission('orcamentos.view'));
CREATE POLICY "orcamento_itens_insert_policy" ON public.orcamento_itens FOR INSERT
  WITH CHECK (public.app_user_has_permission('orcamentos.create') OR public.app_user_has_permission('orcamentos.update'));
CREATE POLICY "orcamento_itens_update_policy" ON public.orcamento_itens FOR UPDATE
  USING (public.app_user_has_permission('orcamentos.update'))
  WITH CHECK (public.app_user_has_permission('orcamentos.update'));
CREATE POLICY "orcamento_itens_delete_policy" ON public.orcamento_itens FOR DELETE
  USING (public.app_user_has_permission('orcamentos.delete') OR public.app_user_has_permission('orcamentos.update'));

-- pedidos & pedido_itens (dashboard.view usa exclusivamente `get_dashboard_summary()`, sem SELECT detalhado)
CREATE POLICY "pedidos_select_policy" ON public.pedidos FOR SELECT
  USING (
    public.app_user_has_permission('pedidos.view')
    OR public.app_user_has_permission('producao.view')
    OR public.app_user_has_permission('pagamentos.view')
  );
CREATE POLICY "pedidos_insert_policy" ON public.pedidos FOR INSERT
  WITH CHECK (public.app_user_has_permission('pedidos.create'));
CREATE POLICY "pedidos_update_policy" ON public.pedidos FOR UPDATE
  USING (
    public.app_user_has_permission('pedidos.update')
    OR public.app_user_has_permission('pedidos.approve')
    OR public.app_user_has_permission('pedidos.cancel')
    OR public.app_user_has_permission('pedidos.archive')
    OR public.app_user_has_permission('pedidos.reopen')
    OR public.app_user_has_permission('pedidos.whatsapp')
  )
  WITH CHECK (
    public.app_user_has_permission('pedidos.update')
    OR public.app_user_has_permission('pedidos.approve')
    OR public.app_user_has_permission('pedidos.cancel')
    OR public.app_user_has_permission('pedidos.archive')
    OR public.app_user_has_permission('pedidos.reopen')
    OR public.app_user_has_permission('pedidos.whatsapp')
  );
CREATE POLICY "pedidos_delete_policy" ON public.pedidos FOR DELETE
  USING (public.app_user_has_permission('pedidos.delete'));

CREATE POLICY "pedido_itens_select_policy" ON public.pedido_itens FOR SELECT
  USING (
    public.app_user_has_permission('pedidos.view')
    OR public.app_user_has_permission('producao.view')
  );
CREATE POLICY "pedido_itens_insert_policy" ON public.pedido_itens FOR INSERT
  WITH CHECK (public.app_user_has_permission('pedidos.create') OR public.app_user_has_permission('pedidos.update'));
CREATE POLICY "pedido_itens_update_policy" ON public.pedido_itens FOR UPDATE
  USING (public.app_user_has_permission('pedidos.update'))
  WITH CHECK (public.app_user_has_permission('pedidos.update'));
CREATE POLICY "pedido_itens_delete_policy" ON public.pedido_itens FOR DELETE
  USING (public.app_user_has_permission('pedidos.delete') OR public.app_user_has_permission('pedidos.update'));

-- pagamentos
CREATE POLICY "pagamentos_select_policy" ON public.pagamentos FOR SELECT
  USING (
    public.app_user_has_permission('pagamentos.view')
    OR public.app_user_has_permission('pagamentos.manage')
  );
CREATE POLICY "pagamentos_insert_policy" ON public.pagamentos FOR INSERT
  WITH CHECK (
    public.app_user_has_permission('pagamentos.create')
    OR public.app_user_has_permission('pagamentos.manage')
    OR public.app_user_has_permission('pedidos.create')
  );
CREATE POLICY "pagamentos_update_policy" ON public.pagamentos FOR UPDATE
  USING (
    public.app_user_has_permission('pagamentos.update')
    OR public.app_user_has_permission('pagamentos.manage')
    OR public.app_user_has_permission('pedidos.update')
  )
  WITH CHECK (
    public.app_user_has_permission('pagamentos.update')
    OR public.app_user_has_permission('pagamentos.manage')
    OR public.app_user_has_permission('pedidos.update')
  );
CREATE POLICY "pagamentos_delete_policy" ON public.pagamentos FOR DELETE
  USING (
    public.app_user_has_permission('pagamentos.delete')
    OR public.app_user_has_permission('pagamentos.manage')
    OR public.app_user_has_permission('pedidos.update')
  );

-- historico (triggers SECURITY DEFINER e RPCs SECURITY DEFINER contornam RLS como owner; INSERT direto por authenticated totalmente bloqueado; sem UPDATE/DELETE)
CREATE POLICY "historico_select_policy" ON public.historico FOR SELECT
  USING (
    public.app_user_has_permission('historico.view')
    OR public.app_user_has_permission('producao.view')
    OR public.app_user_has_permission('usuarios.view')
  );
CREATE POLICY "historico_insert_policy" ON public.historico FOR INSERT
  WITH CHECK (false);

-- importacoes
CREATE POLICY "importacoes_select_policy" ON public.importacoes FOR SELECT
  USING (public.app_user_has_permission('produtos.view') OR public.app_user_has_permission('produtos.import'));
CREATE POLICY "importacoes_insert_policy" ON public.importacoes FOR INSERT
  WITH CHECK (public.app_user_has_permission('produtos.import'));
CREATE POLICY "importacoes_update_policy" ON public.importacoes FOR UPDATE
  USING (public.app_user_has_permission('produtos.import'))
  WITH CHECK (public.app_user_has_permission('produtos.import'));
CREATE POLICY "importacoes_delete_policy" ON public.importacoes FOR DELETE
  USING (public.app_user_has_permission('produtos.import'));

-- notificacoes_whatsapp
CREATE POLICY "notificacoes_whatsapp_select_policy" ON public.notificacoes_whatsapp FOR SELECT
  USING (public.app_user_has_permission('pedidos.view') OR public.app_user_has_permission('pedidos.whatsapp'));
CREATE POLICY "notificacoes_whatsapp_insert_policy" ON public.notificacoes_whatsapp FOR INSERT
  WITH CHECK (
    public.app_user_has_permission('pedidos.whatsapp')
    OR public.app_user_has_permission('pedidos.approve')
    OR public.app_user_has_permission('pedidos.update')
  );
CREATE POLICY "notificacoes_whatsapp_update_policy" ON public.notificacoes_whatsapp FOR UPDATE
  USING (public.app_user_has_permission('pedidos.whatsapp'))
  WITH CHECK (public.app_user_has_permission('pedidos.whatsapp'));
CREATE POLICY "notificacoes_whatsapp_delete_policy" ON public.notificacoes_whatsapp FOR DELETE
  USING (public.app_user_has_permission('pedidos.whatsapp'));

-- configuracoes_sistema (chaves gerais apenas com configuracoes.view; chaves operacionais de estoque liberadas aos módulos operacionais)
CREATE POLICY "configuracoes_sistema_select_policy" ON public.configuracoes_sistema FOR SELECT
  USING (
    public.app_user_has_permission('configuracoes.view')
    OR (
      chave IN ('estoque.comprimento_barra_cm', 'estoque.perda_corte_percentual', 'estoque.estoque_minimo_barras_default')
      AND (
        public.app_user_has_permission('estoque.view')
        OR public.app_user_has_permission('produtos.view')
        OR public.app_user_has_permission('pedidos.view')
        OR public.app_user_has_permission('orcamentos.view')
        OR public.app_user_has_permission('producao.view')
      )
    )
  );
CREATE POLICY "configuracoes_sistema_insert_policy" ON public.configuracoes_sistema FOR INSERT
  WITH CHECK (public.app_user_has_permission('configuracoes.update') OR public.app_user_has_permission('configuracoes.manage'));
CREATE POLICY "configuracoes_sistema_update_policy" ON public.configuracoes_sistema FOR UPDATE
  USING (public.app_user_has_permission('configuracoes.update') OR public.app_user_has_permission('configuracoes.manage'))
  WITH CHECK (public.app_user_has_permission('configuracoes.update') OR public.app_user_has_permission('configuracoes.manage'));
CREATE POLICY "configuracoes_sistema_delete_policy" ON public.configuracoes_sistema FOR DELETE
  USING (public.app_user_has_permission('configuracoes.manage'));

-- fabricante_estoque_minimo, retalhos, reservas_estoque, estoque_movimentacoes
CREATE POLICY "fabricante_estoque_minimo_select_policy" ON public.fabricante_estoque_minimo FOR SELECT
  USING (public.app_user_has_permission('estoque.view') OR public.app_user_has_permission('produtos.view'));
CREATE POLICY "fabricante_estoque_minimo_insert_policy" ON public.fabricante_estoque_minimo FOR INSERT
  WITH CHECK (public.app_user_has_permission('estoque.manage_minimum') OR public.app_user_has_permission('estoque.create'));
CREATE POLICY "fabricante_estoque_minimo_update_policy" ON public.fabricante_estoque_minimo FOR UPDATE
  USING (public.app_user_has_permission('estoque.manage_minimum') OR public.app_user_has_permission('estoque.update'))
  WITH CHECK (public.app_user_has_permission('estoque.manage_minimum') OR public.app_user_has_permission('estoque.update'));
CREATE POLICY "fabricante_estoque_minimo_delete_policy" ON public.fabricante_estoque_minimo FOR DELETE
  USING (public.app_user_has_permission('estoque.manage_minimum') OR public.app_user_has_permission('estoque.delete'));

CREATE POLICY "retalhos_select_policy" ON public.retalhos FOR SELECT
  USING (public.app_user_has_permission('estoque.view') OR public.app_user_has_permission('produtos.view'));
CREATE POLICY "retalhos_insert_policy" ON public.retalhos FOR INSERT
  WITH CHECK (public.app_user_has_permission('estoque.create') OR public.app_user_has_permission('estoque.adjust'));
CREATE POLICY "retalhos_update_policy" ON public.retalhos FOR UPDATE
  USING (public.app_user_has_permission('estoque.update') OR public.app_user_has_permission('estoque.discard') OR public.app_user_has_permission('estoque.adjust'))
  WITH CHECK (public.app_user_has_permission('estoque.update') OR public.app_user_has_permission('estoque.discard') OR public.app_user_has_permission('estoque.adjust'));
CREATE POLICY "retalhos_delete_policy" ON public.retalhos FOR DELETE
  USING (public.app_user_has_permission('estoque.delete'));

CREATE POLICY "reservas_estoque_select_policy" ON public.reservas_estoque FOR SELECT
  USING (public.app_user_has_permission('estoque.view') OR public.app_user_has_permission('producao.view'));
CREATE POLICY "reservas_estoque_insert_policy" ON public.reservas_estoque FOR INSERT
  WITH CHECK (public.app_user_has_permission('estoque.create') OR public.app_user_has_permission('pedidos.approve'));
CREATE POLICY "reservas_estoque_update_policy" ON public.reservas_estoque FOR UPDATE
  USING (public.app_user_has_permission('estoque.update') OR public.app_user_has_permission('estoque.adjust'))
  WITH CHECK (public.app_user_has_permission('estoque.update') OR public.app_user_has_permission('estoque.adjust'));
CREATE POLICY "reservas_estoque_delete_policy" ON public.reservas_estoque FOR DELETE
  USING (public.app_user_has_permission('estoque.delete'));

CREATE POLICY "estoque_movimentacoes_select_policy" ON public.estoque_movimentacoes FOR SELECT
  USING (public.app_user_has_permission('estoque.view'));
CREATE POLICY "estoque_movimentacoes_insert_policy" ON public.estoque_movimentacoes FOR INSERT
  WITH CHECK (public.app_user_has_permission('estoque.create') OR public.app_user_has_permission('estoque.adjust'));
CREATE POLICY "estoque_movimentacoes_delete_policy" ON public.estoque_movimentacoes FOR DELETE
  USING (public.app_user_has_permission('estoque.delete'));

-- ordens_producao, ordem_producao, ordem_producao_itens, ordem_producao_item_componentes
CREATE POLICY "ordens_producao_select_policy" ON public.ordens_producao FOR SELECT
  USING (public.app_user_has_permission('producao.view') OR public.app_user_has_permission('estoque.view'));
CREATE POLICY "ordens_producao_insert_policy" ON public.ordens_producao FOR INSERT
  WITH CHECK (public.app_user_has_permission('producao.create') OR public.app_user_has_permission('producao.create_order'));
CREATE POLICY "ordens_producao_update_policy" ON public.ordens_producao FOR UPDATE
  USING (public.app_user_has_permission('producao.update') OR public.app_user_has_permission('producao.complete_order'))
  WITH CHECK (public.app_user_has_permission('producao.update') OR public.app_user_has_permission('producao.complete_order'));
CREATE POLICY "ordens_producao_delete_policy" ON public.ordens_producao FOR DELETE
  USING (public.app_user_has_permission('producao.delete'));

CREATE POLICY "ordem_producao_select_policy" ON public.ordem_producao FOR SELECT
  USING (public.app_user_has_permission('producao.view') OR public.app_user_has_permission('estoque.view'));
CREATE POLICY "ordem_producao_insert_policy" ON public.ordem_producao FOR INSERT
  WITH CHECK (public.app_user_has_permission('producao.create') OR public.app_user_has_permission('producao.create_order'));
CREATE POLICY "ordem_producao_update_policy" ON public.ordem_producao FOR UPDATE
  USING (
    public.app_user_has_permission('producao.update')
    OR public.app_user_has_permission('producao.complete_order')
    OR public.app_user_has_permission('producao.cancel_order')
    OR public.app_user_has_permission('producao.archive_order')
  )
  WITH CHECK (
    public.app_user_has_permission('producao.update')
    OR public.app_user_has_permission('producao.complete_order')
    OR public.app_user_has_permission('producao.cancel_order')
    OR public.app_user_has_permission('producao.archive_order')
  );
CREATE POLICY "ordem_producao_delete_policy" ON public.ordem_producao FOR DELETE
  USING (public.app_user_has_permission('producao.delete'));

CREATE POLICY "ordem_producao_itens_select_policy" ON public.ordem_producao_itens FOR SELECT
  USING (public.app_user_has_permission('producao.view') OR public.app_user_has_permission('estoque.view'));
CREATE POLICY "ordem_producao_itens_insert_policy" ON public.ordem_producao_itens FOR INSERT
  WITH CHECK (public.app_user_has_permission('producao.create') OR public.app_user_has_permission('producao.create_order'));
CREATE POLICY "ordem_producao_itens_update_policy" ON public.ordem_producao_itens FOR UPDATE
  USING (
    public.app_user_has_permission('producao.update')
    OR public.app_user_has_permission('producao.complete_item')
    OR public.app_user_has_permission('producao.mark_problem')
  )
  WITH CHECK (
    public.app_user_has_permission('producao.update')
    OR public.app_user_has_permission('producao.complete_item')
    OR public.app_user_has_permission('producao.mark_problem')
  );
CREATE POLICY "ordem_producao_itens_delete_policy" ON public.ordem_producao_itens FOR DELETE
  USING (public.app_user_has_permission('producao.delete') OR public.app_user_has_permission('producao.remove_order_item'));

CREATE POLICY "ordem_producao_item_componentes_select_policy" ON public.ordem_producao_item_componentes FOR SELECT
  USING (public.app_user_has_permission('producao.view') OR public.app_user_has_permission('estoque.view'));
CREATE POLICY "ordem_producao_item_componentes_insert_policy" ON public.ordem_producao_item_componentes FOR INSERT
  WITH CHECK (public.app_user_has_permission('producao.create') OR public.app_user_has_permission('producao.create_order'));
CREATE POLICY "ordem_producao_item_componentes_update_policy" ON public.ordem_producao_item_componentes FOR UPDATE
  USING (public.app_user_has_permission('producao.prepare_component') OR public.app_user_has_permission('producao.update'))
  WITH CHECK (public.app_user_has_permission('producao.prepare_component') OR public.app_user_has_permission('producao.update'));
CREATE POLICY "ordem_producao_item_componentes_delete_policy" ON public.ordem_producao_item_componentes FOR DELETE
  USING (public.app_user_has_permission('producao.delete') OR public.app_user_has_permission('producao.remove_order_item'));

-- ============================================================================
-- 4. VIEW `v_ordens_producao` COM `security_invoker = true` (RESPEITA RLS)
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.v_ordens_producao') IS NOT NULL THEN
    ALTER VIEW public.v_ordens_producao SET (security_invoker = true);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      REVOKE ALL ON public.v_ordens_producao FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      GRANT SELECT ON public.v_ordens_producao TO authenticated;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
      GRANT ALL ON public.v_ordens_producao TO service_role;
    END IF;
  END IF;
END
$$;

-- ============================================================================
-- 5. PROTEÇÃO DAS 11 RPCS OPERACIONAIS + RPCS DE ESTOQUE (RBAC + REVOKE ANON)
-- ============================================================================

DO $$
BEGIN
  IF to_regprocedure('public.proximo_codigo_produto()') IS NOT NULL
     AND to_regprocedure('public.proximo_codigo_produto_impl()') IS NULL THEN
    ALTER FUNCTION public.proximo_codigo_produto() RENAME TO proximo_codigo_produto_impl;
  END IF;

  IF to_regprocedure('public.rpc_reverter_aprovacao_pedido(uuid)') IS NOT NULL
     AND to_regprocedure('public.rpc_reverter_aprovacao_pedido_impl(uuid)') IS NULL THEN
    ALTER FUNCTION public.rpc_reverter_aprovacao_pedido(uuid) RENAME TO rpc_reverter_aprovacao_pedido_impl;
  END IF;

  IF to_regprocedure('public.criar_ordem_producao(uuid[],text)') IS NOT NULL
     AND to_regprocedure('public.criar_ordem_producao_impl(uuid[],text)') IS NULL THEN
    ALTER FUNCTION public.criar_ordem_producao(uuid[], text) RENAME TO criar_ordem_producao_impl;
  END IF;

  IF to_regprocedure('public.remover_pedido_da_ordem_producao(uuid,text)') IS NOT NULL
     AND to_regprocedure('public.remover_pedido_da_ordem_producao_impl(uuid,text)') IS NULL THEN
    ALTER FUNCTION public.remover_pedido_da_ordem_producao(uuid, text) RENAME TO remover_pedido_da_ordem_producao_impl;
  END IF;

  IF to_regprocedure('public.cancelar_ordem_producao(uuid)') IS NOT NULL
     AND to_regprocedure('public.cancelar_ordem_producao_impl(uuid)') IS NULL THEN
    ALTER FUNCTION public.cancelar_ordem_producao(uuid) RENAME TO cancelar_ordem_producao_impl;
  END IF;

  IF to_regprocedure('public.rpc_concluir_item_producao(uuid,boolean)') IS NOT NULL
     AND to_regprocedure('public.rpc_concluir_item_producao_impl(uuid,boolean)') IS NULL THEN
    ALTER FUNCTION public.rpc_concluir_item_producao(uuid, boolean) RENAME TO rpc_concluir_item_producao_impl;
  END IF;

  IF to_regprocedure('public.rpc_marcar_componente_preparado(uuid,boolean)') IS NOT NULL
     AND to_regprocedure('public.rpc_marcar_componente_preparado_impl(uuid,boolean)') IS NULL THEN
    ALTER FUNCTION public.rpc_marcar_componente_preparado(uuid, boolean) RENAME TO rpc_marcar_componente_preparado_impl;
  END IF;

  IF to_regprocedure('public.marcar_item_preparado(uuid,boolean)') IS NOT NULL
     AND to_regprocedure('public.marcar_item_preparado_impl(uuid,boolean)') IS NULL THEN
    ALTER FUNCTION public.marcar_item_preparado(uuid, boolean) RENAME TO marcar_item_preparado_impl;
  END IF;

  IF to_regprocedure('public.marcar_item_problema(uuid,boolean,public.problema_tipo_enum,text)') IS NOT NULL
     AND to_regprocedure('public.marcar_item_problema_impl(uuid,boolean,public.problema_tipo_enum,text)') IS NULL THEN
    ALTER FUNCTION public.marcar_item_problema(uuid, boolean, public.problema_tipo_enum, text) RENAME TO marcar_item_problema_impl;
  END IF;

  IF to_regprocedure('public.concluir_pedido_producao(uuid)') IS NOT NULL
     AND to_regprocedure('public.concluir_pedido_producao_impl(uuid)') IS NULL THEN
    ALTER FUNCTION public.concluir_pedido_producao(uuid) RENAME TO concluir_pedido_producao_impl;
  END IF;

  IF to_regprocedure('public.processar_reserva_pedido(uuid)') IS NOT NULL
     AND to_regprocedure('public.processar_reserva_pedido_impl(uuid)') IS NULL THEN
    ALTER FUNCTION public.processar_reserva_pedido(uuid) RENAME TO processar_reserva_pedido_impl;
  END IF;

  IF to_regprocedure('public.estornar_reservas_pedido(uuid)') IS NOT NULL
     AND to_regprocedure('public.estornar_reservas_pedido_impl(uuid)') IS NULL THEN
    ALTER FUNCTION public.estornar_reservas_pedido(uuid) RENAME TO estornar_reservas_pedido_impl;
  END IF;

  IF to_regprocedure('public.consumir_reservas_pedido(uuid)') IS NOT NULL
     AND to_regprocedure('public.consumir_reservas_pedido_impl(uuid)') IS NULL THEN
    ALTER FUNCTION public.consumir_reservas_pedido(uuid) RENAME TO consumir_reservas_pedido_impl;
  END IF;

  IF to_regprocedure('public.estoque_saldo_cm(uuid)') IS NOT NULL
     AND to_regprocedure('public.estoque_saldo_cm_impl(uuid)') IS NULL THEN
    ALTER FUNCTION public.estoque_saldo_cm(uuid) RENAME TO estoque_saldo_cm_impl;
  END IF;
END
$$;

-- Wrappers RBAC preservando integralmente as assinaturas e lógicas originais (`*_impl`)
CREATE OR REPLACE FUNCTION public.proximo_codigo_produto()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['produtos.create', 'produtos.update', 'produtos.import']);
  RETURN public.proximo_codigo_produto_impl();
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_reverter_aprovacao_pedido(p_pedido_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['pedidos.cancel', 'pedidos.update']);
  PERFORM public.rpc_reverter_aprovacao_pedido_impl(p_pedido_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_ordem_producao(
  p_pedidos_ids UUID[],
  p_observacoes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['producao.create_order', 'producao.create']);
  RETURN public.criar_ordem_producao_impl(p_pedidos_ids, p_observacoes);
END;
$$;

CREATE OR REPLACE FUNCTION public.remover_pedido_da_ordem_producao(
  p_pedido_id UUID,
  p_motivo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['producao.remove_order_item']);
  RETURN public.remover_pedido_da_ordem_producao_impl(p_pedido_id, p_motivo);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_ordem_producao(p_ordem_producao_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['producao.cancel_order']);
  PERFORM public.cancelar_ordem_producao_impl(p_ordem_producao_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_concluir_item_producao(
  p_ordem_producao_item_id UUID,
  p_pronto BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['producao.complete_item']);
  RETURN public.rpc_concluir_item_producao_impl(p_ordem_producao_item_id, p_pronto);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_marcar_componente_preparado(
  p_componente_id UUID,
  p_preparado BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['producao.prepare_component']);
  RETURN public.rpc_marcar_componente_preparado_impl(p_componente_id, p_preparado);
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_item_preparado(
  p_ordem_producao_item_id UUID,
  p_preparado BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['producao.prepare_component', 'producao.complete_item']);
  RETURN public.marcar_item_preparado_impl(p_ordem_producao_item_id, p_preparado);
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_item_problema(
  p_ordem_producao_item_id UUID,
  p_possui_problema BOOLEAN,
  p_tipo public.problema_tipo_enum,
  p_descricao TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['producao.mark_problem']);
  RETURN public.marcar_item_problema_impl(p_ordem_producao_item_id, p_possui_problema, p_tipo, p_descricao);
END;
$$;

CREATE OR REPLACE FUNCTION public.concluir_pedido_producao(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['producao.complete_order']);
  RETURN public.concluir_pedido_producao_impl(p_pedido_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.obter_detalhe_ordem_producao(p_ordem_producao_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_op JSONB;
  v_pedidos JSONB;
  v_op_itens JSONB;
  v_historico JSONB;
  v_total_itens INT;
  v_total_qtd INT;
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['producao.view']);

  -- Fetch OP details
  SELECT to_jsonb(o) INTO v_op
  FROM public.ordem_producao o
  WHERE id = p_ordem_producao_id;

  IF v_op IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fetch associated Pedidos (decorating each with derived flags)
  SELECT jsonb_agg(
    to_jsonb(p) || jsonb_build_object(
      'cliente', to_jsonb(c),
      'itens', (
        SELECT jsonb_agg(to_jsonb(it))
        FROM public.pedido_itens it
        WHERE it.pedido_id = p.id
      ),
      'pagamentos', COALESCE((
        SELECT jsonb_agg(to_jsonb(pag))
        FROM public.pagamentos pag
        WHERE pag.pedido_id = p.id
      ), '[]'::jsonb),
      -- Derived state (all items prepared, none have problems, total > 0)
      'pedido_pronto', (SELECT (public.calcular_estado_pedido(p.id) ->> 'pedido_pronto')::BOOLEAN),
      -- Persisted state (status is 'pronto')
      'pedido_concluido', (p.status = 'pronto')
    )
  ) INTO v_pedidos
  FROM public.pedidos p
  LEFT JOIN public.clientes c ON p.cliente_id = c.id
  WHERE p.ordem_producao_id = p_ordem_producao_id;

  -- Fetch item tracking statuses decorated with ordered components
  SELECT jsonb_agg(
    to_jsonb(oi) || jsonb_build_object(
      'componentes', COALESCE((
        SELECT jsonb_agg(to_jsonb(comp))
        FROM (
          SELECT *
          FROM public.ordem_producao_item_componentes
          WHERE ordem_producao_item_id = oi.id
          ORDER BY ordem ASC
        ) comp
      ), '[]'::jsonb)
    )
  ) INTO v_op_itens
  FROM public.ordem_producao_itens oi
  WHERE oi.ordem_producao_id = p_ordem_producao_id;

  -- Fetch chronological history
  SELECT jsonb_agg(to_jsonb(h)) INTO v_historico
  FROM (
    SELECT *
    FROM public.historico
    WHERE entidade = 'ordem_producao' AND entidade_id = p_ordem_producao_id
    ORDER BY created_at ASC
  ) h;

  -- Calculate global aggregates
  SELECT COALESCE(COUNT(1), 0), COALESCE(SUM((it.metadados->>'quantidade')::INT), 0)
  INTO v_total_itens, v_total_qtd
  FROM public.ordem_producao_itens oi
  JOIN public.pedido_itens it ON oi.item_pedido_id = it.id
  WHERE oi.ordem_producao_id = p_ordem_producao_id;

  RETURN jsonb_build_object(
    'op', v_op,
    'pedidos', COALESCE(v_pedidos, '[]'::jsonb),
    'opItens', COALESCE(v_op_itens, '[]'::jsonb),
    'itensCount', v_total_itens,
    'quantidadesCount', v_total_qtd,
    'historico', COALESCE(v_historico, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inicio_mes     TIMESTAMPTZ := date_trunc('month', now());
  v_faturamento    NUMERIC := 0;
  v_qtd_pedidos    INT := 0;
  v_ticket_medio   NUMERIC := 0;
  v_em_producao    INT := 0;
  v_produtos       JSONB := '[]'::jsonb;
  v_clientes       JSONB := '[]'::jsonb;
  v_serie          JSONB := '[]'::jsonb;
  v_meses_pt       TEXT[] := ARRAY['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
BEGIN
  -- Validação obrigatória antes de consultar qualquer tabela
  PERFORM public.assert_current_user_has_any_permission(ARRAY['dashboard.view']);

  SELECT COALESCE(SUM(p.valor_total), 0), COUNT(*)::int
    INTO v_faturamento, v_qtd_pedidos
  FROM public.pedidos p
  WHERE p.created_at >= v_inicio_mes;

  IF v_qtd_pedidos > 0 THEN
    v_ticket_medio := v_faturamento / v_qtd_pedidos;
  END IF;

  SELECT COUNT(*)::int
    INTO v_em_producao
  FROM public.pedidos p
  WHERE p.status = 'em_producao';

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_produtos
  FROM (
    SELECT COALESCE(i.descricao, '—') AS descricao,
           COALESCE(SUM(i.quantidade), 0)::numeric AS quantidade,
           COALESCE(SUM(i.valor_total), 0)::numeric AS total
    FROM public.pedido_itens i
    GROUP BY COALESCE(i.descricao, '—')
    ORDER BY SUM(i.quantidade) DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
    INTO v_clientes
  FROM (
    SELECT p.cliente_id,
           COALESCE(c.nome, '—') AS nome,
           COUNT(*)::int AS pedidos,
           COALESCE(SUM(p.valor_total), 0)::numeric AS total
    FROM public.pedidos p
    LEFT JOIN public.clientes c ON c.id = p.cliente_id
    WHERE p.cliente_id IS NOT NULL
    GROUP BY p.cliente_id, c.nome
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY s.mes_ord), '[]'::jsonb)
    INTO v_serie
  FROM (
    SELECT gs.m AS mes_ord,
           v_meses_pt[EXTRACT(MONTH FROM gs.m)::int] AS mes,
           COALESCE((
             SELECT SUM(p.valor_total)
             FROM public.pedidos p
             WHERE p.created_at >= gs.m
               AND p.created_at < gs.m + interval '1 month'
           ), 0)::numeric AS valor
    FROM generate_series(v_inicio_mes - interval '5 months', v_inicio_mes, interval '1 month') AS gs(m)
  ) s;

  RETURN jsonb_build_object(
    'faturamentoMes', v_faturamento,
    'ticketMedio', v_ticket_medio,
    'qtdPedidosMes', v_qtd_pedidos,
    'lucroEstimado', v_faturamento * 0.45,
    'emProducao', v_em_producao,
    'produtosMaisUsados', v_produtos,
    'clientesRecorrentes', v_clientes,
    'serieFaturamento', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('mes', item->>'mes', 'valor', (item->>'valor')::numeric)), '[]'::jsonb)
      FROM jsonb_array_elements(v_serie) AS item
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.processar_reserva_pedido(_pedido_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['pedidos.approve', 'pedidos.update', 'estoque.adjust', 'estoque.update']);
  PERFORM public.processar_reserva_pedido_impl(_pedido_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.estornar_reservas_pedido(_pedido_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['pedidos.cancel', 'pedidos.update', 'producao.cancel_order', 'estoque.adjust']);
  PERFORM public.estornar_reservas_pedido_impl(_pedido_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.consumir_reservas_pedido(_pedido_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['producao.complete_order', 'estoque.adjust']);
  PERFORM public.consumir_reservas_pedido_impl(_pedido_id);
END;
$$;

-- Triggers legítimos de estoque chamam diretamente as rotinas internas `*_impl` (sem depender de `pg_trigger_depth()`)
CREATE OR REPLACE FUNCTION public.tg_pedidos_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text IN ('aprovado','aguardando_producao','em_producao','montagem','controle_qualidade') THEN
      PERFORM public.processar_reserva_pedido_impl(NEW.id);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status::text IN ('aprovado','aguardando_producao')
         AND OLD.status::text NOT IN ('aprovado','aguardando_producao','em_producao','montagem','controle_qualidade','pronto','entregue') THEN
        PERFORM public.processar_reserva_pedido_impl(NEW.id);
      ELSIF NEW.status::text = 'cancelado' THEN
        PERFORM public.estornar_reservas_pedido_impl(NEW.id);
        UPDATE public.ordens_producao SET status = 'cancelada' WHERE pedido_id = NEW.id AND status <> 'concluida';
      ELSIF NEW.status::text IN ('pronto','entregue') AND OLD.status::text NOT IN ('pronto','entregue') THEN
        PERFORM public.consumir_reservas_pedido_impl(NEW.id);
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_pedido_itens_estoque()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.pedido_status;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO v_status FROM public.pedidos WHERE id = NEW.pedido_id;
    IF v_status IN ('aguardando_producao','em_producao','montagem','controle_qualidade') THEN
      IF NOT EXISTS (SELECT 1 FROM public.reservas_estoque WHERE pedido_item_id = NEW.id) THEN
        DELETE FROM public.reservas_estoque WHERE pedido_id = NEW.pedido_id AND status = 'ativa';
        PERFORM public.processar_reserva_pedido_impl(NEW.pedido_id);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.estoque_saldo_cm(_produto_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['estoque.view', 'produtos.view', 'pedidos.view', 'producao.view']);
  RETURN public.estoque_saldo_cm_impl(_produto_id);
END;
$$;

-- RPCs transacionais dedicadas para operações com auditoria em `public.historico`
CREATE OR REPLACE FUNCTION public.rpc_produtos_bulk_update(
  p_updates JSONB,
  p_scope JSONB DEFAULT '{}'::jsonb,
  p_mode JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item JSONB;
  v_prod_id UUID;
  v_preco_atual NUMERIC;
  v_preco_novo NUMERIC;
  v_afetados INT := 0;
  v_impacto NUMERIC := 0;
  v_first_id UUID := NULL;
  v_preview_count INT := 0;
  v_kind TEXT;
  v_descricao TEXT;
  v_usuario TEXT;
  v_itens_log JSONB := '[]'::jsonb;
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['produtos.bulk_update']);

  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'Lista de atualizações em lote inválida.' USING ERRCODE = '22023';
  END IF;

  v_preview_count := jsonb_array_length(p_updates);
  IF v_preview_count = 0 THEN
    RETURN jsonb_build_object('afetados', 0, 'impactoVenda', 0);
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_updates) LOOP
    v_prod_id := (v_item ->> 'id')::uuid;
    v_preco_novo := (v_item ->> 'preco_novo')::numeric;

    IF v_prod_id IS NULL OR v_preco_novo IS NULL OR v_preco_novo < 0 THEN
      RAISE EXCEPTION 'Item inválido na atualização em lote de produtos.' USING ERRCODE = '22023';
    END IF;

    SELECT preco_venda
      INTO v_preco_atual
    FROM public.produtos
    WHERE id = v_prod_id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    IF v_first_id IS NULL THEN
      v_first_id := v_prod_id;
    END IF;

    IF v_preco_novo IS DISTINCT FROM v_preco_atual THEN
      UPDATE public.produtos
      SET preco_venda = v_preco_novo
      WHERE id = v_prod_id;

      v_afetados := v_afetados + 1;
      v_impacto := v_impacto + (v_preco_novo - COALESCE(v_preco_atual, 0));

      IF jsonb_array_length(v_itens_log) < 50 THEN
        v_itens_log := v_itens_log || jsonb_build_array(
          jsonb_build_object(
            'id', v_prod_id,
            'preco_atual', v_preco_atual,
            'preco_novo', v_preco_novo
          )
        );
      END IF;
    END IF;
  END LOOP;

  -- Somente grava histórico consolidado se houve atualização real em `public.produtos`, derivando descrição e resumo dos valores efetivamente aplicados
  IF v_afetados > 0 THEN
    v_descricao := 'Atualização em massa de preço: '
      || v_afetados::text || ' produto(s) atualizado(s), impacto líquido R$ '
      || pg_catalog.round(v_impacto, 2)::text;

    SELECT email INTO v_usuario
    FROM public.app_users
    WHERE id = public.current_app_user_id();

    INSERT INTO public.historico (entidade, entidade_id, usuario, acao, descricao, dados_depois)
    VALUES (
      'produtos_bulk',
      COALESCE(v_first_id, gen_random_uuid()),
      COALESCE(v_usuario, 'sistema'),
      'atualizado',
      v_descricao,
      jsonb_build_object(
        'afetados', v_afetados,
        'impacto_venda', v_impacto,
        'itens', v_itens_log
      )
    );
  END IF;

  RETURN jsonb_build_object('afetados', v_afetados, 'impactoVenda', v_impacto);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_concluir_ordem_producao(p_ordem_producao_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.ordem_producao_status;
  v_usuario TEXT;
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['producao.complete_order', 'producao.update']);

  SELECT status
    INTO v_status
  FROM public.ordem_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada.' USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'cancelada' THEN
    RAISE EXCEPTION 'Não é possível concluir uma Ordem de Produção cancelada.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ordem_producao
  SET status = 'concluida',
      concluido_em = pg_catalog.now()
  WHERE id = p_ordem_producao_id;

  SELECT email INTO v_usuario
  FROM public.app_users
  WHERE id = public.current_app_user_id();

  INSERT INTO public.historico (entidade, entidade_id, usuario, acao, descricao)
  VALUES (
    'ordem_producao',
    p_ordem_producao_id,
    COALESCE(v_usuario, 'sistema'),
    'status_alterado',
    'Ordem de Produção concluída.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_arquivar_ordem_producao(p_ordem_producao_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status public.ordem_producao_status;
  v_usuario TEXT;
BEGIN
  PERFORM public.assert_current_user_has_any_permission(ARRAY['producao.archive_order', 'producao.update']);

  SELECT status
    INTO v_status
  FROM public.ordem_producao
  WHERE id = p_ordem_producao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de Produção não encontrada.' USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'cancelada' THEN
    RAISE EXCEPTION 'Não é possível concluir uma Ordem de Produção cancelada.' USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'aberta' AND EXISTS (
    SELECT 1
    FROM public.pedidos p
    WHERE p.ordem_producao_id = p_ordem_producao_id
      AND p.status = 'em_producao'
  ) THEN
    RAISE EXCEPTION 'Não é permitido arquivar uma Ordem de Produção ativa contendo pedidos em andamento.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.ordem_producao
  SET status = 'arquivada'
  WHERE id = p_ordem_producao_id;

  SELECT email INTO v_usuario
  FROM public.app_users
  WHERE id = public.current_app_user_id();

  INSERT INTO public.historico (entidade, entidade_id, usuario, acao, descricao)
  VALUES (
    'ordem_producao',
    p_ordem_producao_id,
    COALESCE(v_usuario, 'sistema'),
    'status_alterado',
    'Ordem de Produção arquivada.'
  );
END;
$$;

-- Endurecimento de `cfg_num` e `calcular_estado_pedido` com validação RBAC em sessões JWT
CREATE OR REPLACE FUNCTION public.cfg_num(_chave TEXT, _default NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v JSONB;
BEGIN
  IF NULLIF(btrim(COALESCE(current_setting('request.jwt.claims', true), '')), '') IS NOT NULL THEN
    IF _chave IN ('estoque.comprimento_barra_cm', 'estoque.perda_corte_percentual') THEN
      PERFORM public.assert_current_user_has_any_permission(
        ARRAY['configuracoes.view', 'estoque.view', 'produtos.view', 'pedidos.view', 'orcamentos.view', 'producao.view']
      );
    ELSE
      PERFORM public.assert_current_user_has_any_permission(ARRAY['configuracoes.view']);
    END IF;
  END IF;

  SELECT valor INTO v FROM public.configuracoes_sistema WHERE chave = _chave;
  IF v IS NULL THEN
    RETURN _default;
  END IF;
  RETURN (v::text)::numeric;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE;
  WHEN OTHERS THEN
    RETURN _default;
END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_estado_pedido(p_pedido_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_itens_total INT;
  v_itens_preparados INT;
  v_itens_com_problema INT;
  v_pedido_pronto BOOLEAN;
BEGIN
  IF NULLIF(btrim(COALESCE(current_setting('request.jwt.claims', true), '')), '') IS NOT NULL THEN
    PERFORM public.assert_current_user_has_any_permission(ARRAY['pedidos.view', 'producao.view']);
  END IF;

  SELECT COUNT(1),
         COUNT(1) FILTER (WHERE preparado = true),
         COUNT(1) FILTER (WHERE possui_problema = true)
  INTO v_itens_total, v_itens_preparados, v_itens_com_problema
  FROM public.ordem_producao_itens
  WHERE pedido_id = p_pedido_id;

  IF v_itens_total > 0 AND v_itens_preparados = v_itens_total AND v_itens_com_problema = 0 THEN
    v_pedido_pronto := TRUE;
  ELSE
    v_pedido_pronto := FALSE;
  END IF;

  RETURN jsonb_build_object(
    'id', p_pedido_id,
    'itens_total', v_itens_total,
    'itens_preparados', v_itens_preparados,
    'itens_com_problema', v_itens_com_problema,
    'pedido_pronto', v_pedido_pronto
  );
END;
$$;

-- Privilégios EXECUTE: revogar `PUBLIC` e `anon` de todas as RPCs, triggers e `_impl`
DO $$
DECLARE
  v_public_rpcs TEXT[] := ARRAY[
    'public.proximo_codigo_produto()',
    'public.rpc_reverter_aprovacao_pedido(uuid)',
    'public.obter_detalhe_ordem_producao(uuid)',
    'public.get_dashboard_summary()',
    'public.rpc_produtos_bulk_update(jsonb,jsonb,jsonb)',
    'public.rpc_concluir_ordem_producao(uuid)',
    'public.rpc_arquivar_ordem_producao(uuid)',
    'public.criar_ordem_producao(uuid[],text)',
    'public.remover_pedido_da_ordem_producao(uuid,text)',
    'public.cancelar_ordem_producao(uuid)',
    'public.rpc_concluir_item_producao(uuid,boolean)',
    'public.rpc_marcar_componente_preparado(uuid,boolean)',
    'public.marcar_item_preparado(uuid,boolean)',
    'public.marcar_item_problema(uuid,boolean,public.problema_tipo_enum,text)',
    'public.concluir_pedido_producao(uuid)',
    'public.processar_reserva_pedido(uuid)',
    'public.estornar_reservas_pedido(uuid)',
    'public.consumir_reservas_pedido(uuid)',
    'public.estoque_saldo_cm(uuid)',
    'public.cfg_num(text,numeric)',
    'public.calcular_consumo_moldura(numeric,numeric,numeric)',
    'public.calcular_estado_pedido(uuid)'
  ];
  v_impl_rpcs TEXT[] := ARRAY[
    'public.proximo_codigo_produto_impl()',
    'public.rpc_reverter_aprovacao_pedido_impl(uuid)',
    'public.criar_ordem_producao_impl(uuid[],text)',
    'public.remover_pedido_da_ordem_producao_impl(uuid,text)',
    'public.cancelar_ordem_producao_impl(uuid)',
    'public.rpc_concluir_item_producao_impl(uuid,boolean)',
    'public.rpc_marcar_componente_preparado_impl(uuid,boolean)',
    'public.marcar_item_preparado_impl(uuid,boolean)',
    'public.marcar_item_problema_impl(uuid,boolean,public.problema_tipo_enum,text)',
    'public.concluir_pedido_producao_impl(uuid)',
    'public.processar_reserva_pedido_impl(uuid)',
    'public.estornar_reservas_pedido_impl(uuid)',
    'public.consumir_reservas_pedido_impl(uuid)',
    'public.estoque_saldo_cm_impl(uuid)',
    'public.tg_set_updated_at()',
    'public.tg_set_atualizado_em()',
    'public.tg_audit_historico()',
    'public.tg_audit_historico_simples()',
    'public.tg_pedido_whatsapp_eventos()',
    'public.tg_pedidos_estoque()',
    'public.tg_pedido_itens_estoque()',
    'public.tg_validar_status_pedido()'
  ];
  v_sig TEXT;
BEGIN
  FOREACH v_sig IN ARRAY v_public_rpcs LOOP
    IF to_regprocedure(v_sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', v_sig);
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', v_sig);
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_sig);
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
      END IF;
    END IF;
  END LOOP;

  FOREACH v_sig IN ARRAY v_impl_rpcs LOOP
    IF to_regprocedure(v_sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', v_sig);
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', v_sig);
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', v_sig);
      END IF;
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_sig);
      END IF;
    END IF;
  END LOOP;

  -- Padronizar search_path = '' em todas as funções SECURITY DEFINER, triggers e helpers em public
  FOR v_sig IN
    SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.prosecdef
        OR p.proname IN (
          'obter_detalhe_ordem_producao',
          'calcular_consumo_moldura',
          'tg_set_atualizado_em',
          'tg_set_updated_at'
        )
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = ''''', v_sig);
  END LOOP;
END
$$;
