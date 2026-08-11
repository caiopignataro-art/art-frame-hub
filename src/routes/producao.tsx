import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/producao")({
  head: () => ({ meta: [{ title: "Produção — Molduraria ERP" }] }),
  component: () => <Outlet />,
});
