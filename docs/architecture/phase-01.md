# Fase 01: Preparação da Arquitetura (Desacoplamento)

O objetivo desta etapa inicial é puramente estrutural, criando um ponto de abstração (Facade) para as regras de negócio sem alterar o comportamento do sistema.

## Fluxo Antigo

Antes, a interface da `Calculadora` conhecia diretamente o módulo interno de cálculos:

```text
Calculadora
    ↓
calculator.ts
```

## Fluxo Novo

Agora, introduzimos a `ProductionPipeline` como o único ponto de entrada para processamento de produção:

```text
Calculadora
    ↓
ProductionPipeline
    ↓
calculator.ts
```

## Motivação

O `ProductionPipeline` existe, neste momento, **apenas** para desacoplar a interface da implementação concreta dos cálculos (`calculator.ts`).
Nenhuma regra de negócio, tipo, parâmetro ou componente visual foi modificado.

Esta camada atuará, nas próximas fases, como o orquestrador que chamará a `Manufacturing Engine` e a `Stock Engine`, permitindo a evolução da arquitetura sem quebrar a Calculadora.
