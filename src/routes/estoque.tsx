import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/estoque")({
  head: () => ({ meta: [{ title: "Estoque — Molduraria ERP" }] }),
  component: EstoqueLayout,
});

const TABS = [
  { to: "/estoque", label: "Dashboard", exact: true },
  { to: "/estoque/retalhos", label: "Retalhos", exact: false },
  { to: "/estoque/movimentacoes", label: "Movimentações", exact: false },
  { to: "/estoque/ordens", label: "Ordens de Produção", exact: false },
];

function EstoqueLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <AppShell title="Estoque Inteligente">
      <nav className="-mt-2 mb-4 flex gap-1 border-b border-border">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <div className="space-y-4">
        <Outlet />
      </div>
    </AppShell>
  );
}
