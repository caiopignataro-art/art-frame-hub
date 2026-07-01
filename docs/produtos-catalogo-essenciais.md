# Produtos — Catálogo & Essenciais

## Estrutura

- **Catálogo** (`/produtos`): produtos alimentados por planilhas XLSX.
  - Perfil de Moldura
  - Passe-partout
- **Essenciais** (`/produtos/essenciais`): cadastro manual, código de 4 dígitos gerado automaticamente.
  - Proteção Frontal
  - Fundo
  - Impressão
  - Chassi
- **Importação** (`/produtos/importacao`): apenas Molduras e Passe-partout.

## Campos comuns (Essenciais)

- `codigo` (auto, 4 dígitos, via `proximo_codigo_produto()`)
- `nome`, `descricao`
- `unidade_venda` (m2 / metro_linear / un)
- `unidade_estoque` (m2 / metro_linear / chapas / caixas / un)
- `preco_custo`, `preco_venda`
- `estoque`, `estoque_ideal`, `estoque_minimo`
- `fornecedor`
- `ativo`

## Campos específicos

- **Chassi**: `preco_venda_acima_m2`, `preco_venda_limite_m2` (default 4 m²).
- **Proteção Frontal / Fundo**: `chapa_largura_cm`, `chapa_altura_cm`.

## Regras de cálculo (Calculadora)

- **Impressão**: `área_arte(m²) × preco_venda × quantidade`. Usa apenas a área
  da arte informada — não considera moldura nem passe-partout.
- **Chassi**:
  - `área_arte ≤ limite (4 m²)` → `perímetro_arte(m) × preco_venda × qtd`.
  - `área_arte > limite`         → `área_arte(m²) × preco_venda_acima_m2 × qtd`.
- **Proteção Frontal / Fundo / Passe-partout**: continuam usando `área_abertura(m²)`.
- **Moldura**: continua usando perímetro comercial (mínimo 1 m) para preço, e
  peça de produção = abertura + 2 × largura do perfil, com distribuição em barras.

## Alertas de estoque

Um produto essencial é sinalizado como crítico quando:

```
ativo = true AND estoque_minimo > 0 AND estoque ≤ estoque_minimo
```

Alertas aparecem em:
- `/produtos/essenciais` (banner + destaque na linha)
- `/dashboard` (Alert vermelho no topo)

## Preços de custo

O preço de compra nunca é exibido na Calculadora ou em telas de pedido. Fica
visível apenas em `/produtos` (Catálogo) e `/produtos/essenciais`.
