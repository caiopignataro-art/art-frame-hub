import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { ConfiguracaoAlgoritmos } from "@/components/engenharia/sections";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/configuracoes/engenharia/algoritmos")({
  head: () => ({ meta: [{ title: "Configuração de Algoritmos — Molduraria ERP" }] }),
  component: () => (
    <AppShell title="Configuração de Algoritmos">
      <Link
        to="/configuracoes/engenharia"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Voltar para Engenharia
      </Link>
      <PageHeader
        title="Configuração de Algoritmos"
        description="Mapeamento de algoritmos por tipo de estoque."
      />
      <div className="mt-6">
        <ConfiguracaoAlgoritmos />
      </div>
    </AppShell>
  ),
});
