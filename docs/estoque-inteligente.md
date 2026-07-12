# Documentação Técnica — Arquitetura do Estoque Inteligente

Esta documentação descreve a infraestrutura criada para suportar o novo módulo de **Estoque Inteligente** no sistema de Molduraria.

---

## 1. Visão Geral

O objetivo principal do módulo **Estoque Inteligente** é permitir que diferentes formas de armazenamento de insumos e produtos (como perfis de moldura em barras, vidros em chapas, fitas/papéis em bobinas, etc.) sejam geridas e consumidas de maneira otimizada.

Nesta primeira fase de infraestrutura, criamos:
1. **Modelagem de Dados:** Suporte para diferenciar produtos por sua *Forma de Estoque* e uma estrutura relacional para auditoria/registro de consumo.
2. **Stock Engine:** Uma camada de domínio preparada para centralizar a inteligência e os algoritmos de consumo de estoque futuros.
3. **Formulário de Cadastro:** Interface de usuário ajustada para capturar e persistir a forma de estoque obrigatória para cada produto.

---

## 2. Modelagem do Banco de Dados

### 2.1 Tipo Enum: `forma_estoque`
Define os tipos de armazenamento suportados pelo sistema:
- `barras`: Produtos medidos e cortados de barras de comprimento fixo (ex: perfis de madeira ou alumínio).
- `chapas`: Insumos planos com duas dimensões (largura e altura) cortados sob demanda (ex: vidro, fundo MDF, passe-partout).
- `bobinas`: Insumos de comprimento contínuo e largura fixa (ex: papel fotográfico, fitas).
- `metro_linear`: Consumo linear direto sem lógica complexa de barras.
- `area`: Consumo baseado em metros quadrados (m²).
- `unidade`: Consumo de itens discretos (ex: penduradores, cantoneiras, embalagens).

### 2.2 Tabela `public.produtos` (Nova Coluna)
- **Nome:** `forma_estoque`
- **Tipo:** `public.forma_estoque`
- **Restrição:** `NOT NULL DEFAULT 'unidade'`
- **Propósito:** Classificar como o produto se comporta no inventário físico.

### 2.3 Tabela `public.consumo_estoque` (Nova Tabela)
Registra todo consumo detalhado de um produto para auditoria, relatórios e rastreabilidade:
- `id`: Chave primária UUID.
- `produto_id`: Chave estrangeira que referencia a tabela `produtos`.
- `codigo`: Cópia do código do produto no momento do registro.
- `forma_estoque`: A forma de estoque interpretada.
- `unidade`: Unidade de medida utilizada (ex: `m2`, `ml`, `un`).
- `quantidade`: Quantidade consumida (valores decimais suportados).
- `largura`, `altura`, `comprimento`, `area`: Parâmetros dimensionais opcionais para auditoria detalhada do corte.
- `observacoes`: Detalhes sobre o motivo ou ordem de produção que originou o consumo.
- `created_at`: Registro temporal do evento.

---

## 3. Stock Engine (Camada de Domínio)

O **Stock Engine** reside em `src/lib/stock-engine` e atua como uma barreira que isola a lógica de cálculo do restante da aplicação.

### Estrutura de Arquivos
- **`types.ts`**: Contém as interfaces TypeScript `StockConsumptionInput` e `StockConsumptionResult`.
- **`engine.ts`**: Contém a classe principal `StockEngine` com stubs estruturais que roteiam o cálculo com base na forma de estoque do insumo:

```typescript
export class StockEngine {
  public static interpretConsumption(input: StockConsumptionInput): StockConsumptionResult {
    // Roteia para o cálculo apropriado
  }
}
```

---

## 4. Pontos de Extensão Futuros

1. **Integração no Fluxo de Pedido:**
   Quando uma Ordem de Produção (OP) for concluída ou um pedido for faturado, a aplicação chamará `StockEngine.interpretConsumption` com as dimensões do quadro.
2. **Escrita do Histórico de Consumo:**
   O resultado bem-sucedido do motor de estoque deverá persistir um registro na tabela `consumo_estoque` e abater a quantidade calculada da coluna `estoque` na tabela `produtos`.
