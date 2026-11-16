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
│   └── permissions.ts              # Catálogo de módulos, perfis e 56 permissões granulares
│
├── lib/
│   ├── auth/
│   │   └── session-token.store.ts  # Sincronização client-side de token com cookies HttpOnly
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

| Tabela | Descrição |
| :--- | :--- |
| `app_users` | Cadastro interno de usuários do ERP (`id`, `name`, `email`, `status`, `last_login_at`, `deactivated_at`). Independente de `auth.users`. |
| `auth_identities` | Vínculo entre `app_users` e o provedor de autenticação (`provider`, `provider_subject`), sem Foreign Key rígida para `auth.users`. |
| `roles` | Perfis de acesso (`admin`, `atendimento`, `financeiro`, `estoque`, `producao`, `consulta` e perfis personalizados). |
| `permissions` | Catálogo granular de permissões por módulo e operação (`modulo.view`, `modulo.create`, `pedidos.approve`, `producao.create_order`, etc.). |
| `user_roles` | Associação N:N entre usuários internos e perfis de acesso. |
| `role_permissions` | Associação N:N entre perfis de acesso e permissões granulares. |
| `auth_audit_log` | Trilha imutável de auditoria de segurança (login, falha de login, logout, criação/edição/desativação de usuários e perfis, tentativas de acesso negado). |

### 4.2. Provisionamento Seguro do Primeiro Administrador

1. Aplique a migration `supabase/migrations/20261115220000_fase_a_auth_rbac.sql` no banco de dados.
2. Autentique-se em `/login` com uma conta válida criada no provedor de autenticação (Supabase Auth).
3. Como ainda não existirá nenhum registro com perfil `admin` ativo em `app_users`, o sistema exibirá automaticamente o cartão de **Provisionamento do Primeiro Administrador** (`provisionFirstAdminServerFn`).
4. Confirme seu nome para criar o registro em `app_users`, vincular sua identidade em `auth_identities` e receber o perfil `Administrador` (`admin`), registrando o evento `FIRST_ADMIN_PROVISIONED` em `auth_audit_log`.
5. Assim que o primeiro administrador estiver ativo, esse endpoint de bootstrap é bloqueado permanentemente no servidor (`ForbiddenError`), e novos usuários só podem ser cadastrados por administradores com a permissão `usuarios.create`.

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
