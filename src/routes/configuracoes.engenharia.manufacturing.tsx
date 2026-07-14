import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { ManufacturingEngineVisualizer } from "@/components/engenharia/sections";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/configuracoes/engenharia/manufacturing")({
  head: () => ({ meta: [{ title: "Manufacturing Engine — Molduraria ERP" }] }),
  component: () => (
    <AppShell title="Manufacturing Engine">
      <Link
        to="/configuracoes/engenharia"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Voltar para Engenharia
      </Link>
      <PageHeader
        title="Manufacturing Engine"
        description="Cálculos, aberturas e desdobramento de peças por pedido."
      />
      <div className="mt-6">
        <ManufacturingEngineVisualizer />
      </div>
    </AppShell>
  ),
});
