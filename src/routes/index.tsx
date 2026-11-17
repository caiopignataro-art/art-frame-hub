import { createFileRoute, Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Calculadora } from "@/components/calculadora/Calculadora";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Calculadora de Orçamento — Art Frame Hub" },
      { name: "description", content: "Calculadora técnica e comercial de molduraria." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <AppShell title="Calculadora">
      <PageHeader
        title="Calculadora de Orçamento"
        description="Configure dimensões, perfis de moldura, passe-partout, vidros e serviços com cálculo técnico e comercial em tempo real."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/pedidos">
              <ShoppingBag className="h-3.5 w-3.5" />
              Ver pedidos
            </Link>
          </Button>
        }
      />
      <Calculadora />
    </AppShell>
  );
}
