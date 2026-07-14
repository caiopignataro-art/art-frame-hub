import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { TestesAutomatizados } from "@/components/engenharia/sections";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/configuracoes/engenharia/testes")({
  head: () => ({ meta: [{ title: "Testes Automatizados — Molduraria ERP" }] }),
  component: () => (
    <AppShell title="Testes Automatizados">
      <Link
        to="/configuracoes/engenharia"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Voltar para Engenharia
      </Link>
      <PageHeader
        title="Testes Automatizados"
        description="Cenários críticos validados nos motores de cálculo."
      />
      <div className="mt-6">
        <TestesAutomatizados />
      </div>
    </AppShell>
  ),
});
