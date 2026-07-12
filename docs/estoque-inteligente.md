# Documentação Técnica — Arquitetura do Estoque Inteligente

Esta documentação descreve a infraestrutura e o funcionamento do módulo **Estoque Inteligente** no sistema de Molduraria.

---

## 1. Visão Geral

O objetivo principal do módulo **Estoque Inteligente** é permitir que diferentes formas de armazenamento de insumos e produtos (como perfis de moldura em barras, vidros em chapas, fitas/papéis em bobinas, etc.) sejam geridas e consumidas de maneira otimizada.

O fluxo de estoque foi totalmente desacoplado das estruturas rígidas de moldura e agora baseia-se em uma arquitetura de duas etapas:
1. **Manufacturing Engine (Banco/Postgres):** Interpreta o snapshot de cálculo da Calculadora gravado nos itens do pedido e gera registros padronizados na tabela `consumo_estoque`.
2. **Stock Engine (Banco e Frontend):** Consome exclusivamente os dados de `consumo_estoque` para orquestrar reservas, baixas, movimentações e retalhos através de processadores especializados por tipo de armazenamento:
   - **Processador de Barras:** Gerenciamento linear de perfis e sobras.
   - **Processador de Chapas:** Gerenciamento bidimensional (2D) de chapas planas e sobras retangulares.

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

### 2.3 Tabela `public.consumo_estoque` (Estrutura de Interoperabilidade)
Registra todo consumo detalhado de um produto para auditoria, relatórios e rastreabilidade:
- `id`: Chave primária UUID.
- `produto_id`: Chave estrangeira que referencia a tabela `produtos`.
- `codigo`: Cópia do código do produto no momento do registro.
- `forma_estoque`: A forma de estoque interpretada.
- `unidade`: Unidade de medida utilizada (ex: `cm`, `m2`, `un`).
- `quantidade`: Quantidade consumida (número de quadros ou unidades).
- `largura`, `altura`, `comprimento`, `area`: Parâmetros dimensionais opcionais para auditoria detalhada do corte.
- `observacoes`: Detalhes sobre o motivo ou ordem de produção que originou o consumo.
- `pedido_id`: Identificador do pedido relacionado (`ON DELETE CASCADE`).
- `pedido_item_id`: Identificador do item do pedido relacionado (`ON DELETE CASCADE`).
- `created_at`: Registro temporal do evento.

### 2.4 Entidades de Chapas (Físicas)

#### Tabela `public.chapas`
Representa uma chapa inteira física presente no estoque físico do estabelecimento:
- `id`: Chave primária UUID.
- `produto_id`: Chave estrangeira de `produtos` (Vidro, MDF, Passe-partout).
- `largura`: Largura total da chapa (cm).
- `altura`: Altura total da chapa (cm).
- `area`: Área calculada em m² (`largura * altura / 10000.0`).
- `status`: Situação física (`disponivel`, `usada`, `descartada`).
- `localizacao`: Texto com a localização física (ex: Prateleira A).
- `observacoes`: Anotações complementares.

#### Tabela `public.retalhos_chapas`
Representa um retalho de chapa recortado que ainda pode ser aproveitado em trabalhos menores:
- `id`: Chave primária UUID.
- `chapa_origem_id`: Chave estrangeira referenciando a chapa física inteira de origem.
- `largura`: Largura do retalho (cm).
- `altura`: Altura do retalho (cm).
- `area`: Área calculada em m².
- `status`: Situação do retalho (`disponivel`, `usado`, `descartado`).

### 2.5 Entidades de Bobinas (Rolos)

#### Tabela `public.bobinas`
Representa um rolo/bobina físico presente no estoque do estabelecimento:
- `id`: Chave primária UUID.
- `produto_id`: Chave estrangeira de `produtos` (Canvas, Papel Fotográfico, Vinil).
- `largura`: Largura da bobina (cm).
- `comprimento_original`: Metragem total original da bobina (cm).
- `comprimento_restante`: Metragem linear restante (cm).
- `area_restante`: Área em m² calculada a partir do comprimento restante.
- `fabricante`, `lote`: Informações de loteamento.
- `status`: Situação do rolo (`ativa`, `esgotada`, `descartada`).

---

## 3. Fluxo de Execução e Componentes

### 3.1 Manufacturing Engine
A função `public.gerar_consumo_estoque_pedido(_pedido_id)` limpa registros antigos e varre os itens ativos do pedido. Ela analisa os metadados da calculadora de molduras, passe-partouts, vidros (proteções frontais), fundos e impressões, gerando as respectivas linhas em `consumo_estoque` com as dimensões de largura e altura necessárias.

### 3.2 Stock Engine (Orquestrador)
A função `public.processar_reserva_pedido(_pedido_id)` é disparada nas transições de status do pedido. Ela invoca a *Manufacturing Engine* e em seguida delega o consumo para o processador adequado com base no campo `forma_estoque` de cada registro.

### 3.3 Processador de Barras (BarProcessor)
Encapsula as regras de:
- **Reserva:** Tenta reservar retalhos disponíveis maiores ou iguais ao consumo. Se não houver, abate das barras completas de estoque (`produtos.estoque`).
- **Geração de Retalhos:** Sobras de barras com tamanho significativo (> 1cm) são reintroduzidas na tabela `retalhos` como disponíveis.
- **Utilização de Retalhos:** Associa e consome retalhos reservados.
- **Movimentações & Auditoria:** Grava eventos em `estoque_movimentacoes` mapeando a transição do saldo linear físico e virtual.

### 3.4 Processador de Chapas (PlateProcessor)
Encapsula a lógica de corte bidimensional (2D) e preferência de consumo:
- **Reserva e Seleção:**
  1. Varre `retalhos_chapas` disponíveis e seleciona o menor que comporta a peça (suporta rotação de 90°).
  2. Se nenhum retalho comportar o corte, varre `chapas` inteiras e seleciona a menor chapa inteira que comporte.
  3. Atualiza os status correspondentes e insere a reserva no banco de dados.
- **Rastreabilidade na Ordem de Produção:**
  - Registra os IDs da chapa inteira (`fundo_chapa_id`, etc.) e/ou retalho específico (`fundo_retalho_chapa_id`, etc.) que foram separados/reservados diretamente na tabela `ordens_producao`.
- **Geração de Sobra (Guillotine Cut):**
  - Efetua o corte de guilhotina na chapa e insere as sobras retangulares resultantes maiores que 5x5 cm de volta na tabela `retalhos_chapas` como disponíveis para próximos pedidos.

### 3.5 Processador de Bobinas (CoilProcessor)
Encapsula a lógica de consumo linear para materiais em rolo (Canvas, Fine Art, etc.):
- **Reserva e Orientação:**
  1. Seleciona a menor bobina ativa disponível que comporta o corte (largura da bobina deve ser maior ou igual a pelo menos uma das dimensões da peça).
  2. Determina a orientação ideal para diminuir o comprimento linear retirado da bobina:
     - Se a largura comporta a maior dimensão da peça, consome a menor dimensão.
     - Caso contrário, consome a maior dimensão.
  3. Deduz o comprimento consumido do `comprimento_restante` e atualiza a `area_restante`.
- **Rastreabilidade na Ordem de Produção:**
  - Vincula o ID da bobina reservada na coluna `impressao_bobina_id` da tabela `ordens_producao`.
- **Registro de Métricas:**
  - Registra nos logs de movimentação de estoque a área útil consumida e o desperdício gerado pela largura não utilizada da faixa de bobina cortada (`desperdicio = (largura_bobina * comprimento_consumido) - area_util_peca`).
