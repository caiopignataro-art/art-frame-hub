# Art Frame Hub (Molduraria ERP) — Arquitetura

ERP para gestão completa de molduraria: calculadora de orçamentos, clientes, pedidos,
produção (Ordens de Produção / OP), estoque inteligente (barras e retalhos), pagamentos,
produtos, auditoria e controle de acesso multiusuário (RBAC).

---

## 1. Stack Tecnológica

- **TanStack Start** (React 19 + Vite + Nitro SSR/Server Functions)
- **TypeScript** estrito
- **TanStack Query** — gerenciamento de estado assíncrono e cache no cliente
- **Tailwind CSS v4** + **Shadcn/UI**
- **PostgreSQL** (atualmente gerenciado via **Supabase**, com arquitetura desacoplada pronta para migração a PostgreSQL local)

---

## 2. Arquitetura em Camadas (Desacoplamento de Banco e Autenticação)

```text
Frontend React (Routes & Components)
      ↓
TanStack Query (useQuery / useMutation)
      ↓
Services Client-Safe (src/lib/services/*.service.ts)
      ↓
TanStack Server Functions (src/lib/server/functions/*.functions.ts)
      ↓
Middleware de Autenticação e Autorização (src/lib/server/auth/*)
      ↓
Database Provider (src/lib/server/database/database.provider.ts)
      ↓
Interfaces de Repositories (src/lib/server/repositories/*.repository.ts)
      ↓
Adapter Ativo (src/lib/server/adapters/supabase/*)
      ↓
PostgreSQL
```

### Responsabilidades de Cada Camada

1. **Frontend (`src/routes/`, `src/components/`)**:
   - Apresentação visual, formulários e interação com o usuário.
   - Não conhece tabelas SQL, nomes de RPCs ou objetos do SDK do Supabase.
2. **Tipos de Domínio (`src/types/erp.ts`, `src/types/estoque.ts`, `src/types/auth.ts`, `src/types/permissions.ts`)**:
   - Contratos puros de domínio, 100% independentes de `@/integrations/supabase/types`.
3. **Services Client-Safe (`src/lib/services/*.service.ts`)**:
   - Contratos consumidos pelo frontend e pelo TanStack Query, encapsulando chamadas às Server Functions.
4. **Server Functions (`src/lib/server/functions/*.functions.ts`)**:
   - Fronteira RPC server-side (`createServerFn`), responsável por validar payloads com Zod, resolver o contexto de autenticação, exigir permissões granulares (`requirePermission`) e acionar os repositórios.
5. **Repositories (`src/lib/server/repositories/*.repository.ts`)**:
   - Interfaces puras de acesso a dados, independentes da tecnologia de banco.
6. **Database Provider & Adapters (`src/lib/server/database/`, `src/lib/server/adapters/`)**:
   - Seleciona a implementação concreta de banco em tempo de execução no servidor via `process.env.DATABASE_PROVIDER` (`supabase` atualmente; `postgresql` na futura migração local).

---

## 3. Estrutura de Diretórios

```text
src/
├── routes/
│   ├── __root.tsx                  # Layout raiz + AuthProvider global
│   ├── login.tsx                   # Tela de login individual e recuperação de senha
│   ├── index.tsx                   # Calculadora de Orçamento
│   ├── dashboard.tsx               # Indicadores executivos
│   ├── clientes.tsx                # Gestão de clientes
│   ├── pedidos*.tsx                # Gestão e criação/edição de pedidos
│   ├── producao*.tsx               # Kanban e Ordens de Produção (OP)
│   ├── estoque*.tsx                # Estoque inteligente, retalhos e movimentações
│   ├── pagamentos.tsx              # Gestão financeira
│   ├── produtos*.tsx               # Catálogo, essenciais e importação XLSX
│   ├── historico.tsx               # Auditoria operacional
│   └── configuracoes.tsx           # Parâmetros, Usuários, Perfis, Permissões e Auditoria de Acessos
│
├── components/
│   ├── auth/
│   │   └── AuthContextProvider.tsx # Contexto React de sessão, PermissionGate e RouteAccessGuard
│   ├── admin/
│   │   ├── UsersManagementPanel.tsx
│   │   ├── RolesManagementPanel.tsx
│   │   ├── PermissionsMatrixPanel.tsx
│   │   └── AuthAuditLogPanel.tsx
│   ├── layout/AppShell.tsx
│   ├── calculadora/
│   ├── erp/
│   ├── production/
│   ├── produtos/
│   └── ui/
│
├── types/
│   ├── erp.ts                      # Entidades e enums comerciais/produção desacoplados
│   ├── estoque.ts                  # Entidades e enums de estoque desacoplados
│   ├── auth.ts                     # Usuários internos, identidades, sessão e auditoria de acesso
│   └── permissions.ts              # Catálogo de 12 módulos, 6 perfis iniciais e 63 permissões granulares
│
├── lib/
│   ├── auth/
│   │   ├── permission.guard.ts     # Helpers de autorização client-side para UX (nunca substituem o backend)
│   │   └── session-token.store.ts  # Token store volátil em RAM (sem sessionStorage/localStorage e sem refreshToken)
│   ├── services/                   # Camada de serviços consumida pelo TanStack Query
│   │   ├── auth.service.ts
│   │   ├── users.service.ts
│   │   ├── roles.service.ts
│   │   └── ...
│   └── server/                     # Módulos exclusivamente Server-Side
│       ├── auth/
│       │   ├── auth.context.ts
│       │   ├── auth.middleware.ts
│       │   ├── authorization.ts
│       │   └── permission.guard.ts
│       ├── errors/
│       │   ├── app-error.ts
│       │   └── supabase-error.mapper.ts
│       ├── database/
│       │   ├── database.types.ts
│       │   └── database.provider.ts
│       ├── repositories/           # Contratos independentes de banco (16 interfaces)
│       ├── adapters/
│       │   └── supabase/           # Implementação atual para Supabase PostgreSQL & Auth
│       └── functions/              # Server Functions (auth, users, roles, permissions, health)
│
└── integrations/supabase/          # Isolado para tipos internos do adapter e middleware de transporte
```

---

## 4. Autenticação, Usuários Internos e Controle de Permissões (RBAC)

### 4.1. Tabelas do Modelo de Identidade e Acesso (`20261115220000_fase_a_auth_rbac.sql`)

| Tabela             | Descrição                                                                                                                                                |
| :----------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app_users`        | Cadastro interno de usuários do ERP (`id`, `name`, `email`, `status`, `last_login_at`, `deactivated_at`). Independente de `auth.users`.                  |
| `auth_identities`  | Vínculo entre `app_users` e o provedor de autenticação (`provider`, `provider_subject`), sem Foreign Key rígida para `auth.users`.                       |
| `roles`            | Perfis de acesso (`admin`, `atendimento`, `financeiro`, `estoque`, `producao`, `consulta` e perfis personalizados).                                      |
| `permissions`      | Catálogo granular de permissões por módulo e operação (`modulo.view`, `modulo.create`, `pedidos.approve`, `producao.create_order`, etc.).                |
| `user_roles`       | Associação N:N entre usuários internos e perfis de acesso.                                                                                               |
| `role_permissions` | Associação N:N entre perfis de acesso e permissões granulares.                                                                                           |
| `auth_audit_log`   | Trilha imutável de auditoria de segurança (login, falha de login, logout, criação/edição/desativação de usuários e perfis, tentativas de acesso negado). |

### 4.2. Provisionamento Seguro do Primeiro Administrador (Bootstrap Controlado)

1. Aplique a migration `supabase/migrations/20261115220000_fase_a_auth_rbac.sql` no banco de dados.
2. Configure no servidor (`.env` privado, **nunca** em variáveis `VITE_*`) um segredo forte e de uso único `FIRST_ADMIN_BOOTSTRAP_SECRET` (mínimo 16 caracteres) e, opcionalmente, `FIRST_ADMIN_EMAIL` com o e-mail exato do primeiro administrador autorizado, além de `SUPABASE_SERVICE_ROLE_KEY`.
3. Autentique-se em `/login` com a conta autorizada criada no Supabase Auth.
4. Como ainda não existirá nenhum usuário nem administrador ativo em `app_users`, o sistema exibirá o cartão de **Provisionamento Controlado do Primeiro Administrador** (`provisionFirstAdminServerFn`), exigindo o nome completo e o `FIRST_ADMIN_BOOTSTRAP_SECRET`.
5. No servidor, `provisionFirstAdminServerFn` valida o segredo em tempo constante, verifica `FIRST_ADMIN_EMAIL` (se configurado) e chama `public.bootstrap_first_admin(...)`.
6. No PostgreSQL, `public.bootstrap_first_admin(...)` executa sob `pg_advisory_xact_lock` e `LOCK TABLE public.app_users IN EXCLUSIVE MODE`: verifica atomicamente que `app_users` está vazia e sem administrador ativo, cria o usuário `app_users`, vincula a identidade em `auth_identities`, atribui o perfil `admin` em `user_roles` e grava `FIRST_ADMIN_PROVISIONED` em `auth_audit_log` na mesma transação — impedindo condições de corrida entre requisições simultâneas.
7. Alternativamente (sem usar a interface web), o DBA pode executar `SELECT public.bootstrap_first_admin(...)` diretamente no PostgreSQL com o UUID `sub` e o e-mail da conta Supabase Auth.
8. Após concluir o bootstrap, remova `FIRST_ADMIN_BOOTSTRAP_SECRET` do ambiente. Novas chamadas são bloqueadas permanentemente (`ForbiddenError` / `BOOTSTRAP_ALREADY_COMPLETED`), e usuários adicionais só podem ser criados por quem possui `usuarios.create`.

### 4.3. Estratégia Temporária de Sessão (`sessionTokenStore` e Cookies `HttpOnly`)

- A autenticação primária já utiliza **cookies `HttpOnly`, `SameSite=Lax` (`afh_access_token` e `afh_refresh_token`)** gerenciados pelas Server Functions em `src/lib/server/functions/auth.functions.ts`. O `refreshToken` nunca é gravado em `sessionStorage`, `localStorage` ou memória JS de longa duração, e `signInServerFn` / `refreshSessionServerFn` retornam `refreshToken: null` no payload JSON enviado ao navegador.
- **Concessão temporária documentada**: `src/lib/auth/session-token.store.ts` mantém **apenas em memória RAM volátil** (`memoryToken = { accessToken, expiresAt }`, perdido ao recarregar a página e imediatamente re-sincronizado a partir do cookie `HttpOnly` via `getSessionServerFn()`) o `accessToken` JWT de curta duração, injetado exclusivamente em runtime no cliente Supabase legado do browser via callback em memória (`syncLegacyBrowserClientSession` em `src/lib/services/auth.service.ts`), sem persistência em `localStorage`/`sessionStorage` (`supabase.auth.setSession` foi removido).
- **Risco residual aceito durante Fases B–E**: caso exista uma vulnerabilidade XSS no frontend, código JS malicioso na mesma origem poderia ler o `accessToken` volátil enquanto a aba estiver aberta ou chamar endpoints protegidos via cookies. Esse risco será eliminado ao final da **Fase E**, quando `session-token.store.ts`, `syncLegacyBrowserClientSession`, `auth-attacher.ts` e o cliente browser `@/integrations/supabase/client` forem removidos e o acesso ao banco ficar 100% restrito ao backend.

### 4.4. Escopo Atual de Proteção RBAC vs. Módulos Legados (Plano Fases B–E)

**Já protegido server-side na Fase A (21 Server Functions em 5 arquivos):**

- `auth.functions.ts` (6): `signInServerFn`, `signOutServerFn`, `getSessionServerFn`, `refreshSessionServerFn`, `requestPasswordResetServerFn`, `provisionFirstAdminServerFn`.
- `users.functions.ts` (6): `listUsersServerFn` (`usuarios.view`), `getUserByIdServerFn` (`usuarios.view`), `createUserServerFn` (`usuarios.create`), `updateUserServerFn` (`usuarios.update`), `setUserStatusServerFn` (`usuarios.deactivate`), `listAuthAuditLogsServerFn` (`usuarios.view`).
- `roles.functions.ts` (6): `listRolesServerFn` (`perfis.view` | `roles.manage` | `usuarios.view`), `getRoleByIdServerFn` (`perfis.view` | `roles.manage`), `createRoleServerFn` (`perfis.create` | `roles.manage`), `updateRoleServerFn` (`perfis.update` | `roles.manage`), `deleteRoleServerFn` (`perfis.delete` | `roles.manage`), `listUsersByRoleServerFn` (`perfis.view` | `roles.manage`).
- `permissions.functions.ts` (2): `listPermissionsServerFn` (`perfis.view` | `permissions.manage` | `roles.manage`), `setRolePermissionsServerFn` (`permissions.manage` | `roles.manage`).
- `health.functions.ts` (1): `checkSystemArchitectureHealthServerFn` (`usuarios.view` | `configuracoes.view` | `perfis.view`).

**Ainda acessando o Supabase diretamente pelo navegador (12 serviços legados + policies operacionais abertas):**

| Fase       | Serviços Legados (`src/lib/services/*`)                                                            | Endurecimento Server-Side & RLS Planejado                                                                                                                                                                          |
| :--------- | :------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Fase B** | `clientes.service.ts`, `produtos.service.ts`, `configuracoes.service.ts`, `historico.service.ts`   | Migrar para Server Functions com `requirePermission` (`clientes.*`, `produtos.*`, `configuracoes.*`, `historico.view`) e substituir policies abertas no PostgreSQL por `app_user_has_permission(...)`.             |
| **Fase C** | `orcamentos.service.ts`, `pedidos.service.ts`, `pagamentos.service.ts`, `dashboard.service.ts`     | Migrar fluxos comerciais e financeiros para Server Functions (`orcamentos.*`, `pedidos.*`, `pagamentos.*`, `dashboard.view`) e fechar RLS aberta das tabelas comerciais/financeiras.                               |
| **Fase D** | `estoque.service.ts`, `ordem-producao.service.ts`, `importacoes.service.ts`, `whatsapp.service.ts` | Migrar movimentação/reserva de estoque, ordens de produção, importações e fila WhatsApp para Server Functions e substituir policies abertas operacionais/RPCs por checagem via `app_user_has_permission(...)`.     |
| **Fase E** | Remoção completa de `@/integrations/supabase/client` no browser                                    | Eliminar `session-token.store.ts`, `syncLegacyBrowserClientSession`, `auth-attacher.ts`, remover `accessToken` do payload de `getSessionServerFn` e impor acesso 100% via cookies `HttpOnly` + camada server-side. |

---

## 5. Como Ativar Futuramente o Adapter PostgreSQL Local e Autenticação Local

### 5.1. Ativando o Adapter de Banco PostgreSQL Local

1. Crie o diretório `src/lib/server/adapters/postgresql/` implementando as interfaces definidas em `src/lib/server/repositories/*.repository.ts` usando um driver PostgreSQL (`pg` / `postgres`) conectado via `DATABASE_URL`.
2. Em `src/lib/server/database/database.provider.ts`, conecte o `case "postgresql": return createPostgresRepositories(ctx);`.
3. Altere a variável de ambiente no servidor para:
   ```env
   DATABASE_PROVIDER=postgresql
   DATABASE_URL=postgresql://usuario:senha@localhost:5432/art_frame_hub
   ```
4. Nenhuma rota, componente React, hook do TanStack Query ou contrato de serviço precisará ser modificado.

### 5.2. Substituindo o Supabase Auth por Autenticação Local

1. O cadastro de usuários do ERP já reside em `public.app_users` e o vínculo de credenciais em `public.auth_identities` (`provider`, `provider_subject`), sem chave estrangeira para `auth.users`.
2. Para migrar para autenticação local:
   - Adicione uma coluna `password_hash TEXT` em `public.auth_identities` (ou tabela `local_credentials` vinculada a `app_users.id`).
   - Implemente `LocalServerAuthAdapter` (mesma assinatura de `SupabaseServerAuthAdapter` em `src/lib/server/adapters/supabase/auth.adapter.ts`) validando hash de senha (`argon2` / `bcrypt`) e emitindo JWT assinado localmente (ou sessão opaca no banco) mantendo os mesmos cookies `HttpOnly` (`afh_access_token` e `afh_refresh_token`).
   - Registre as identidades locais em `public.auth_identities` com `provider = 'local'` e `provider_subject = app_users.id::text`.
   - Toda a camada de autorização (`authorization.ts`, `roles`, `permissions`, `user_roles`, `role_permissions`, `auth_audit_log`) e a tela `/login` continuarão funcionando sem qualquer alteração.
