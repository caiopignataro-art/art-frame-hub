# Calculadora de Orçamento

## Visão geral
Calculadora disponível na **página inicial** (`/`). Permite montar um quadro
personalizado a partir dos materiais importados via XLSX, calcular custo /
venda / lucro em tempo real e converter o resultado em:

- **Cancelar** — limpa o formulário.
- **Salvar orçamento** — cria um `orcamentos` (status `rascunho`) com 1 item.
- **Adicionar a pedido existente** — anexa item ao `pedidos` escolhido e
  recalcula `valor_total` do pedido. Também grava um orçamento de
  rastreabilidade.
- **Adicionar a novo pedido** — cria pedido novo (sem cliente obrigatório) e
  grava um orçamento de rastreabilidade.

Não exige cliente cadastrado: `pedidos.cliente_id` é nullable.

## Fonte dos dados
**Todos os produtos vêm exclusivamente da tabela `produtos`** alimentada
pelo módulo **Produtos > Importação** (XLSX). Não há cadastro manual.

Filtros usados:
- `tipo = perfil_moldura` → autocomplete de molduras (busca por código OU
  descrição; múltiplos itens).
- `tipo = passe_partout`  → autocomplete de passe-partout (múltiplos, cada
  um com sua medida).
- `tipo = protecao_frontal` → dropdown.
- `tipo = fundo` → dropdown.
- `tipo = servico` → seleção múltipla (checkboxes).

## Campos de entrada
| Campo                 | Tipo    | Regra |
|-----------------------|---------|-------|
| Quantidade            | inteiro | ≥ 1   |
| Largura interna (cm)  | número  | tamanho **interno** da arte |
| Altura interna (cm)   | número  | tamanho **interno** da arte |
| Molduras              | lista   | 0..N, autocomplete por código/descrição |
| Passe-partouts        | lista   | 0..N, cada item tem `medida_cm` própria |
| Proteção frontal      | dropdown| 0..1 |
| Fundo                 | dropdown| 0..1 |
| Serviços              | múltipla| 0..N |
| Observações           | texto   | livre |

## Regras de negócio

### 1. Dimensões finais
A largura/altura informadas representam **exclusivamente** o tamanho
interno da arte. Sempre que existir um ou mais passe-partouts:

```
soma_pp        = Σ medida_cm
largura_final  = largura_interna + (soma_pp × 2)
altura_final   = altura_interna  + (soma_pp × 2)
```

Exemplo: arte 30×40, PP1 = 5, PP2 = 2 → final = **44 × 54 cm**.

### 2. Consumo de moldura (m linear)
```
perimetro_ml = ((largura_final + altura_final) × 2) / 100
```

### 3. Área de materiais (m²)
Vidro/proteção, fundo e passe-partout usam:
```
area_m2 = (largura_final × altura_final) / 10000
```

### 4. Cálculo por material
Cada material no resumo gera:
```
quantidade_total  = quantidade_unitaria × quantidade_quadros
custo_total       = quantidade_total × produto.preco_custo
venda_total       = quantidade_total × produto.preco_venda
lucro             = venda_total − custo_total
```

Onde `quantidade_unitaria` é:

| Origem            | Quantidade unitária |
|-------------------|---------------------|
| Perfil de moldura | `perimetro_ml`      |
| Passe-partout     | `area_m2`           |
| Proteção frontal  | `area_m2`           |
| Fundo             | `area_m2`           |
| Serviço           | `1` (unidade)       |

### 5. Totais
```
total_custo  = Σ custo_total
total_venda  = Σ venda_total
lucro_bruto  = total_venda − total_custo
margem_pct   = (lucro_bruto / total_venda) × 100
```

## Persistência

### Tabelas envolvidas
- `orcamentos` — sempre criado ao salvar/converter (rastreabilidade).
- `orcamento_itens` — 1 linha por quadro calculado.
- `pedidos` — criado ou atualizado conforme ação.
- `pedido_itens` — 1 linha por quadro adicionado.

### Campo `metadados` (JSONB)
Armazena o snapshot completo do cálculo:
```jsonc
{
  "versao": 1,
  "origem": "calculadora",
  "entrada": {
    "largura_interna_cm": 30,
    "altura_interna_cm": 40,
    "passe_partouts": [{ "produto_id": "...", "medida_cm": 5 }, ...],
    "molduras":       [{ "produto_id": "...", "codigo": "..." }],
    "protecao_id": "...",
    "fundo_id": "...",
    "servicos": ["..."],
    "observacoes": "..."
  },
  "calculo": { /* CalcResult completo */ }
}
```

A coluna existe em `orcamentos`, `pedidos`, `orcamento_itens` e
`pedido_itens` (migração `add metadados`).

## APIs (camada de serviços)

Arquivo: `src/lib/services/calculadora.service.ts`

| Método                                     | Efeito |
|--------------------------------------------|--------|
| `salvarOrcamento(input, result)`           | cria `orcamentos` + `orcamento_itens` |
| `criarPedidoNovo(input, result, opts?)`    | cria `pedidos` (cliente opcional) + `pedido_itens` |
| `adicionarAPedidoExistente(id, input, r)`  | insere `pedido_itens` + recalcula `valor_total` |

Engine pura: `src/lib/calculadora/calculator.ts` exporta `calcular(input)`
— testável, sem dependência de I/O.

## Arquitetura

```
src/
├── components/calculadora/
│   ├── Calculadora.tsx          ← UI da página inicial
│   └── ProdutoAutocomplete.tsx  ← combobox código/descrição
├── lib/
│   ├── calculadora/
│   │   ├── calculator.ts        ← engine pura
│   │   └── types.ts             ← CalcInput / CalcResult / Material…
│   └── services/
│       └── calculadora.service.ts
└── routes/index.tsx             ← calculadora + cards de visão geral
```

## Validações
- `largura > 0`, `altura > 0`, `quantidade ≥ 1`.
- Pelo menos um material (moldura, serviço, proteção ou fundo).
- Passe-partout só conta se houver `produto` selecionado.
