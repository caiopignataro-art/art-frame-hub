import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Users,
  ShoppingBag,
  Hammer,
  CreditCard,
  Package,
  History,
  LayoutDashboard,
  Frame,
  Boxes,
  Settings,
  Menu,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const NAV = [
  { to: "/",              label: "Calculadora", icon: LayoutDashboard },
  { to: "/dashboard",     label: "Dashboard",   icon: LayoutDashboard },
  { to: "/clientes",      label: "Clientes",    icon: Users },
  { to: "/pedidos",       label: "Pedidos",     icon: ShoppingBag },
  { to: "/producao",      label: "Produção",    icon: Hammer },
  { to: "/estoque",       label: "Estoque",     icon: Boxes },
  { to: "/pagamentos",    label: "Pagamentos",  icon: CreditCard },
  { to: "/produtos",      label: "Produtos",    icon: Package },
  { to: "/historico",     label: "Histórico",   icon: History },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
  { to: "/configuracoes/engenharia", label: "Engenharia", icon: Terminal },
] as const;

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 space-y-1 p-3">
      {NAV.map((item) => {
        const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
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
  );
}

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar fixa (desktop ≥ lg) */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <Frame className="h-6 w-6 text-sidebar-primary" />
          <span className="text-base font-semibold tracking-tight">Molduraria ERP</span>
        </div>
        <NavList pathname={pathname} />
        <div className="border-t border-sidebar-border p-4 text-xs text-sidebar-foreground/60">
          v0.2 · ambiente de desenvolvimento
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          {/* Botão hambúrguer (tablet + celular) */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label="Abrir menu de navegação"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
              <SheetHeader className="border-b border-sidebar-border px-6 py-4">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Frame className="h-5 w-5 text-sidebar-primary" />
                  Molduraria ERP
                </SheetTitle>
              </SheetHeader>
              <NavList pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          <h1 className="truncate text-lg font-semibold tracking-tight">{title ?? "Molduraria ERP"}</h1>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
