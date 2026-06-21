# Molduraria ERP — Arquitetura

ERP para gestão de uma molduraria: clientes, orçamentos, pedidos, produção,
pagamentos, produtos e auditoria.

## Stack

- **TanStack Start** (React 19 + Vite) — equivalente ao Next.js no Lovable
- **TypeScript** estrito
- **TailwindCSS v4** + **Shadcn/UI**
- **Lovable Cloud (Supabase)** — Postgres, Auth e Storage gerenciados
- **TanStack Query** — cache de dados no cliente

## Estrutura de pastas

```
src/
├── routes/                       # File-based routing (cada arquivo = rota)
│   ├── __root.tsx                # Layout raiz
│   ├── index.tsx                 # /            → Dashboard
│   ├── clientes.tsx              # /clientes
│   ├── orcamentos.tsx            # /orcamentos
│   ├── pedidos.tsx               # /pedidos
│   ├── producao.tsx              # /producao    → Kanban
│   ├── pagamentos.tsx            # /pagamentos
│   ├── produtos.tsx              # /produtos
│   ├── historico.tsx             # /historico   → Auditoria
│   └── api/                      # Server routes (HTTP cru: webhooks, públicos)
│
├── components/
│   ├── layout/AppShell.tsx       # Shell com sidebar + header
│   ├── erp/                      # Componentes de domínio (badges, headers…)
│   └── ui/                       # Shadcn (não editar diretamente)
│
├── lib/
│   ├── services/                 # Camada de acesso ao banco (CRUD tipado)
│   │   ├── clientes.service.ts
│   │   ├── produtos.service.ts
│   │   ├── orcamentos.service.ts
│   │   ├── pedidos.service.ts
│   │   ├── pagamentos.service.ts
│   │   └── historico.service.ts
│   ├── format.ts                 # Formatadores (BRL, datas)
│   └── utils.ts
│
├── types/
│   └── erp.ts                    # Re-export tipado dos schemas do banco
│
├── integrations/supabase/        # Auto-gerado (cliente, types, auth) — não editar
└── styles.css                    # Design system (tokens semânticos)
```

## Banco de dados

### Tabelas

| Tabela            | Descrição                                                  |
|-------------------|-------------------------------------------------------------|
| `clientes`        | Cadastro de clientes                                        |
| `produtos`        | Catálogo (molduras, vidros, paspatur, serviços, etc.)       |
| `orcamentos`      | Propostas, numeração automática via sequência               |
| `orcamento_itens` | Itens do orçamento (dimensões cm, quantidade, valor)        |
| `pedidos`         | Pedido confirmado, opcionalmente vinculado a um orçamento   |
| `pedido_itens`    | Itens de produção                                           |
| `pagamentos`      | Recebimentos parciais ou totais por pedido                  |
| `historico`       | Auditoria — preenchida automaticamente por triggers          |

### Enums

- `orcamento_status`: rascunho · enviado · aprovado · recusado · expirado · convertido
- `pedido_status`: aguardando_producao · em_producao · pronto · entregue · cancelado
- `pagamento_status`: pendente · pago · parcial · estornado · cancelado
- `forma_pagamento`: dinheiro · pix · cartao_credito · cartao_debito · transferencia · boleto · outro
- `produto_tipo`: moldura · vidro · paspatur · fundo · acessorio · servico · outro
- `historico_acao`: criado · atualizado · excluido · status_alterado

### Triggers automáticos

- `updated_at` mantido por trigger em todas as tabelas.
- `historico` recebe um registro a cada INSERT/UPDATE/DELETE em todas as
  tabelas principais (com snapshot JSONB do antes/depois).
- Numeração: `numero_orcamento` e `numero_pedido` usam `SEQUENCE` (começam em 1000).

### Índices

- `clientes`: nome (lower), cpf_cnpj, email
- `produtos`: tipo, ativo, nome
- `orcamentos` / `pedidos`: cliente_id, status, created_at DESC
- `pagamentos`: pedido_id, status, data
- `historico`: (entidade, entidade_id), created_at DESC

### RLS

> ⚠️ Atualmente em **modo desenvolvimento aberto**: políticas `USING (true)`
> permitem acesso anônimo total. Antes de produção:
>
> 1. Implementar autenticação (`lovable.auth.signInWithOAuth("google", …)`).
> 2. Criar tabela `user_roles` + função `has_role()` (ver docs do projeto).
> 3. Substituir as policies por checagens com `auth.uid()` e papel.

## Camada de acesso a dados

Toda interação com o banco passa por `src/lib/services/*.service.ts`.
Cada serviço expõe métodos tipados (`list`, `get`, `create`, `update`, `remove`),
consumidos pelos componentes via TanStack Query:

```ts
const { data } = useQuery({
  queryKey: ["clientes"],
  queryFn: clientesService.list,
});
```

Quando a autenticação for adicionada, esses serviços podem ser facilmente
migrados para `createServerFn` (RPC server-side com `requireSupabaseAuth`)
sem alterar a interface pública chamada pelos componentes.

## Próximos módulos

- [ ] Formulários de criação/edição (clientes, orçamentos, pedidos, produtos)
- [ ] **Calculadora de molduras** (perímetro × preço da moldura + área do vidro/paspatur + serviços)
- [ ] Conversão orçamento → pedido (server function transacional)
- [ ] Geração de PDF do orçamento
- [ ] Autenticação + papéis (admin / atendente / produção)
- [ ] Dashboard com gráficos (faturamento mês, mix de produtos)
