import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Boxes, ClipboardList, History, Scissors } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModuleTabs, type ModuleTabItem } from "@/components/erp/ModuleTabs";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [{ title: "Estoque — Art Frame Hub" }] }),
  component: EstoqueLayout,
});

const TABS: readonly ModuleTabItem[] = [
  { to: "/estoque", label: "Dashboard de Perfis", exact: true, icon: Boxes },
  { to: "/estoque/retalhos", label: "Retalhos", exact: false, icon: Scissors },
  { to: "/estoque/movimentacoes", label: "Movimentações", exact: false, icon: History },
  { to: "/estoque/ordens", label: "Consumo por OP", exact: false, icon: ClipboardList },
] as const;

function EstoqueLayout() {
  return (
    <AppShell title="Estoque">
      <ModuleTabs tabs={TABS} />
      <div className="space-y-5">
        <Outlet />
      </div>
    </AppShell>
  );
}
