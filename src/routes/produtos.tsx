import { createFileRoute, Outlet } from "@tanstack/react-router";
import { FileSpreadsheet, Layers, Package } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ModuleTabs, type ModuleTabItem } from "@/components/erp/ModuleTabs";

export const Route = createFileRoute("/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Art Frame Hub" }] }),
  component: ProdutosLayout,
});

const TABS: readonly ModuleTabItem[] = [
  { to: "/produtos", label: "Catálogo", exact: true, icon: Package },
  { to: "/produtos/essenciais", label: "Essenciais", exact: false, icon: Layers },
  { to: "/produtos/importacao", label: "Importação XLSX", exact: false, icon: FileSpreadsheet },
] as const;

function ProdutosLayout() {
  return (
    <AppShell title="Produtos">
      <ModuleTabs tabs={TABS} />
      <div className="space-y-5">
        <Outlet />
      </div>
    </AppShell>
  );
}
