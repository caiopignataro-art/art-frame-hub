import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { SimuladorBobinas } from "@/components/engenharia/sections";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/configuracoes/engenharia/bobinas")({
  head: () => ({ meta: [{ title: "Simulador de Bobinas — Molduraria ERP" }] }),
  component: () => (
    <AppShell title="Simulador de Bobinas">
      <Link
        to="/configuracoes/engenharia"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Voltar para Engenharia
      </Link>
      <PageHeader
        title="Simulador de Bobinas"
        description="Rotação e otimização linear em rolos de impressão."
      />
      <div className="mt-6">
        <SimuladorBobinas />
      </div>
    </AppShell>
  ),
});
