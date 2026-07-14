import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { SimuladorBarras } from "@/components/engenharia/sections";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/configuracoes/engenharia/barras")({
  head: () => ({ meta: [{ title: "Simulador de Barras — Molduraria ERP" }] }),
  component: () => (
    <AppShell title="Simulador de Barras">
      <Link
        to="/configuracoes/engenharia"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Voltar para Engenharia
      </Link>
      <PageHeader
        title="Simulador de Barras"
        description="Otimização de cortes lineares em perfis de 270 cm."
      />
      <div className="mt-6">
        <SimuladorBarras />
      </div>
    </AppShell>
  ),
});
