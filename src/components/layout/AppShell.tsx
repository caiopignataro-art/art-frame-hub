import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Users,
  FileText,
  ShoppingBag,
  Hammer,
  CreditCard,
  Package,
  History,
  LayoutDashboard,
  Frame,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/",           label: "Calculadora", icon: LayoutDashboard },
  { to: "/dashboard",  label: "Dashboard",   icon: LayoutDashboard },
  { to: "/clientes",   label: "Clientes",    icon: Users },
  { to: "/orcamentos", label: "Orçamentos",  icon: FileText },
  { to: "/pedidos",    label: "Pedidos",     icon: ShoppingBag },
  { to: "/producao",   label: "Produção",    icon: Hammer },
  { to: "/pagamentos", label: "Pagamentos",  icon: CreditCard },
  { to: "/produtos",   label: "Produtos",    icon: Package },
  { to: "/historico",  label: "Histórico",   icon: History },
] as const;

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex min-h-screen bg-muted/30">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <Frame className="h-6 w-6 text-sidebar-primary" />
          <span className="text-base font-semibold tracking-tight">Molduraria ERP</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/60">
          v0.1 · ambiente de desenvolvimento
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
          <h1 className="text-lg font-semibold tracking-tight">{title ?? "Molduraria ERP"}</h1>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
