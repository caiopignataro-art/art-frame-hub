# Gerenciamento e manutenção de produtos

Este documento descreve as funcionalidades de edição, atualização em massa,
auditoria e exportação do catálogo de produtos.

## Origem dos dados

Os produtos são alimentados **exclusivamente** via importação XLSX
(`/produtos/importacao`). Não há cadastro manual. As funcionalidades abaixo
operam sobre os registros já importados.

## Tela `/produtos`

Tabela completa com colunas: Código, Descrição, Categoria, Fábrica,
Preço Compra, Preço Venda, Quantidade, Status. Suporta:

- Pesquisa por código / descrição / nome
- Filtro por categoria, fabricante e status
- Ordenação por qualquer coluna (clique no cabeçalho)
- Seleção múltipla (checkbox)

### Edição rápida na tabela

Os campos `Preço Venda`, `Quantidade` e `Status` são editáveis diretamente:

- Clique no valor para editar; pressione **Enter** ou clique fora para salvar.
- O `Status` é um switch — alterar salva imediatamente.

### Edição individual (modal)

Botão **Editar** abre o modal com os campos:

- Descrição, Status, Preço Compra, Preço Venda, Quantidade, Observações
- Para **Perfil de Moldura** também: Perfil, Acabamento, Alt(cm), Larg(cm)
- O campo **Código** nunca é editável (chave única do produto)

## Atualização em massa

Botão **Atualização em massa** abre o assistente com três modos:

| Modo | Fórmula | Exemplo |
|---|---|---|
| Percentual | `novo = atual × (1 + p/100)` | `+10%` → 100 → 110 |
| Multiplicador | `novo = atual × fator` | `1,25` → 100 → 125 |
| Preço fixo | `novo = preco` | `49,90` |

### Escopos

- Todos os produtos
- Categoria específica
- Fabricante específico
- Produtos selecionados na tabela

### Simulação obrigatória

Antes de aplicar o sistema exibe:

- Quantidade de produtos afetados
- Total atual × total novo
- Diferença financeira estimada
- Lista detalhada (preço atual, preço novo, Δ%)

### Confirmação

Mensagem explícita: *"Esta operação alterará permanentemente os preços de
venda dos produtos selecionados."* Só após **Confirmar** as mudanças são
gravadas.

### Log da operação em massa

Cada execução grava em `historico`:

- `entidade = "produtos_bulk"`
- `acao = "atualizado"`
- `descricao` com o tipo de modo e quantidade
- `dados_depois`: escopo, modo, qtd afetada, impacto financeiro e até 50
  itens da simulação

Além disso, cada produto alterado individualmente gera seu próprio registro
em `historico` via o trigger `trg_audit_produtos`, com valores antes/depois.

## Histórico de alterações (`/historico`)

Lista todas as alterações registradas pelos triggers de auditoria:

- Filtro por entidade (incluindo `produtos` e `produtos_bulk`)
- Filtro por usuário, intervalo de data e texto livre
- Coluna **Alterações**: diff campo a campo (valor anterior → valor novo)

## Exportação

Botão **Exportar** com escopos `todos`, `filtrados`, `selecionados` e
formatos **XLSX** e **CSV**. Colunas exportadas: Codigo, Descricao, Nome,
Categoria, Fabricante, Perfil, Acabamento, AlturaCm, LarguraCm,
PrecoCompra, PrecoVenda, Quantidade, Status.

## Regras de auditoria

- Toda alteração (manual, inline ou em massa) é registrada pelo trigger
  `trg_audit_produtos` na tabela `historico`.
- Operações em massa também geram um registro consolidado em
  `entidade = "produtos_bulk"`.
- O campo `Código` nunca pode ser alterado — `produtosService.update`
  remove esse campo do payload por segurança.
- O usuário registrado vem do claim JWT (`request.jwt.claim.email`); em
  ambiente sem autenticação aparece como `sistema`.
