# Auditoria Técnica — Preservação de Serviços na Edição de Pedidos

**Identificador:** A-007  
**Data:** 11/10/2026  
**Finalidade:** Diagnóstico técnico aprofundado dos três pontos críticos identificados no ciclo de vida de Serviços durante a edição de pedidos:
1. Unidade padrão no cadastro de serviços.
2. Restauração de serviços desativados no catálogo durante a edição de itens.
3. Preservação de preços históricos versus aplicação dos preços vigentes do catálogo.

> [!IMPORTANT]
> **Documento de Auditoria Exclusiva:** Nenhuma alteração em código-fonte, banco de dados, migrations ou RPCs foi realizada nesta etapa.

---

## 1. Resumo Executivo

| Item | Diagnóstico Técnico | Causa Raiz | Impacto | Classificação |
| :--- | :--- | :--- | :--- | :---: |
| **1. Unidade Padrão** | Novos serviços são inicializados com unidade `m2` em vez de `un`. | Fallback ternário em [`ProdutoEditDialog.tsx`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/components/produtos/ProdutoEditDialog.tsx#L122) trata `servico` como categoria genérica. | Risco de erro operacional ao cadastrar serviços cobrados por peça/quadro. | **Ajuste Técnico Independente** |
| **2. Restauração de Inativos** | Serviços inativados no catálogo desaparecem do item ao abrir a Calculadora para edição. | [`servicosQ`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/components/calculadora/Calculadora.tsx#L103-L106) filtra `ativo: true`. O `.find()` retorna `undefined` e o `.filter(Boolean)` elimina o serviço. | Perda silenciosa de serviços históricos e alteração indevida do escopo do pedido. | **Ajuste Técnico Independente** |
| **3. Preços Históricos** | Ao editar um item, a Calculadora descarta o snapshot financeiro anterior e recalcula todos os materiais pelos preços atuais do catálogo. | A Calculadora consome apenas `metadados.entrada` e recria o estado a partir das entidades `Produto` atuais do banco. | O valor do pedido pode aumentar ou diminuir sem consentimento explícito do cliente/vendedor. | **Decisão de Negócio Requerida** |

---

## 2. Ponto 1: Unidade Padrão no Cadastro de Serviços

### 2.1. Onde `unidade_venda` recebe seu valor padrão
No arquivo [`src/components/produtos/ProdutoEditDialog.tsx`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/components/produtos/ProdutoEditDialog.tsx):
* No objeto estático `empty` (linhas 67–69):
  ```typescript
  unidade: "un",
  unidade_venda: "m2",
  unidade_estoque: "m2",
  ```
* No hook `useEffect` acionado em modo criação (`produto === null`, linhas 118–127):
  ```typescript
  // Defaults sensatos por categoria em modo criação
  const t = criandoTipo ?? "outro";
  setForm({
    ...empty,
    unidade_venda: t === "chassi" ? "metro_linear" : "m2",
    unidade_estoque:
      t === "chassi" ? "metro_linear" : t === "protecao_frontal" || t === "fundo" ? "chapas" : "m2",
    unidade: t === "chassi" ? "metro_linear" : "m2",
  });
  ```

### 2.2. Como o tipo `servico` é tratado na inicialização
* A rota [`produtos.essenciais.tsx`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/routes/produtos.essenciais.tsx#L209) repassa `criandoTipo={tab}`. Na sub-aba "Serviços", `tab` vale `"servico"`.
* Em `ProdutoEditDialog.tsx`, a variável `t` assume o valor `"servico"`.
* Como a condicional `t === "chassi"` é falsa, a avaliação cai no fallback `else`, atribuindo `"m2"` para `unidade_venda`, `unidade_estoque` e `unidade`.

### 2.3. Viabilidade de isolamento exclusivo para serviços
A constante `UNIDADES_VENDA` (linha 83) já possui `"un"` registrado:
```typescript
const UNIDADES_VENDA = ["m2", "metro_linear", "un"];
const UNIDADES_ESTOQUE = ["m2", "metro_linear", "chapas", "caixas", "un"];
```
Portanto, definir `un` para o tipo `"servico"` não requer nenhuma alteração de schema ou opções de UI.

### 2.4. Ajuste Mínimo Recomendado e Efeitos Colaterais
* **Ajuste:** Na inicialização de `setForm` em `ProdutoEditDialog.tsx`:
  ```typescript
  unidade_venda: t === "servico" ? "un" : t === "chassi" ? "metro_linear" : "m2",
  unidade_estoque: t === "servico" ? "un" : t === "chassi" ? "metro_linear" : t === "protecao_frontal" || t === "fundo" ? "chapas" : "m2",
  unidade: t === "servico" ? "un" : t === "chassi" ? "metro_linear" : "m2",
  ```
* **Efeitos Colaterais:**
  * **Nenhum** em outros tipos de produtos (`chassi`, `protecao_frontal`, `fundo`, `perfil_moldura`).
  * **Nenhum** em produtos existentes sendo editados (`produto !== null`), pois o formulário continua carregando estritamente os valores gravados no banco (`produto.unidade_venda`, etc.).

---

## 3. Ponto 2: Restauração de Serviços Inativos na Edição

### 3.1. Fluxo Atual de Edição
```
1. Usuário clica em "Editar item" na tabela de pedidos
   ↓
2. pedidos.novo.tsx abre Dialog passando initialItem (PedidoItemDraft)
   ↓
3. Calculadora.tsx lê initialItem.metadados.entrada.servicos (array de UUIDs)
   ↓
4. servicosQ busca no banco apenas produtos com { tipo: 'servico', ativo: true }
   ↓
5. .find((p) => p.id === id) retorna undefined para o serviço inativo
   ↓
6. .filter(Boolean) descarta o serviço do estado React
   ↓
7. Usuário clica em "Salvar alterações"
   ↓
8. calculadoraService.buildDraftItem regrava metadados sem o serviço inativo (PERDA DEFINITIVA)
```

### 3.2. Evidências no Código-Fonte

1. **Definição da query de serviços ativos** ([`Calculadora.tsx:103-106`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/components/calculadora/Calculadora.tsx#L103-L106)):
   ```typescript
   const servicosQ = useQuery({
     queryKey: ["produtos", "servico"],
     queryFn: () => produtosService.list({ tipo: "servico", ativo: true }),
   });
   ```
2. **Eliminação silenciosa pelo `filter(Boolean)`** ([`Calculadora.tsx:178-180`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/components/calculadora/Calculadora.tsx#L178-L180)):
   ```typescript
   setServicos(((en.servicos ?? []) as string[])
     .map((id) => (servicosQ.data ?? []).find((p) => p.id === id))
     .filter(Boolean) as Produto[]);
   ```
3. **Persistência do snapshot canônico** ([`calculadora.service.ts:40`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/lib/services/calculadora.service.ts#L40)):
   * `metadados.entrada.servicos` grava apenas IDs: `input.servicos.map((s) => s.id)`.
   * Porém, `metadados.calculo.materiais` grava o objeto completo do serviço:
     ```json
     {
       "produto_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
       "codigo": "0015",
       "descricao": "Montagem Especial Sanduíche",
       "origem": "servico",
       "unidade": "un",
       "quantidade": 1,
       "preco_venda": 50,
       "valor_total": 50
     }
     ```

### 3.3. Comportamento se o serviço foi removido do banco (Hard Delete) ou se o ID não for encontrado
* Se a restauração depender exclusivamente do banco (`produtosService.list` ou `produtosService.get`), qualquer produto excluído fisicamente ou corrompido falhará na restauração.
* Em contrapartida, o snapshot `initialItem.metadados.calculo.materiais` **continua intacto dentro do JSON do item**. Ele preserva o `produto_id`, `codigo`, `descricao`, `unidade` e o preço contratado.

### 3.4. Alternativas de Correção e Trade-offs

#### Alternativa 2.A: Query do Catálogo sem filtro de `ativo` para os IDs do item
* *Mecanismo:* Manter `servicosQ` buscando ativos para a listagem normal, mas adicionar uma query secundária ou condicional (ex.: `produtosService.listByIds(en.servicos)`) que busca os serviços vinculados independentemente de estarem ativos.
* *Prós:* Restaura a entidade `Produto` oficial do banco.
* *Contras:* Não resolve o caso em que o registro foi excluído fisicamente (`hard delete`); introduz chamadas adicionais de rede.

#### Alternativa 2.B (Recomendada): Restauração Híbrida via Catálogo + Fallback do Snapshot Canônico
* *Mecanismo:*
  1. Para cada ID em `en.servicos`, tenta encontrar em `servicosQ.data`.
  2. Se não encontrar (porque está inativo no catálogo ou foi excluído), busca em `initialItem.metadados.calculo.materiais` onde `origem === "servico"` e `produto_id === id`.
  3. Reconstrói um objeto `Produto` sintético com as propriedades gravadas no snapshot (`id`, `nome: m.descricao`, `codigo: m.codigo`, `preco_venda: m.preco_venda`, `ativo: false`).
  4. Na UI da Calculadora: renderiza uma indicação visual `(Inativo)` ao lado do nome do serviço restaurado para que o usuário saiba que ele não pode ser adicionado a novos pedidos, mas permanece preservado neste item a menos que seja desmarcado explicitamente.
* *Prós:*
  * **100% resiliente:** Não perde o serviço mesmo que tenha sido inativado ou deletado.
  * **Zero poluição:** Novos pedidos não visualizam serviços inativos (pois `servicosQ` continua filtrando `ativo: true`).
  * **Zero consultas extras ao banco:** Utiliza os dados que já estão na memória do cliente em `initialItem`.
* *Contras:* Nenhuma contraindicação arquitetural.

---

## 4. Ponto 3: Preservação de Preços Históricos

### 4.1. Respostas Técnicas Baseadas em Evidências

#### 1. O snapshot original é preservado ou utilizado apenas para reconstruir a seleção?
* **Evidência:** Em [`Calculadora.tsx:140-184`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/components/calculadora/Calculadora.tsx#L140-L184), apenas `initialItem.metadados.entrada` (`en`) é lido:
  ```typescript
  const md = initialItem.metadados as any;
  const en = md?.entrada;
  ```
* O bloco `md?.calculo` é **ignorado por completo**.
* O snapshot original **não é preservado** na Calculadora; ele é descartado assim que a tela abre, e a Calculadora dispara um cálculo em tempo real baseado no estado atual:
  ```typescript
  const result = React.useMemo(() => calcular(input), [input]);
  ```

#### 2. O preço atual do catálogo substitui o preço histórico durante a edição?
* **Sim, com certeza.**
* O estado `servicos` armazena instâncias de `Produto` vindas diretamente de `servicosQ.data` (o catálogo atual).
* Em [`calculator.ts:55`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/lib/calculadora/calculator.ts#L55):
  ```typescript
  preco_venda: Number(produto.preco_venda),
  valor_total: round(qty * Number(produto.preco_venda), 2),
  ```
* Se o serviço custava R$ 30,00 quando o pedido foi criado, mas foi reajustado para R$ 50,00 no cadastro, ao abrir o item para edição a calculadora adotará imediatamente R$ 50,00.

#### 3. A regeneração dos metadados recalcula todos os materiais ou apenas os serviços?
* **Recalcula TODOS os materiais indistintamente.**
* Molduras, vidros, fundos, chassis, impressões e passe-partouts são recalculados pela mesma função `calcular(input)` com base nos preços atuais de tabela retornados pelas queries `perfilQ`, `protecaoQ`, `fundoQ`, etc.

#### 4. Qual é o comportamento equivalente para os demais materiais?
* É idêntico ao dos serviços: nenhum material preserva seu preço histórico caso a Calculadora seja aberta para edição do item.

#### 5. Impacto no detector de alterações de fabricação
Em [`pedidos.novo.tsx:316`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/routes/pedidos.novo.tsx#L316):
```typescript
if (JSON.stringify(o.metadados) !== JSON.stringify(a.metadados)) return true;
```
Se um item for aberto na Calculadora e o usuário clicar em "Salvar alterações" mesmo sem alterar nenhuma medida, a diferença nos preços recalculados causará disparidade em `metadados.calculo`, acionando o alerta de alteração de fabricação da OP.

---

### 4.2. Comparativo de Abordagens para Preços Históricos

```
                     ┌─────────────────────────────────────────────────────────┐
                     │          Edição de Item na Calculadora                  │
                     └──────────────────────────┬──────────────────────────────┘
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 ▼                                                             ▼
┌─────────────────────────────────┐                           ┌─────────────────────────────────┐
│     Abordagem A (Atual)         │                           │      Abordagem B (Contratual)   │
│  Recálculo Integral com Preços  │                           │  Preservação dos Preços         │
│          de Catálogo            │                           │     Históricos do Snapshot      │
├─────────────────────────────────┤                           ├─────────────────────────────────┤
│ • Preço do catálogo sempre      │                           │ • Preço acordado no pedido não  │
│   vigente.                      │                           │   muda por edição acidental.    │
│ • Risco de elevar o orçamento   │                           │ • Exige lógica para distinguir  │
│   sem o cliente ter pedido      │                           │   material pré-existente de     │
│   reajuste.                     │                           │   novo material inserido.       │
└─────────────────────────────────┘                           └─────────────────────────────────┘
```

| Critério | Abordagem A: Recálculo Integral (Atual) | Abordagem B: Preservação Histórica | Abordagem C: Híbrida com Ação Explícita |
| :--- | :--- | :--- | :--- |
| **Comportamento** | Recalcula todos os materiais e serviços pelos preços do catálogo atual. | Bloqueia os preços unitários nos valores registrados em `metadados.calculo.materiais`. | Preserva preços históricos por padrão e oferece botão "Atualizar com Preços de Tabela". |
| **Impacto no Cliente** | Risco de conflito comercial caso o valor total suba após uma edição simples. | Garante que o valor acordado com o cliente seja respeitado. | Transparente e sob controle do usuário. |
| **Complexidade de Código** | Baixa (é a arquitetura atual). | Média (exige injetar preços históricos no `CalcInput`). | Média-Alta (requer interface e estado de controle). |
| **Consistência do ERP** | Homogênea para todos os materiais. | Exige regras para quando novas molduras/serviços forem adicionados. | Ideal para ERPs de marcenaria/molduraria comercial. |

---

## 5. Delimitação: Ajustes Independentes vs. Decisão de Negócio

Para garantir clareza e governança no desenvolvimento:

### Grupo 1: Ajustes Técnicos Independentes (Não dependem de definição comercial)
São correções puramente de integridade e usabilidade:
1. **Unidade padrão no cadastro de serviços:** Definir default como `"un"` para `tipo === "servico"` em `ProdutoEditDialog.tsx`.
2. **Preservação de serviços inativos na Calculadora:** Impedir a perda silenciosa de serviços inativados ou removidos ao reabrir a edição do item.

### Grupo 2: Decisão de Negócio Comercial (Requer alinhamento de produto/diretoria)
* **Regra de Preços na Edição:** A empresa deseja que a edição de pedidos já iniciados ou orçados mantenha o preço fechado anteriormente, ou que sempre recalcule os valores com a tabela mais atualizada?
* *Recomendação da Engenharia:* Manter os preços históricos preservados por padrão quando se edita um item existente, adicionando um indicativo visual caso os preços de catálogo tenham sofrido reajuste.

---

## 6. Arquivos Envolvidos para Futura Implementação

Quando aprovada a implementação:

1. [`src/components/produtos/ProdutoEditDialog.tsx`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/components/produtos/ProdutoEditDialog.tsx):
   * Ajuste dos defaults de `unidade_venda`, `unidade_estoque` e `unidade` para `t === "servico"`.
2. [`src/components/calculadora/Calculadora.tsx`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/components/calculadora/Calculadora.tsx):
   * Ajuste do efeito de restauração para suportar serviços inativos vindos de `initialItem.metadados.calculo.materiais`.
   * Renderização de etiqueta `(Inativo)` na lista de checkboxes para serviços históricos desativados.
3. [`src/lib/calculadora/types.ts`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/lib/calculadora/types.ts) e [`src/lib/calculadora/calculator.ts`](file:///c:/Users/amand/Documents/ERB%20ARTENMOLDURAS/art-frame-hub/src/lib/calculadora/calculator.ts):
   * Apenas se a Decisão de Negócio optar pela Preservação de Preços Históricos (Abordagem B ou C).

---

## 7. Critérios de Aceite e Roteiro de Testes

### Critérios Objetivos de Aceite
1. Ao clicar em "Novo produto" dentro da aba "Serviços" em Produtos Essenciais, o campo "Unidade de venda" deve exibir `un` selecionado por padrão.
2. Ao cadastrar um serviço e vinculá-lo a um item de pedido, e em seguida inativar esse serviço no cadastro de produtos (`ativo = false`), a reedição do pedido na Calculadora deve continuar exibindo o serviço marcado no item.
3. Ao salvar o item editado (mesmo com o serviço inativo), o serviço deve permanecer em `metadados.entrada.servicos`, em `metadados.calculo.materiais` e na linha expandida da OP.
4. O serviço inativo **não deve** aparecer como opção selecionável para novos pedidos em branco.

### Roteiro de Testes
* [ ] **Teste 1 (Unidade Padrão):** Abrir Produtos > Serviços > Novo produto. Validar se `unidade_venda = un`.
* [ ] **Teste 2 (Outras Categorias):** Abrir Produtos > Proteção Frontal > Novo produto. Validar se `unidade_venda = m2`.
* [ ] **Teste 3 (Item com múltiplos serviços):** Criar pedido com 2 serviços (ex.: *Montagem* e *Embalagem*). Validar presença em `metadados`.
* [ ] **Teste 4 (Inativação de 1 serviço):** Desativar *Embalagem* em Produtos. Abrir o pedido para edição. Validar que ambos os serviços continuam carregados e marcados.
* [ ] **Teste 5 (Re-gravação sem perda):** Salvar o pedido reeditado. Abrir a OP e confirmar que ambos os serviços constam na linha expandida.
* [ ] **Teste 6 (Novo Pedido):** Criar um novo pedido do zero. Confirmar que *Embalagem* (inativo) não aparece na lista de seleção.
