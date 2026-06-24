# Importação de Produtos via XLSX

O catálogo de produtos do ERP é **alimentado exclusivamente por planilhas XLSX**.
Não existe cadastro manual — toda inclusão, atualização ou desativação de produto
acontece através da tela **Produtos → Importação**.

## Fluxo

1. **Selecionar categoria** da planilha.
2. **Upload** do arquivo `.xlsx` (parsing roda no navegador).
3. **Pré-visualização** das linhas normalizadas + bloco de inconsistências
   (erros e avisos por linha).
4. **Confirmar importação** → executa `UPSERT` em `produtos` usando `codigo`
   como chave de conflito.
5. **Histórico** da importação é gravado em `importacoes` com totais e log de erros.

## Categorias suportadas

| Categoria          | Enum (`produto_tipo`) | Unidade padrão |
| ------------------ | --------------------- | -------------- |
| Perfil de Moldura  | `perfil_moldura`      | `barra`        |
| Passe-partout      | `passe_partout`       | `folha`        |
| Proteção Frontal   | `protecao_frontal`    | `folha`        |
| Fundo              | `fundo`               | `folha`        |
| Serviços           | `servico`             | `un`           |

## Schema obrigatório — Perfil de Moldura

Os cabeçalhos devem corresponder exatamente (a importação aceita variações
acentuadas e em caixa diferente):

| Coluna XLSX     | Campo no banco           | Tipo     | Obrigatório |
| --------------- | ------------------------ | -------- | ----------- |
| Fábrica         | `fabricante`             | texto    | recomendado |
| **Código**      | `codigo` (chave única)   | texto    | **sim**     |
| Perfil          | `perfil`                 | texto    | recomendado |
| Acabamento      | `acabamento`             | texto    | recomendado |
| Descrição       | `descricao`              | texto    | não         |
| Status          | `ativo` (boolean)        | texto    | não         |
| Alt(Cm)         | `altura_cm`              | numérico | recomendado |
| Larg(Cm)        | `largura_cm`             | numérico | recomendado |
| Preço Compra    | `preco_custo`            | numérico | sim         |
| Preço Venda     | `preco_venda`            | numérico | sim         |
| Quantidade      | `estoque`                | numérico | não         |

**Nome do produto** é gerado automaticamente como
`"<Perfil> — <Acabamento>"`, com fallback para `descricao` ou `"Perfil <codigo>"`.

### Status → ativo

Valores tratados como `ativo = true`: `ativo`, `ativa`, `sim`, `s`, `1`,
`true`, `yes`, `habilitado`. Qualquer outro valor → `ativo = false`. Campo
vazio → `true`.

### Números

Aceita formatos `1.234,56` (BR) e `1234.56` (US), com ou sem prefixo `R$`.

## Schema genérico — Passe-partout, Proteção Frontal, Fundo, Serviços

| Coluna XLSX     | Campo no banco | Obrigatório |
| --------------- | -------------- | ----------- |
| Código          | `codigo`       | **sim**     |
| Descrição       | `nome`/`descricao` | **sim** |
| Preço Compra    | `preco_custo`  | recomendado |
| Preço Venda     | `preco_venda`  | sim         |
| Quantidade      | `estoque`      | não         |
| Fábrica         | `fabricante`   | opcional    |
| Status          | `ativo`        | opcional    |
| Unidade         | `unidade`      | opcional    |

## Regras de negócio

- **Código é único** (índice `produtos_codigo_unique`). Duplicidades dentro da
  mesma planilha são detectadas no parse e marcadas como **erro** (linha
  ignorada).
- **Reimportação atualiza** registros existentes (`upsert` com
  `onConflict: codigo`). Campos não presentes na planilha preservam o valor
  atual? Não — o upsert envia todos os campos calculados, portanto sempre
  reflete o estado da planilha.
- **Linhas com erro são ignoradas**; linhas com aviso são importadas.
- O histórico (`importacoes`) registra contagens de inseridos, atualizados,
  ignorados, erros e o detalhamento das inconsistências em `erros_detalhe`
  (JSONB).
- A tabela `historico` registra automaticamente cada `INSERT`/`UPDATE` em
  `produtos` via trigger `tg_audit_historico`, mantendo rastreabilidade
  completa.

## Validações executadas

- `codigo` vazio → erro.
- `codigo` duplicado na planilha → erro.
- `preco_venda < preco_custo` → aviso.
- Linha sem `perfil` nem `descricao` → aviso (nome ficará genérico).
- Valores numéricos inválidos em `preco_*` → aviso (assume `0`).

## Arquitetura

```
src/routes/produtos.tsx              # layout com abas
src/routes/produtos.index.tsx        # catálogo (somente leitura)
src/routes/produtos.importacao.tsx   # tela de importação
src/lib/importacao/parsers.ts        # parsers + validação por categoria
src/lib/services/importacoes.service.ts  # commit (upsert + registro)
src/lib/services/produtos.service.ts # leitura do catálogo
```

### Banco

- `produtos` (estendida): `fabricante`, `perfil`, `acabamento`,
  `altura_cm`, `largura_cm` + índice único parcial em `codigo`.
- `importacoes`: `categoria`, `arquivo_nome`, totais, `erros_detalhe` (JSONB),
  `status` (`concluido` | `parcial` | `falha`).
- Enum `produto_tipo` estendido com `perfil_moldura`, `passe_partout`,
  `protecao_frontal`.
