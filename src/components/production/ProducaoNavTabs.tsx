import { ClipboardList, Kanban } from "lucide-react";
import { ModuleTabs, type ModuleTabItem } from "@/components/erp/ModuleTabs";

const TABS: readonly ModuleTabItem[] = [
  { to: "/producao", label: "Fluxo de Produção", exact: true, icon: Kanban },
  { to: "/producao/ordens", label: "Ordens de Produção (Lotes)", exact: false, icon: ClipboardList },
] as const;

export function ProducaoNavTabs() {
  return <ModuleTabs tabs={TABS} />;
}
