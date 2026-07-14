import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { LogAlgoritmos } from "@/components/engenharia/sections";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/configuracoes/engenharia/logs")({
  head: () => ({ meta: [{ title: "Log dos Algoritmos — Molduraria ERP" }] }),
  component: () => (
    <AppShell title="Log dos Algoritmos">
      <Link
        to="/configuracoes/engenharia"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-3"
      >
        <ChevronLeft className="h-3.5 w-3.5" /> Voltar para Engenharia
      </Link>
      <PageHeader
        title="Log dos Algoritmos"
        description="Auditoria de decisões e alocações de corte."
      />
      <div className="mt-6">
        <LogAlgoritmos />
      </div>
    </AppShell>
  ),
});
