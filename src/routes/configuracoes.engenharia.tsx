import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/configuracoes/engenharia")({
  head: () => ({ meta: [{ title: "Engenharia e Testes — Molduraria ERP" }] }),
  component: EngenhariaLayout,
  notFoundComponent: () => (
    <AppShell title="Engenharia e Testes">
      <div className="p-8 text-center border border-dashed border-border rounded-lg bg-card">
        <h3 className="text-lg font-bold">Página não encontrada</h3>
        <p className="text-sm text-muted-foreground mt-1">
          A ferramenta solicitada não existe. Volte ao índice de Engenharia.
        </p>
      </div>
    </AppShell>
  ),
});

function EngenhariaLayout() {
  return <Outlet />;
}
