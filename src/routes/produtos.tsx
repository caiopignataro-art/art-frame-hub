import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/produtos")({
  head: () => ({ meta: [{ title: "Produtos — Molduraria ERP" }] }),
  component: ProdutosLayout,
});

const TABS = [
  { to: "/produtos", label: "Catálogo", exact: true },
  { to: "/produtos/importacao", label: "Importação", exact: false },
] as const;

function ProdutosLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b border-border px-6 pt-4">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition-colors",
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
      <Outlet />
    </div>
  );
}
