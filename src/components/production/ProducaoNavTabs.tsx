import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const TABS = [
  { to: "/producao", label: "Fluxo de Produção", exact: true },
  { to: "/producao/ordens", label: "Ordens de Produção", exact: false },
] as const;

export function ProducaoNavTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
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
  );
}
