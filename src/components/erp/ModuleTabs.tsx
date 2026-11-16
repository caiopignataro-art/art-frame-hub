import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModuleTabItem {
  to: string;
  label: string;
  exact?: boolean;
  icon?: LucideIcon;
  badge?: string | number;
}

export function ModuleTabs({
  tabs,
  className,
}: {
  tabs: readonly ModuleTabItem[];
  className?: string;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <nav
      aria-label="Navegação do módulo"
      className={cn(
        "mb-5 flex items-center gap-1 overflow-x-auto border-b border-border/80",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.exact
          ? pathname === t.to || pathname === `${t.to}/`
          : pathname === t.to || pathname.startsWith(`${t.to}/`) || pathname.startsWith(t.to);
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "relative inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap transition-colors sm:text-sm",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
            <span>{t.label}</span>
            {t.badge !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
