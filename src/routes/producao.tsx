import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { ProducaoNavTabs } from "@/components/production/ProducaoNavTabs";

export const Route = createFileRoute("/producao")({
  head: () => ({ meta: [{ title: "Produção — Art Frame Hub" }] }),
  component: ProducaoLayout,
});

function ProducaoLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isDetailFocus = /^\/producao\/ordens\/[^/]+/.test(pathname);

  return (
    <AppShell title="Produção" layoutMode={isDetailFocus ? "focus" : "default"}>
      {!isDetailFocus && <ProducaoNavTabs />}
      <Outlet />
    </AppShell>
  );
}
