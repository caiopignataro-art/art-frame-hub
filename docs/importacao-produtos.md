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

## Atualização de Estoque (Perfil de Moldura)

A tela de importação oferece dois **modos** para a categoria
**Perfil de Moldura**:

### Importação Completa
Insere produtos novos e atualiza **todos** os campos dos existentes
(`fabricante`, `perfil`, `acabamento`, `descricao`, `ativo`, `altura_cm`,
`largura_cm`, `preco_custo`, `preco_venda`, `estoque`), localizando pelo
`codigo`. Use para cadastro inicial ou refresh completo do catálogo.

### Atualizar Apenas Estoque (padrão)
Localiza o produto pelo `codigo` e atualiza **somente** o campo `estoque`.
Todos os demais campos da planilha são **ignorados**, mesmo que diferentes
do cadastro. Códigos não cadastrados são contabilizados como
"não encontrados" e não geram inserção. Use durante inventários, conferências
e reposições.

### Regra do campo Código
- `codigo` é a **chave única absoluta** do produto (índice
  `produtos_codigo_unique`).
- Toda atualização localiza o registro pelo `codigo`.
- Alterações em `perfil`, `acabamento` ou `descricao` **não** criam novo
  registro quando o `codigo` já existe.
- Duplicidade dentro da mesma planilha → erro (linha ignorada).

### Exemplo prático (modo Atualizar Apenas Estoque)
Cadastro atual:
```
Código: 12340001
Descrição: Moldura Preta Fosca
Preço Compra: 15,50
Preço Venda: 42,00
Quantidade: 10
```
Planilha importada:
```
Código: 12340001
Descrição: Texto Diferente
Preço Compra: 18,00
Preço Venda: 50,00
Quantidade: 25
```
Resultado no banco: descrição, preço de compra e preço de venda permanecem
inalterados; apenas `estoque` passa para `25`.

### Confirmação obrigatória
Antes de executar o commit o sistema exibe um diálogo:
- **Importação Completa** → "Esta operação poderá atualizar preços e
  informações cadastrais."
- **Atualizar Apenas Estoque** → "Esta operação atualizará somente as
  quantidades em estoque."

### Relatório e auditoria
O toast final e o histórico (`importacoes`) trazem:
- Produtos localizados / atualizados / ignorados / novos / erros.
- No modo Estoque: "X registros tiveram apenas a quantidade atualizada".
- `arquivo_nome` é prefixado com `[Estoque]` ou `[Completo]` para
  identificação visual.
- `erros_detalhe` recebe um aviso inicial descrevendo o modo executado.
- A trigger `tg_audit_historico` continua registrando cada `UPDATE` em
  `produtos` na tabela `historico` (usuário, antes/depois, data).

### Fluxo recomendado para inventários periódicos
1. Exportar a planilha do estoque físico (somente `Código` e `Quantidade`
   são obrigatórios — demais colunas podem permanecer em branco).
2. Acessar **Produtos → Importação**, selecionar **Perfil de Moldura** e o
   modo **Atualizar Apenas Estoque** (já vem marcado por padrão).
3. Carregar o XLSX, conferir a pré-visualização (preço/descrição aparecem
   riscados, indicando que serão ignorados).
4. Confirmar — o sistema atualiza apenas as quantidades e registra a
   auditoria.
