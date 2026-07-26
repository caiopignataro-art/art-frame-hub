# Auditoria de Cache — Módulo de Produção (P-002A)

Este relatório consolida o levantamento de chaves de consulta (`queryKeys`), mutações, políticas de expiração (`staleTime`/`gcTime`) e inconsistências identificadas de sincronização de cache no módulo de Produção.

---

## 1. Levantamento de Chaves de Consulta (Query Keys)

O módulo de Produção consome 3 queries principais:

| Query Key | Rota/Origem | Query Function | staleTime | gcTime |
| :--- | :--- | :--- | :--- | :--- |
| `["pedidos"]` | `/producao/` (Kanban) | `pedidosService.list()` | `undefined` (0) | `undefined` (5m) |
| `["ordens_producao"]` | `/producao/ordens` (Lista) | `ordemProducaoService.list()` | `undefined` (0) | `undefined` (5m) |
| `["ordem_producao", id]` | `/producao/ordens/$id` (Detalhe) | `ordemProducaoService.get(id)` | `undefined` (0) | `undefined` (5m) |

---

## 2. Levantamento de Mutações e Invalidações

Identificamos todas as mutações que alteram dados do módulo de produção e suas respectivas estratégias de atualização de cache:

### 2.1. Mutações locais no Kanban (`producao.index.tsx`)
- **`avancar`** (Avança status do pedido):
  - Invalida: `["pedidos"]`
- **`arquivarLote`** (Arquiva lote de orçamentos):
  - Invalida: `["pedidos"]`
- **`finalizarLote`** (Conclui lote de produção):
  - Invalida: `["pedidos"]`
- **`voltarParaAprovado`** (Retorna lote em produção para aprovado):
  - Invalida: `["pedidos"]`
- **`produzirLote`** (Cria OP a partir de pedidos aprovados):
  - Invalida: `["pedidos"]`
- **`voltarLote`** (Retorna lote para orçamento e deleta pagamentos):
  - Invalida: `["pedidos"]`, `["pagamentos"]`

### 2.2. Mutações no Detalhe da OP (`producao.ordens.$id.tsx`)
- **`concluirOp`** (Muda status da OP para concluída):
  - Invalida: `["ordem_producao", id]`, `["ordens_producao"]`
- **`arquivarOp`** (Muda status da OP para cancelada):
  - Invalida: `["ordem_producao", id]`, `["ordens_producao"]`

### 2.3. Mutações na Tabela de Produção (`ProductionTable.tsx`)
Esta tabela opera no detalhe da OP (`/producao/ordens/$id`) e utiliza **Atualização Otimista** (`onMutate`) para alterar o cache local de `["ordem_producao", opId]`:
- **`concluirPedidoProducao`**:
  - Atualiza de forma otimista o status e conclusão de pedido no cache de `["ordem_producao", opId]`.
  - Atualiza o status e conclusão do pedido e status da OP no `onSuccess` diretamente no cache de `["ordem_producao", opId]`.
  - **Invalidações**: Nenhuma.
- **`marcarItemPreparado`**:
  - Atualiza de forma otimista a propriedade `preparado` de itens no cache local.
  - **Invalidações**: Nenhuma.
- **`registrarProblemaItem`**:
  - Atualiza de forma otimista a flag `possui_problema` e detalhes de apontamentos.
  - **Invalidações**: Nenhuma.

---

## 3. Inconsistências e Problemas Identificados

### 3.1. Falta de Sincronização Kanban ⇄ Detalhe da OP
- **Cenário**: Quando o usuário clica em "Concluir Pedido" dentro da tabela do detalhe da OP (através do botão `<ConcluirPedidoButton />`), o status do pedido é alterado no banco para `pronto`.
- **Problema**: Como o botão **não invalida** a query `["pedidos"]`, se o usuário voltar para o Kanban (/producao), o Kanban exibirá o pedido com o status antigo (ex: `em_producao`) até que ocorra um refetch automático por foco de janela ou expiração.

### 3.2. Falta de Sincronização Lista ⇄ Detalhe da OP nas Ações de Item
- **Cenário**: Ao marcar itens como preparados ou apontar problemas, a quantidade geral de itens preparados pode impactar contadores visíveis na listagem de OPs se houver. Adicionalmente, quando o pedido é concluído, o status geral da OP pode passar a `concluida` (atualizado de forma manual na query `["ordem_producao", opId]` de sucesso).
- **Problema**: O parent list `["ordens_producao"]` **não é invalidado** nessas ações de item, deixando a listagem de OPs desatualizada temporariamente.

### 3.3. Refetchs Redundantes / StaleTime Padrão (0)
- **Cenário**: Atualmente, as consultas utilizam o `staleTime` padrão de `0`.
- **Problema**: Toda vez que o usuário navega entre as abas "Fluxo de Produção" (Kanban) e "Ordens de Produção" (Lista de OPs), o TanStack Query dispara requisições HTTP redundantes imediatas ao servidor de banco, sobrecarregando conexões Supabase sem necessidade real, dado que os dados operacionais não mudam a cada segundo.

---

## 4. Recomendações para a Etapa P-002B (Implementação)

1. **Configurar StaleTime/GcTime Otimizados**:
   - Definir um `staleTime` mínimo (ex: `15` a `30` segundos) para `["pedidos"]` e `["ordens_producao"]` para evitar múltiplos requests seguidos ao alternar abas.
2. **Invalidação Cruzada Automatizada**:
   - Garantir que ações na tabela de produção (`concluirPedidoProducao`, `marcarItemPreparado`, `registrarProblemaItem`) invalidem a query `["pedidos"]` do Kanban.
   - Garantir que quando uma OP ou pedido mudar de status no detalhe, a query `["ordens_producao"]` seja devidamente invalidada no `onSuccess`.
3. **Desduplicar Ações**:
   - Remover qualquer refetch manual redundante ou chamadas desnecessárias que possam ignorar o ciclo de vida do TanStack Query.
