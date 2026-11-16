import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
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
  LogOut,
  LogIn,
  Shield,
} from "lucide-react";
import { toast } from "sonner";
import { RouteAccessGuard, useAuth } from "@/components/auth/AuthContextProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Calculadora", icon: LayoutDashboard },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clientes", label: "Clientes", icon: Users },
  { to: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { to: "/producao", label: "Produção", icon: Hammer },
  { to: "/estoque", label: "Estoque", icon: Boxes },
  { to: "/pagamentos", label: "Pagamentos", icon: CreditCard },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { canPath, auth } = useAuth();

  const visibleItems = NAV.filter((item) => {
    if (!auth.isAuthenticated) return true;
    return canPath(item.to);
  });

  return (
    <nav className="flex-1 space-y-1 p-3">
      {visibleItems.map((item) => {
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

function SidebarUserFooter() {
  const { auth, user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    toast.success("Sessão encerrada com sucesso.");
    await navigate({ to: "/login", search: { redirect: undefined, expired: undefined } });
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="border-t border-sidebar-border p-4 space-y-2">
        <div className="text-xs text-sidebar-foreground/60">Sessão não iniciada</div>
        <Button asChild size="sm" variant="secondary" className="w-full justify-start">
          <Link to="/login" search={{ redirect: undefined, expired: undefined }}>
            <LogIn className="mr-2 h-3.5 w-3.5" /> Entrar no sistema
          </Link>
        </Button>
      </div>
    );
  }

  const displayRoles = user?.roles?.map((r) => r.name) ?? auth.roles;

  return (
    <div className="border-t border-sidebar-border p-4 space-y-2.5">
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-sidebar-foreground truncate">
          <Shield className="h-3.5 w-3.5 shrink-0 text-sidebar-primary" />
          <span className="truncate">{auth.name || auth.email}</span>
        </div>
        {auth.name && (
          <div className="text-[11px] text-sidebar-foreground/60 truncate">{auth.email}</div>
        )}
      </div>

      {displayRoles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {displayRoles.slice(0, 3).map((roleName) => (
            <Badge
              key={roleName}
              variant="secondary"
              className="text-[10px] px-1.5 py-0 font-normal"
            >
              {roleName}
            </Badge>
          ))}
        </div>
      )}

      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => void handleLogout()}
        className="w-full justify-start h-8 px-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground"
      >
        <LogOut className="mr-2 h-3.5 w-3.5" />
        Encerrar sessão
      </Button>
    </div>
  );
}

export function AppShell({
  children,
  title,
  layoutMode = "default",
}: {
  children: ReactNode;
  title?: string;
  layoutMode?: "default" | "focus";
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isFocus = layoutMode === "focus";

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar fixa (desktop ≥ lg) */}
      {!isFocus && (
        <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
          <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
            <Frame className="h-6 w-6 text-sidebar-primary" />
            <span className="text-base font-semibold tracking-tight">Molduraria ERP</span>
          </div>
          <NavList pathname={pathname} />
          <SidebarUserFooter />
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-background px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {/* Botão hambúrguer (tablet + celular) */}
            {!isFocus && (
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
                <SheetContent
                  side="left"
                  className="w-72 bg-sidebar p-0 text-sidebar-foreground flex flex-col"
                >
                  <SheetHeader className="border-b border-sidebar-border px-6 py-4">
                    <SheetTitle className="flex items-center gap-2 text-base">
                      <Frame className="h-5 w-5 text-sidebar-primary" />
                      Molduraria ERP
                    </SheetTitle>
                  </SheetHeader>
                  <NavList pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
                  <SidebarUserFooter />
                </SheetContent>
              </Sheet>
            )}
            <h1 className="truncate text-lg font-semibold tracking-tight">
              {title ?? "Molduraria ERP"}
            </h1>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <RouteAccessGuard>{children}</RouteAccessGuard>
        </main>
      </div>
    </div>
  );
}
