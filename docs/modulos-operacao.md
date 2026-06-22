# Módulos de Operação — Pedidos, Produção, Pagamentos, Dashboard, WhatsApp

## Fluxo de negócio
```
Orçamento ─aprovado─▶ Pedido ─▶ Produção ─▶ Entrega
                                    │
                                    └─ Pagamentos (1..N)
                                    └─ Notificações WhatsApp (eventos)
```

## Status

### Orçamento (`orcamento_status`)
`rascunho` · `enviado` · `aprovado` · `convertido` · `recusado` · `expirado`

### Pedido (`pedido_status`) — fluxo de produção
`aguardando_producao` → `em_producao` → `montagem` → `controle_qualidade` → `pronto` → `entregue`
(estado terminal alternativo: `cancelado`)

### Pagamento (`pagamento_status`)
`pendente` · `parcial` · `pago` · `estornado` · `cancelado`

### Forma de pagamento
`dinheiro` · `pix` · `cartao_credito` · `cartao_debito` · `transferencia` · `boleto` · `outro`

## Telas

| Rota | Função |
|------|--------|
| `/` | Calculadora de orçamento |
| `/dashboard` | KPIs, faturamento, clientes recorrentes, produtos mais usados |
| `/pedidos` | Listagem com busca + filtros + detalhes (timeline) |
| `/producao` | Kanban 5 colunas com botão "Avançar" status |
| `/pagamentos` | Listagem + registro de pagamento por pedido |
| `/orcamentos` | Listagem de orçamentos |
| `/historico` | Audit log global |

## APIs (services)
- `pedidosService` — list/get/create/update/setStatus/addItem
- `pagamentosService` — listAll/listByPedido/create/update
- `orcamentosService` — list/get/create/setStatus/addItem
- `historicoService` — list (filtro por entidade/id)
- `dashboardService.load()` — agrega KPIs + séries
- `whatsappService` — fila de notificações (enfileirar / marcarEnviado / marcarFalha)

## Banco — complementos
- Enum `pedido_status` ampliado com `montagem` e `controle_qualidade`.
- Tabela `notificacoes_whatsapp` (fila de mensagens):
  - colunas: `pedido_id`, `cliente_id`, `evento`, `destinatario`, `mensagem`,
    `status` (`pendente|enviado|falha|cancelado`), `tentativas`, `erro`, `payload`, `enviado_em`
- Trigger `tg_pedido_whatsapp_eventos`: ao mudar o status do pedido para
  `aguardando_producao` (= aprovado), `pronto` ou `entregue`, enfileira
  automaticamente uma mensagem usando o WhatsApp/telefone do cliente.
- Triggers de auditoria existentes continuam capturando todas as mudanças
  em `historico` (consumido pela timeline do pedido).

## Integração WhatsApp (futura)
Arquitetura desacoplada por **fila**:
1. Eventos do domínio gravam linhas em `notificacoes_whatsapp` (via trigger
   ou via `whatsappService.dispararEvento`).
2. Um worker (Edge Function / cron) lê `status='pendente'`, chama o
   provedor (Cloud API oficial, Z-API, Twilio…) e atualiza o status para
   `enviado` ou `falha`.
3. Reentrega: incrementar `tentativas` + agendar retry exponencial.

Eventos atualmente suportados:
- `pedido_aprovado`
- `pedido_pronto`
- `pedido_entregue`
- `orcamento_enviado` (manual)
- `pagamento_recebido` (manual)

## Regras de negócio
- **Aprovação de orçamento** muda o status para `aprovado`/`convertido` e gera
  um pedido (já implementado via `calculadora.service`).
- **Avanço de produção** só ocorre em sequência (`PEDIDO_FLUXO`).
- **Cancelado** é estado terminal — não dispara WhatsApp.
- **Pagamento `pago`** define `data_pagamento = now()` por padrão.
- **Lucro estimado** no dashboard usa margem média de 45% sobre faturamento
  do mês (placeholder até integração com custos reais de calculadora).
- **Clientes recorrentes**: top 5 por quantidade de pedidos.
- **Produtos mais usados**: top 5 por quantidade somada nos `pedido_itens`.
