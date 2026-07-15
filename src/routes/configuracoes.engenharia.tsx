import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/configuracoes/engenharia")({
  head: () => ({
    meta: [{ title: "Engenharia e Testes — Molduraria ERP" }],
  }),
  component: EngenhariaLayout,
});

function EngenhariaLayout() {
  return <Outlet />;
}