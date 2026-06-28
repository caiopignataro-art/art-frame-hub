# Calculadora de Orçamento

Calculadora disponível na **página inicial** (`/`). Permite montar um quadro
a partir dos materiais importados via XLSX, calcular **preço comercial** e
**produção** em tempo real e enviar o resultado para a tela de Novo Pedido
(via `sessionStorage`).

Não exige cliente cadastrado: `pedidos.cliente_id` é nullable.

## Fonte dos dados

Todos os produtos vêm exclusivamente da tabela `produtos`, alimentada
pelo módulo **Produtos > Importação** (XLSX).

| Categoria         | Origem (`produtos.tipo`) | Seleção |
|-------------------|--------------------------|---------|
| Perfil de moldura | `perfil_moldura`         | autocomplete múltiplo |
| Passe-partout     | `passe_partout`          | múltiplo (medida + ordem) |
| Proteção frontal  | `protecao_frontal`       | dropdown |
| Fundo             | `fundo`                  | dropdown |
| Serviços          | `servico`                | checkbox múltiplo |

## Campos de entrada

| Campo            | Tipo    | Regra |
|------------------|---------|-------|
| Quantidade       | inteiro | ≥ 1, inicia vazio |
| Largura (cm)     | número  | medida da arte, inicia vazio |
| Altura (cm)      | número  | medida da arte, inicia vazio |
| Molduras         | lista   | 0..N |
| Passe-partouts   | lista   | 0..N — `medida_cm` + `ordem` (quando ≥ 2) |
| Proteção frontal | dropdown| 0..1 |
| Fundo            | dropdown| 0..1 |
| Serviços         | múltipla| 0..N |
| Observações      | texto   | livre |
| Imagem da arte   | upload  | JPG/PNG/WEBP — apenas referência |

Ordem dos passe-partouts: `interno`, `meio`, `externo` — utilizada para
apresentar a sequência de tamanhos e acompanhar a Ordem de Produção.

## Regras de negócio

### 1. Abertura do quadro

Calculada sempre antes do preço e da produção:

```
soma_pp        = Σ medida_cm
largura_aper.  = largura_arte + (soma_pp × 2)
altura_aper.   = altura_arte  + (soma_pp × 2)
```

**Aviso de chapa**: se `largura_aper > 100` ou `altura_aper > 80` exibimos
o alerta "O tamanho final do Passe-partout ultrapassa a chapa padrão de
100 × 80 cm". O orçamento continua normalmente.

### 2. Cálculo comercial da moldura (preço)

**Não usa a largura do perfil.** Define apenas o valor cobrado do cliente:

```
perimetro_comercial_m = ((largura_aper + altura_aper) × 2) / 100
perimetro_cobrado_m   = max(perimetro_comercial_m, 1)   // mínimo 1 m
valor_moldura         = perimetro_cobrado_m × preco_venda × quadros
```

### 3. Cálculo de produção e estoque

**Usa a largura do perfil.** Define o corte das barras e o consumo de
estoque — não interfere no preço.

```
peca_horizontal = largura_aper + (largura_perfil × 2)    // 2 peças/quadro
peca_vertical   = altura_aper  + (largura_perfil × 2)    // 2 peças/quadro
total_pecas     = 4 × quadros
```

#### Aproveitamento das barras

Comprimento padrão: `estoque.comprimento_barra_cm` (default **270 cm**,
configurável em **Configurações → Estoque**).

Regras:

- Sem emendas — cada peça é cortada inteira de uma única barra.
- Distribuição via **Best-Fit Decreasing**: as peças são ordenadas em ordem
  decrescente e cada uma é alocada na barra com o **menor retalho** que
  ainda a comporte. Se nenhuma cabe, abre-se uma nova barra.
- O sistema informa, por barra, as peças cortadas e o retalho restante.

Exemplo (arte 100×80, PP 5 cm, perfil 2 cm, barra 270):

```
Abertura:           110 × 90
Peças:              114, 114, 94, 94
Barra 1: 114 + 94 = 208 cm   retalho 62 cm
Barra 2: 114 + 94 = 208 cm   retalho 62 cm
Total: 2 barras
```

### 4. Tamanho final exibido

```
largura_final = largura_aper + (largura_perfil × 2)
altura_final  = altura_aper  + (largura_perfil × 2)
```

Quando há mais de uma moldura, a primeira selecionada define o perfil
utilizado para o "Tamanho final" exibido.

### 5. Demais materiais (vidro/fundo/passe-partout)

```
area_m2     = (largura_aper × altura_aper) / 10000
quantidade  = area_m2 × quadros
valor_total = quantidade × preco_venda
```

Serviços são contabilizados como `1 unidade × quadros`.

### 6. Resumo financeiro

```
valor_total     = Σ valor_total dos materiais
valor_unitario  = valor_total / quadros
```

Apenas **Valor unitário** e **Valor total** são exibidos. Custo, lucro
e margem foram removidos da Calculadora.

## Persistência (`metadados` JSONB)

```jsonc
{
  "versao": 2,
  "origem": "calculadora",
  "entrada": {
    "largura_arte_cm": 100,
    "altura_arte_cm": 80,
    "passe_partouts": [
      { "produto_id": "…", "medida_cm": 3, "ordem": "interno" },
      { "produto_id": "…", "medida_cm": 5, "ordem": "externo" }
    ],
    "molduras": [{ "produto_id": "…", "codigo": "…", "descricao": "…" }],
    "protecao_id": "…",
    "fundo_id": "…",
    "servicos": ["…"],
    "observacoes": "…",
    "barra_cm": 270
  },
  "calculo": {
    "largura_abertura_cm": 116,
    "altura_abertura_cm": 96,
    "largura_final_cm": 120,
    "altura_final_cm": 100,
    "molduras": [{
      "perfil_largura_cm": 2,
      "perimetro_comercial_m": 4.24,
      "perimetro_cobrado_m": 4.24,
      "peca_horizontal_cm": 120,
      "peca_vertical_cm": 100,
      "total_pecas": 4,
      "barras": [{ "pecas": [120, 100], "retalho_cm": 50 }],
      "total_barras": 2
    }],
    "valor_unitario": 0,
    "valor_total": 0
  }
}
```

O campo existe em `orcamentos`, `pedidos`, `orcamento_itens` e
`pedido_itens`.

## Ordem de Produção

A Ordem de Produção reutiliza o snapshot acima:

- Medidas da arte, da abertura e de cada PP (com ordem).
- Tamanho final.
- Consumo comercial — **apenas referência**, nunca afeta corte/estoque.
- Peças horizontais/verticais.
- Distribuição das barras, quantidade utilizada e retalho por barra.
- Materiais utilizados.

## Arquitetura

```
src/
├── components/calculadora/
│   ├── Calculadora.tsx          ← UI (tamanhos, produção, materiais, total)
│   └── ProdutoAutocomplete.tsx
├── lib/
│   ├── calculadora/
│   │   ├── calculator.ts        ← engine pura + Best-Fit Decreasing
│   │   └── types.ts             ← CalcInput / CalcResult / MolduraDetalhe…
│   └── services/
│       ├── calculadora.service.ts
│       └── configuracoes.service.ts
└── routes/index.tsx
```

## Validações

- `largura > 0`, `altura > 0`, `quantidade ≥ 1`.
- Pelo menos um material (moldura, serviço, proteção ou fundo).
- Passe-partout só conta quando o produto está selecionado.
- Quando há mais de um PP, atribuir `ordem` é recomendado para a
  apresentação dos tamanhos e da Ordem de Produção.
