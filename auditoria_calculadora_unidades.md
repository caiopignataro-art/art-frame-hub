# AUDITORIA TÉCNICA — CALCULADORA: MATERIAIS UTILIZADOS E CONSISTÊNCIA DE UNIDADES

## 1. Resumo Executivo

Esta auditoria técnica investigou a tabela **Materiais utilizados** da Calculadora de Orçamento (`/`), especificamente a divergência identificada entre as grandezas calculadas e as unidades textuais apresentadas:
- **Moldura:** A quantidade calculada é expressa em metros lineares, porém a tabela exibe a unidade `barra`.
- **Passe-partout:** A quantidade calculada é expressa em metros quadrados, porém a tabela exibe a unidade `folha`.

### Diagnóstico Principal
1. **A matemática e os valores monetários estão corretos:** O motor de cálculo calcula a quantidade em metros lineares para molduras (`perimetro_cobrado_m`) e em metros quadrados para passe-partouts (`areaM2`). Os preços de venda cadastrados são unitários por metro linear e por metro quadrado, respectivamente.
2. **A causa raiz é a propagação cega da unidade de cadastro:** A função interna `materialDePreco()` em `src/lib/calculadora/calculator.ts` atribui `unidade: produto.unidade` diretamente do registro do catálogo.
3. **Origem do valor cadastral:** O parser de importação de planilhas (`src/lib/importacao/parsers.ts`) fixa `"barra"` como unidade padrão para perfis de moldura e `"folha"` para passe-partouts (que representam as unidades comerciais de compra/fardo dos fabricantes, não a unidade de dimensionamento do cálculo).
4. **Violação de contrato de tipos:** O contrato de interface `MaterialCalculado` em `src/lib/calculadora/types.ts` documenta explicitamente:
   > `/** Quantidade cobrada (m para moldura, m² para áreas, un para serviços). */`
   No entanto, a implementação repassa a string de embalagem comercial cadastrada em `produtos.unidade`.

A divergência decorre da camada de geração dos itens de cálculo (`calculator.ts`), que confunde a **unidade de embalagem cadastrada no produto** com a **unidade da grandeza calculada**.

---

## 2. Mapeamento do Fluxo dos Dados

O ciclo de vida dos dados percorre o seguinte fluxo:

```
[Importação XLSX ou Cadastro Manual]
      │
      ├── Moldura: produto.unidade = "barra"
      └── Passe-partout: produto.unidade = "folha"
      ▼
[Tabela 'produtos' no Supabase]
      │
      ▼
[Calculadora UI: seleção de materiais]
      │
      ├── Medidas da Arte (largura_interna_cm × altura_interna_cm)
      ├── Quantidade de Quadros (qtd)
      └── Produtos Selecionados (molduras[], passe_partouts[], etc.)
      ▼
[Engine: calcular(input) em calculator.ts]
      │
      ├── Moldura: perimetro_cobrado_m = max(((aberturaL + aberturaA) × 2) / 100, 1)  [m lineares]
      ├── Passe-partout: areaM2 = (aberturaL × aberturaA) / 10000                     [m²]
      │
      ▼
[materialDePreco(produto, origem, quantidadeUnitaria, quadros)]
      │
      ├── qty = round(quantidadeUnitaria × quadros)   [Grandeza física calculada]
      ├── preco_venda = Number(produto.preco_venda)   [Preço unitário por m ou m²]
      ├── valor_total = qty × preco_venda             [Valor financeiro correto]
      └── unidade = produto.unidade                   ◄─── FALHA AQUI: copia "barra" ou "folha"
      ▼
[Array result.materiais: MaterialCalculado[]]
      │
      ├── Renderização: Calculadora.tsx
      │     └── <TableCell>{m.quantidade} {m.unidade}</TableCell>
      │           └── Exibe: "2.4 barra" e "0.3 folha"
      │
      ├── Persistência: calculadora.service.ts
      │     └── metadados.calculo.materiais
      │
      └── Linha da OP / Produção: prepareProductionRows.ts
            └── Consome origem e descricao (independente de m.unidade)
```

---

## 3. Arquivos e Funções Inspecionados

| Arquivo | Localização | Função / Linhas Relevantes | Papel no Fluxo |
| :--- | :--- | :--- | :--- |
| `src/lib/calculadora/calculator.ts` | Linhas 41–58 | `materialDePreco()` | Constrói o objeto `MaterialCalculado` atribuindo `unidade: produto.unidade` |
| `src/lib/calculadora/calculator.ts` | Linhas 146–176 | `calcular()` (bloco molduras) | Calcula `perimetro_comercial_m` e `perimetro_cobrado_m` em metros |
| `src/lib/calculadora/calculator.ts` | Linhas 117–121 | `calcular()` (bloco abertura) | Calcula `areaM2` da abertura em metros quadrados |
| `src/lib/calculadora/calculator.ts` | Linhas 178–228 | `calcular()` (bloco materiais) | Dispara `materialDePreco` para molduras e passe-partouts |
| `src/lib/calculadora/types.ts` | Linhas 46–57 | `interface MaterialCalculado` | Define o contrato de saída dos materiais com a unidade cobrada |
| `src/components/calculadora/Calculadora.tsx` | Linhas 742–777 | Tabela `Materiais utilizados` | Renderiza `m.quantidade` e `m.unidade` na interface |
| `src/lib/importacao/parsers.ts` | Linha 122 | `parsePerfilMoldura()` | Define `unidade: "barra"` como padrão para perfis de moldura importados |
| `src/lib/importacao/parsers.ts` | Linhas 152–162 | `parseGenerico()` | Define `unidadePadrao.passe_partout = "folha"` para passe-partouts |
| `src/components/produtos/ProdutoEditDialog.tsx` | Linhas 83–85, 120–126 | `UNIDADES_VENDA`, `setForm` | Define opções e defaults de unidade no formulário de produtos |
| `src/lib/services/calculadora.service.ts` | Linhas 17–59 | `buildMetadados()`, `buildDraftItem()` | Serializa `result.materiais` para o rascunho do pedido |
| `src/lib/production/prepareProductionRows.ts` | Linhas 98–122 | `prepareProductionRows()` | Lê `metadados.calculo.materiais` para a Ordem de Produção |

---

## 4. Evidências da Origem das Unidades Exibidas

### Evidência 1: No parser de importação de Molduras
Em `src/lib/importacao/parsers.ts`:
```typescript
118: rows.push({
119:   codigo,
120:   nome,
121:   tipo: "perfil_moldura",
122:   unidade: "barra",       // <--- Hardcoded na importação da planilha
123:   preco_custo: precoCompra ?? 0,
124:   preco_venda: precoVenda ?? 0,
...
```

### Evidência 2: No parser de importação de Passe-partout
Em `src/lib/importacao/parsers.ts`:
```typescript
152: const unidadePadrao: Record<typeof categoria, string> = {
153:   passe_partout: "folha", // <--- Hardcoded na importação da planilha
154: };
```

### Evidência 3: Na função construtora de materiais de cálculo
Em `src/lib/calculadora/calculator.ts`:
```typescript
41: function materialDePreco(
42:   produto: Produto,
43:   origem: MaterialOrigem,
44:   quantidadeUnitaria: number,
45:   quadros: number,
46: ): MaterialCalculado {
47:   const qty = round(quantidadeUnitaria * quadros);
48:   return {
49:     produto_id: produto.id,
50:     codigo: produto.codigo,
51:     descricao: produto.nome,
52:     origem,
53:     unidade: produto.unidade, // <--- Propagação cega do cadastro
54:     quantidade: qty,
55:     preco_venda: Number(produto.preco_venda),
56:     valor_total: round(qty * Number(produto.preco_venda), 2),
57:   };
58: }
```

### Evidência 4: Na renderização da tabela
Em `src/components/calculadora/Calculadora.tsx`:
```tsx
771: <TableCell className="text-right text-xs">{m.quantidade} {m.unidade}</TableCell>
```
A tabela renderiza exatamente a string contida em `m.unidade`, que foi preenchida com a string de `produto.unidade`.

---

## 5. Diagnóstico Separado para Moldura e Passe-partout

### 5.1. Caso A — Moldura

* **Como o comprimento utilizado é calculado:**
  Calculado com base no perímetro da abertura interna do quadro:
  $$\text{perimetro\_comercial\_m} = \frac{(\text{largura\_abertura} + \text{altura\_abertura}) \times 2}{100}$$
  O consumo cobrado aplica o piso mínimo de 1 metro:
  $$\text{perimetro\_cobrado\_m} = \max(\text{perimetro\_comercial\_m}, 1)$$
* **Grandeza física da quantidade:**
  Metros lineares. Para $Q$ quadros:
  $$\text{quantidade} = \text{perimetro\_cobrado\_m} \times Q$$
* **Existe conversão para barras no preço?**
  **Não.** O preço comercial `preco_venda` cadastrado na tabela de preços é o valor de venda por **metro linear**. A conversão para barras ocorre exclusivamente na rotina de corte (`packBarras`), gerando a distribuição de barras para a produção e retalhos.
* **Por que aparece `barra`?**
  Porque `produto.unidade` foi cadastrado como `"barra"` na planilha. Ao repassar `produto.unidade`, a tabela exibe ex.: `2.4 barra` em vez de `2.4 m_linear`.
* **Ajuste da unidade altera cálculo, preço ou estoque?**
  Não. O valor cobrado já é `metros × preco_metro`. O estoque de barras continua sendo gerenciado pelos módulos de produção e reserva em cm e barras.

---

### 5.2. Caso B — Passe-partout

* **Como a área utilizada é calculada:**
  Calculada a partir das medidas da abertura externa resultante após a aplicação do passe-partout:
  $$\text{area\_m2} = \frac{\text{largura\_abertura} \times \text{altura\_abertura}}{10000}$$
* **Grandeza física da quantidade:**
  Metros quadrados ($m^2$). Para $Q$ quadros:
  $$\text{quantidade} = \text{area\_m2} \times Q$$
* **Existe conversão para folhas no preço?**
  **Não.** O preço de venda `preco_venda` do catálogo de passe-partouts é o valor por **metro quadrado**.
* **Por que aparece `folha`?**
  Porque a planilha importada recebeu o default `"folha"` no parser genérico. O cálculo atribui `produto.unidade` diretamente ao item, gerando ex.: `0.35 folha` para uma área de $0{,}35\text{ m}^2$.
* **Ajuste da unidade altera cálculo, preço ou estoque?**
  Não. O valor financeiro já é `m² × preco_m²`.

---

## 6. Verificação das Fórmulas, Conversões e Agregações

### 6.1. Como os materiais são agregados dentro do cálculo
Na Calculadora, o campo `input.quantidade` representa a **tiragem do item (número de quadros)**.
A função `materialDePreco` multiplica a quantidade unitária pela tiragem:
$$\text{qty} = \text{round}(\text{quantidadeUnitaria} \times \text{quadros})$$
$$\text{valor\_total} = \text{round}(\text{qty} \times \text{preco\_venda}, 2)$$

- **Tiragem de quadros:** Se o orçamento for para 5 quadros de $50 \times 70\text{ cm}$:
  - Moldura unitária: $2{,}40\text{ m}$.
  - Total consolidado: $2{,}40 \times 5 = 12{,}00\text{ m}$.
  - Valor: $12 \times \text{R\$} 50{,}00 = \text{R\$} 600{,}00$.
- **Múltiplas molduras (perfil composto / duplo):**
  Quando o usuário adiciona 2 molduras na calculadora (ex: Moldura externa e Filete interno), o loop `for (const m of molduras)` gera **duas linhas distintas** no array `result.materiais`, uma para cada moldura.
- **Múltiplos passe-partouts:**
  Quando há 2 ou mais passe-partouts (interno, meio, externo), o loop `for (const pp of passesOrdenados)` gera **uma linha distinta para cada passe-partout**, calculando a área comum da abertura para cada um deles.
- **Compatibilidade dimensional:**
  Como cada componente gera sua própria linha descritiva com seu código e especificação, não ocorre soma de grandezas incompatíveis (ex.: metros lineares com metros quadrados).

---

## 7. Matriz Comparativa entre Unidades

| Categoria do Material | Unidade Cadastrada (`produtos.unidade`) | Grandeza Física Real do Cálculo | Unidade Atual Exibida | Unidade Esperada pelo Usuário | Fórmula Financeira |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Perfil de Moldura** | `barra` (ou `m` em legados) | Metros Lineares ($m$) | `barra` ❌ | `m_linear` ✅ | `perimetro_cobrado_m × preco_venda` |
| **Passe-partout** | `folha` (ou `un`) | Metros Quadrados ($m^2$) | `folha` ❌ | `m2` ✅ | `area_m2 × preco_venda` |
| **Proteção Frontal (Vidro)** | `m2` ou `chapas` | Metros Quadrados ($m^2$) | `m2` ou `chapas` | `m2` | `area_m2 × preco_venda` |
| **Fundo** | `m2` ou `chapas` | Metros Quadrados ($m^2$) | `m2` ou `chapas` | `m2` | `area_m2 × preco_venda` |
| **Impressão** | `m2` | Metros Quadrados ($m^2$) | `m2` | `m2` | `area_arte_m2 × preco_venda` |
| **Chassi (até 4 m²)** | `metro_linear` | Metros Lineares ($m$) | `metro_linear` | `m_linear` / `metro_linear` | `perimetro_m × preco_venda` |
| **Chassi (acima 4 m²)** | `m2` | Metros Quadrados ($m^2$) | `m2` | `m2` | `area_arte_m2 × preco_acima_m2` |
| **Serviço** | `un` | Unidades (por quadro) | `un` | `un` | `1 × quadros × preco_venda` |

---

## 8. Impactos Potenciais sobre Preços, Estoque, Persistência e Produção

1. **Preços e Finanças:**
   * **Impacto nulo.** As fórmulas financeiras utilizam diretamente os valores numéricos `quantidade` e `preco_venda`. Nenhuma operação depende do texto de `unidade`.
2. **Estoque e Retalhos:**
   * **Impacto nulo.** A rotina de estoque (`processar_reserva_pedido` e `estoque_movimentacoes`) calcula consumos através de `comprimento_cm` e `quantidade_barras` via triggers e RPCs independentes. Ela não lê o campo `unidade` de `MaterialCalculado`.
3. **Ordem de Produção (OP):**
   * **Impacto nulo.** O arquivo `src/lib/production/prepareProductionRows.ts` consome `origem` e `descricao` dos materiais para identificar proteção, fundo, impressão, chassi e serviços. A coluna de molduras e o plano de corte utilizam `molduras[].barras` e `peca_horizontal_cm` / `peca_vertical_cm`.
4. **Persistência de Metadados (`metadados.calculo`):**
   * O array `materiais` é serializado no snapshot JSONB. Ao salvar `m_linear` e `m2`, futuros pedidos e consultas terão dados semanticamente coerentes e auditáveis.

---

## 9. Correção Mínima Recomendada

Para atender às diretrizes do projeto:
- **Não fazer manipulação cosmética restrita ao JSX** que mascare dados incorretos no payload.
- **Não forçar migrations destrutivas ou alterar unidades de estoque do catálogo**.
- **Garantir consistência semântica diretamente no motor de cálculo**.

### Solução Proposta

Ajustar a atribuição da unidade em `src/lib/calculadora/calculator.ts` para que a engine defina a unidade da grandeza de cálculo de acordo com a `origem` do material (ou permitindo sobrescrita de unidade canônica de cálculo):

#### 1. Em `src/lib/calculadora/calculator.ts`:
Modificar o helper `materialDePreco` (ou sua chamada) para associar a unidade dimensional correta de cada componente cobrado:

```typescript
// Mapeamento canônico da grandeza calculada pela calculadora:
const UNIDADE_CALCULO_POR_ORIGEM: Record<MaterialOrigem, string> = {
  perfil_moldura: "m_linear",
  passe_partout: "m2",
  protecao_frontal: "m2",
  fundo: "m2",
  impressao: "m2",
  chassi: "m_linear",
  servico: "un",
};

function materialDePreco(
  produto: Produto,
  origem: MaterialOrigem,
  quantidadeUnitaria: number,
  quadros: number,
  unidadeOverride?: string,
): MaterialCalculado {
  const qty = round(quantidadeUnitaria * quadros);
  return {
    produto_id: produto.id,
    codigo: produto.codigo,
    descricao: produto.nome,
    origem,
    unidade: unidadeOverride ?? UNIDADE_CALCULO_POR_ORIGEM[origem] ?? produto.unidade,
    quantidade: qty,
    preco_venda: Number(produto.preco_venda),
    valor_total: round(qty * Number(produto.preco_venda), 2),
  };
}
```

E no bloco do chassi acima do limite, manter a unidade `"m2"` já atribuída.

#### 2. Compatibilização na importação (opcional / preventivo):
Em `src/lib/importacao/parsers.ts`, manter `"barra"` e `"folha"` como unidades físicas de estoque se desejado para controle de compras, ou alinhar o cadastro com as unidades de venda. Como a engine de cálculo passará a assegurar a grandeza física do consumo, o cálculo estará imune a divergências no cadastro.

---

## 10. Testes e Evidências

### Cenário de Teste A — Moldura
* **Parâmetros:** Arte $40 \times 60\text{ cm}$, sem passe-partout. Abertura = $40 \times 60\text{ cm}$.
* **Cálculo:** Perímetro comercial = $(40 + 60) \times 2 / 100 = 2{,}00\text{ m}$.
* **Quantidade para 1 quadro:** $2{,}00$.
* **Comportamento atual:** Exibe `2 m barra` (ou `2 barra`).
* **Comportamento esperado:** Exibir `2 m_linear`.
* **Consistência de valor:** Se o perfil custa R$ 45,00/m, valor total = R$ 90,00.

### Cenário de Teste B — Passe-partout
* **Parâmetros:** Arte $30 \times 40\text{ cm}$, passe-partout de $5\text{ cm}$.
* **Cálculo:** Abertura = $(30 + 10) \times (40 + 10) = 40 \times 50\text{ cm} = 2000\text{ cm}^2 = 0{,}20\text{ m}^2$.
* **Quantidade para 1 quadro:** $0{,}20$.
* **Comportamento atual:** Exibe `0.2 folha`.
* **Comportamento esperado:** Exibir `0.2 m2`.
* **Consistência de valor:** Se o passe-partout custa R$ 80,00/m², valor total = R$ 16,00.

### Cenário de Teste C — Chassi (Abaixo, Acima e Limite Exato de 4 m²)
* **C1 (Abaixo do limite):** Arte $100 \times 100\text{ cm}$ ($1{,}0\text{ m}^2 \le 4\text{ m}^2$).
  * Cobrança por perímetro: $(100 + 100) \times 2 / 100 = 4{,}00\text{ m}$.
  * Unidade: `m_linear`. Valor: $4 \times \text{R\$} 30{,}00 = \text{R\$} 120{,}00$.
* **C2 (Acima do limite):** Arte $200 \times 250\text{ cm}$ ($5{,}0\text{ m}^2 > 4\text{ m}^2$).
  * Cobrança por área: $5{,}00\text{ m}^2$.
  * Unidade: `m2`. Valor: $5 \times \text{R\$} 100{,}00 = \text{R\$} 500{,}00$.
* **C3 (Limite Exato — Validação Complementar):** Arte $200 \times 200\text{ cm}$ ($4{,}0\text{ m}^2 = 4\text{ m}^2$).
  * Área calculada: exatamente $4{,}00\text{ m}^2$.
  * Condição aplicada: $\text{areaArteM2} \le \text{limite}$ ($4 \le 4$ avalia como verdadeira), ativando cobrança por perímetro.
  * Quantidade emitida: $8{,}00$ (perímetro $(200 + 200) \times 2 / 100 = 8\text{ m}$).
  * Unidade emitida: `m_linear`.
  * Valor total: $8 \times \text{R\$} 30{,}00 = \text{R\$} 240{,}00$.
  * Cobrança adicional: zero (apenas 1 linha de material gerada; nenhuma cobrança disparada pela regra de preço por m² acima do limite).

### Cenário de Teste D — Demais Materiais com Validação Financeira
* **Parâmetros:** 2 quadros de $50 \times 50\text{ cm}$ ($0{,}25\text{ m}^2$/quadro = $0{,}50\text{ m}^2$ total).
* **Vidro:** $0{,}50\text{ m}^2 \times \text{R\$} 60{,}00 = \text{R\$} 30{,}00$ (unidade `m2`).
* **Fundo:** $0{,}50\text{ m}^2 \times \text{R\$} 40{,}00 = \text{R\$} 20{,}00$ (unidade `m2`).
* **Impressão:** $0{,}50\text{ m}^2 \times \text{R\$} 120{,}00 = \text{R\$} 60{,}00$ (unidade `m2`).
* **Serviço:** $2\text{ un} \times \text{R\$} 25{,}00 = \text{R\$} 50{,}00$ (unidade `un`).
* **Total Geral:** $\text{R\$} 160{,}00$ (unitário $\text{R\$} 80{,}00$).
* **Resultado:** Unidades e valores financeiros 100% validados.

### Cenário de Teste E — Serialização dos Metadados do Rascunho (em memória)
* **Objetivo:** Validar que a estrutura de rascunho produzida por `buildDraftItem()` serializa a unidade corrigida (`m_linear`) em `metadados.calculo.materiais`.
* **Escopo:** Validação estrita de estrutura de dados em memória gerada pelo helper de serviço (sem requisições de rede ao Supabase).
* **Tipagem:** Verificado sem uso de `any`, com inferência e interfaces estritas.

### Limitações da Auditoria e Validação
* O repositório não dispõe de test runner nativo (`npm test`), sendo os testes executados com `npx tsx` contra os módulos de produção.
* A persistência em banco real de instâncias em nuvem não foi acionada (o escopo deste teste valida o payload serializado gerado para inserção).

---

## 11. Conclusão e Status

| Divergência | Causa Raiz | Classificação da Correção | Status |
| :--- | :--- | :--- | :--- |
| **Moldura exibindo `barra`** | Propagação de `produto.unidade` herdado do parser de importação | **Correção de propagação de unidades no motor de cálculo** | Concluído e Validado ✅ |
| **Passe-partout exibindo `folha`** | Propagação de `produto.unidade` herdado do parser de importação | **Correção de propagação de unidades no motor de cálculo** | Concluído e Validado ✅ |

> **Status:** Correção implementada em `src/lib/calculadora/calculator.ts`. Suíte de testes automatizada executada com 100% de sucesso, zero `any`, conferência financeira integral e compilação do build aprovada.
