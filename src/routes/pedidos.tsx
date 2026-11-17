import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos — Art Frame Hub" }] }),
  component: PedidosLayout,
});

function PedidosLayout() {
  return (
    <AppShell title="Pedidos">
      <Outlet />
    </AppShell>
  );
}
