import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Calculadora } from "@/components/calculadora/Calculadora";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Calculadora — Molduraria ERP" },
      { name: "description", content: "Calculadora de orçamento de molduraria." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <AppShell title="Calculadora">
      <PageHeader
        title="Calculadora de Orçamento"
        description="Monte um quadro personalizado, veja custo, venda e lucro em tempo real e adicione a um novo pedido."
      />
      <Calculadora />
    </AppShell>
  );
}
