# Módulo: Estoque Inteligente de Molduras

## Objetivo
Controlar automaticamente o estoque de molduras (perfis) a partir dos pedidos,
priorizando o uso de retalhos antes de barras novas e gerando ordens de
produção com todas as medidas necessárias.

Os perfis são alimentados exclusivamente pela importação XLSX
(módulo Produtos → Importação). O campo `Quantidade` da planilha
representa **número de barras disponíveis**.

## Configurações (`configuracoes_sistema`)

| Chave | Padrão | Significado |
|---|---|---|
| `estoque.comprimento_barra_cm` | 270 | Comprimento de cada barra de moldura |
| `estoque.perda_corte_percentual` | 15 | % acrescido ao consumo para cobrir perdas no corte |
| `estoque.estoque_minimo_barras_default` | 2 | Mínimo padrão por perfil quando não definido individualmente |

Tudo editável em `/configuracoes`.

## Regra de consumo da moldura

```
largura_externa = largura_final + (Larg(Cm) * 2)
altura_externa  = altura_final  + (Larg(Cm) * 2)
perimetro_cm    = (largura_externa + altura_externa) * 2
consumo_cm      = perimetro_cm * (1 + perda_corte/100)
```

`Larg(Cm)` vem da planilha do perfil (`produtos.largura_cm`).
`largura_final` e `altura_final` vêm da Calculadora
(largura interna + soma dos passe-partouts).

### Exemplo
Arte 40×50, passe-partout 5 cm, perfil de 3 cm, perda 15%:
- final: 50×60
- externa: 56×66
- perímetro: 244 cm
- consumo: **280,6 cm**

## Fluxo de estoque (triggers no banco)

| Evento de pedido | Ação automática |
|---|---|
| Inserido com status de produção | `processar_reserva_pedido` |
| `status → aguardando_producao` | `processar_reserva_pedido` |
| `status → cancelado` | `estornar_reservas_pedido` |
| `status → pronto`/`entregue` | `consumir_reservas_pedido` (gera retalhos) |

### `processar_reserva_pedido(pedido_id)`
Para cada item do pedido e cada moldura nele:
1. Calcula o consumo (regra acima).
2. **Procura retalho disponível** do mesmo perfil com `comprimento_cm >= consumo`,
   escolhendo o **menor que atenda**. Se encontrar, marca o retalho como `usado`,
   cria a reserva apontando para ele, e se sobrar pedaço gera **novo retalho**.
3. Se não houver retalho, debita das barras (fração) e cria a reserva.
4. Cria a **ordem de produção** correspondente.

### `consumir_reservas_pedido(pedido_id)`
Converte reservas ativas em `consumida`, e para reservas que vieram de barra
nova gera um retalho com a sobra (`comprimento_barra - consumo % comprimento_barra`).

### `estornar_reservas_pedido(pedido_id)`
Devolve barras (fração) ao estoque ou reativa retalhos usados, e marca a
reserva como `estornada`.

## Tabelas

- `configuracoes_sistema` — chave/valor JSONB
- `estoque_movimentacoes` — auditoria (tipo, qtd_cm, qtd_barras, saldo antes/depois, usuario)
- `retalhos` — sobras (`disponivel`, `usado`, `descartado`)
- `reservas_estoque` — vínculo pedido↔produto com `retalho_id` quando aplicável
- `ordens_producao` — OP por item, com medidas externas e consumos
- `fabricante_estoque_minimo` — mínimo por fabricante

## Métricas (`/estoque`)
- Barras disponíveis · retalhos · perfis abaixo do mínimo
- Valor financeiro do estoque e dos retalhos
- Consumo do mês

## APIs (cliente)
Em `src/lib/services/estoque.service.ts`:
- `listarPerfis()` / `resumo()`
- `listarRetalhos()` / `descartarRetalho()`
- `listarMovimentacoes()` / `listarReservas()` / `listarOrdensProducao()`
- `ajustarEstoque(produtoId, deltaBarras, obs)`
- `setMinimoProduto()` / `setMinimoFabricante()`

Em `src/lib/services/configuracoes.service.ts`:
- `list()` / `getNumber()` / `setNumber()`

## Auditoria
Toda movimentação registra em `estoque_movimentacoes`: produto, pedido,
reserva/retalho relacionados, tipo, quantidade (cm e barras),
saldo anterior e posterior, usuário (JWT email ou "sistema") e observação.

## Fluxograma
```
Pedido aprovado
  └── trigger: processar_reserva_pedido
        ├── retalho serve? → uso_retalho + sobra vira retalho novo
        └── senão        → reserva de barra + débito proporcional
              └── cria ordem_producao

Pedido cancelado
  └── trigger: estornar_reservas_pedido → barras/retalhos voltam

Pedido pronto/entregue
  └── trigger: consumir_reservas_pedido → reserva vira consumo + retalho sobra
```
