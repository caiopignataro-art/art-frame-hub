import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bell,
  Boxes,
  Calculator,
  ChevronRight,
  CreditCard,
  Frame,
  Hammer,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Package,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { RouteAccessGuard, useAuth } from "@/components/auth/AuthContextProvider";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { produtosService } from "@/lib/services/produtos.service";
import { PRODUTO_TIPO_LABEL } from "@/types/erp";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavSubItem {
  to: string;
  label: string;
  exact?: boolean;
}

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  subItems?: readonly NavSubItem[];
}

interface NavGroup {
  label: string;
  items: readonly NavItem[];
}

const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Visão Geral",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { to: "/", label: "Calculadora", icon: Calculator, exact: true },
    ],
  },
  {
    label: "Comercial",
    items: [
      { to: "/clientes", label: "Clientes", icon: Users },
      {
        to: "/pedidos",
        label: "Pedidos",
        icon: ShoppingBag,
        subItems: [
          { to: "/pedidos", label: "Todos os pedidos", exact: true },
          { to: "/pedidos/novo", label: "Novo pedido", exact: false },
        ],
      },
    ],
  },
  {
    label: "Catálogo",
    items: [
      {
        to: "/produtos",
        label: "Produtos",
        icon: Package,
        subItems: [
          { to: "/produtos", label: "Catálogo", exact: true },
          { to: "/produtos/essenciais", label: "Essenciais", exact: false },
          { to: "/produtos/importacao", label: "Importação", exact: false },
        ],
      },
    ],
  },
  {
    label: "Operação",
    items: [
      {
        to: "/producao",
        label: "Produção",
        icon: Hammer,
        subItems: [
          { to: "/producao", label: "Fluxo de Produção", exact: true },
          { to: "/producao/ordens", label: "Ordens de Produção", exact: false },
        ],
      },
      {
        to: "/estoque",
        label: "Estoque",
        icon: Boxes,
        subItems: [
          { to: "/estoque", label: "Dashboard", exact: true },
          { to: "/estoque/retalhos", label: "Retalhos", exact: false },
          { to: "/estoque/movimentacoes", label: "Movimentações", exact: false },
          { to: "/estoque/ordens", label: "Consumo por OP", exact: false },
        ],
      },
    ],
  },
  {
    label: "Financeiro",
    items: [{ to: "/pagamentos", label: "Pagamentos", icon: CreditCard }],
  },
  {
    label: "Gestão",
    items: [
      { to: "/historico", label: "Histórico", icon: History },
      { to: "/configuracoes", label: "Configurações", icon: Settings },
    ],
  },
] as const;

const ROUTE_LABELS: Record<
  string,
  { group?: string; label: string; parentTo?: string; parentLabel?: string }
> = {
  "/": { group: "Visão Geral", label: "Calculadora de Orçamento" },
  "/dashboard": { group: "Visão Geral", label: "Dashboard" },
  "/clientes": { group: "Comercial", label: "Clientes" },
  "/pedidos": { group: "Comercial", label: "Pedidos" },
  "/pedidos/novo": {
    group: "Comercial",
    parentTo: "/pedidos",
    parentLabel: "Pedidos",
    label: "Pedido",
  },
  "/produtos": {
    group: "Catálogo",
    label: "Produtos",
    parentTo: "/produtos",
    parentLabel: "Produtos",
  },
  "/produtos/essenciais": {
    group: "Catálogo",
    parentTo: "/produtos",
    parentLabel: "Produtos",
    label: "Essenciais",
  },
  "/produtos/importacao": {
    group: "Catálogo",
    parentTo: "/produtos",
    parentLabel: "Produtos",
    label: "Importação",
  },
  "/producao": {
    group: "Operação",
    label: "Fluxo de Produção",
    parentTo: "/producao",
    parentLabel: "Produção",
  },
  "/producao/ordens": {
    group: "Operação",
    parentTo: "/producao",
    parentLabel: "Produção",
    label: "Ordens de Produção",
  },
  "/estoque": {
    group: "Operação",
    label: "Estoque de Molduras",
    parentTo: "/estoque",
    parentLabel: "Estoque",
  },
  "/estoque/retalhos": {
    group: "Operação",
    parentTo: "/estoque",
    parentLabel: "Estoque",
    label: "Retalhos",
  },
  "/estoque/movimentacoes": {
    group: "Operação",
    parentTo: "/estoque",
    parentLabel: "Estoque",
    label: "Movimentações",
  },
  "/estoque/ordens": {
    group: "Operação",
    parentTo: "/estoque",
    parentLabel: "Estoque",
    label: "Consumo por OP",
  },
  "/pagamentos": { group: "Financeiro", label: "Pagamentos" },
  "/historico": { group: "Gestão", label: "Histórico" },
  "/configuracoes": { group: "Gestão", label: "Configurações" },
};

function isPathActive(pathname: string, to: string, exact?: boolean) {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  if (exact || to === "/") {
    return normalized === to;
  }
  return normalized === to || normalized.startsWith(`${to}/`);
}

function AppSidebarNavigation({ pathname }: { pathname: string }) {
  const { canPath, auth, isLoading, authRequired } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const isSessionReady = !isLoading && (!authRequired || (auth.isAuthenticated && auth.isActive));

  if (!isSessionReady) {
    return <SidebarContent className="gap-1 px-1 py-2" />;
  }

  return (
    <SidebarContent className="gap-1 px-1 py-2">
      {NAV_GROUPS.map((group) => {
        const visibleItems = group.items
          .map((item) => {
            if (item.subItems && item.subItems.length > 0) {
              const visibleSubItems = item.subItems.filter((sub) => canPath(sub.to));
              if (visibleSubItems.length === 0) return null;
              return { ...item, visibleSubItems };
            }
            return canPath(item.to) ? { ...item, visibleSubItems: undefined } : null;
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        if (visibleItems.length === 0) return null;

        return (
          <SidebarGroup key={group.label} className="py-1.5">
            <SidebarGroupLabel className="h-6 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map((item) => {
                  const active = isPathActive(pathname, item.to, item.exact);
                  const Icon = item.icon;
                  const visibleSubItems = item.visibleSubItems;
                  const hasSub = Boolean(visibleSubItems && visibleSubItems.length > 0);
                  const targetTo = canPath(item.to)
                    ? item.to
                    : (visibleSubItems?.[0]?.to ?? item.to);

                  if (!hasSub) {
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link to={targetTo} onClick={handleLinkClick}>
                            <Icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  }

                  return (
                    <Collapsible
                      key={item.to}
                      asChild
                      defaultOpen={active}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link to={targetTo} onClick={handleLinkClick}>
                            <Icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuAction
                            aria-label={`Expandir submenu de ${item.label}`}
                            className="data-[state=open]:rotate-90"
                          >
                            <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/60" />
                          </SidebarMenuAction>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {visibleSubItems!.map((sub) => {
                              const subActive = isPathActive(pathname, sub.to, sub.exact);
                              return (
                                <SidebarMenuSubItem key={sub.to}>
                                  <SidebarMenuSubButton asChild size="sm" isActive={subActive}>
                                    <Link to={sub.to} onClick={handleLinkClick}>
                                      <span>{sub.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              );
                            })}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        );
      })}
    </SidebarContent>
  );
}

function AppSidebarFooter() {
  const { auth, user, signOut, canPath } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    toast.success("Sessão encerrada com sucesso.");
    await navigate({ to: "/login", search: { redirect: undefined, expired: undefined } });
  };

  if (!auth.isAuthenticated) {
    return (
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Entrar no sistema">
              <Link to="/login" search={{ redirect: undefined, expired: undefined }}>
                <LogIn />
                <span>Entrar no sistema</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    );
  }

  const displayRoles = user?.roles?.map((r) => r.name) ?? auth.roles;
  const initials = (auth.name || auth.email || "U")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <SidebarFooter className="border-t border-sidebar-border p-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                tooltip={auth.name || auth.email || "Conta"}
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-[11px] font-semibold text-sidebar-primary-foreground">
                  {initials || "U"}
                </div>
                <div className="grid flex-1 text-left text-xs leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium text-sidebar-foreground">
                    {auth.name || auth.email}
                  </span>
                  <span className="truncate text-[11px] text-sidebar-foreground/60">
                    {displayRoles[0] ?? auth.email}
                  </span>
                </div>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-60 rounded-lg">
              <DropdownMenuLabel className="p-2 font-normal">
                <div className="flex flex-col space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    <span className="truncate">{auth.name || auth.email}</span>
                  </div>
                  {auth.email && (
                    <span className="truncate text-[11px] text-muted-foreground">{auth.email}</span>
                  )}
                  {displayRoles.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {displayRoles.slice(0, 3).map((roleName) => (
                        <Badge
                          key={roleName}
                          variant="secondary"
                          className="px-1.5 py-0 text-[10px] font-normal"
                        >
                          {roleName}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canPath("/configuracoes") && (
                <DropdownMenuItem asChild>
                  <Link to="/configuracoes" className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações e Acessos
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={() => void handleLogout()}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Encerrar sessão
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}

function HeaderBreadcrumbs({
  pathname,
  fallbackTitle,
}: {
  pathname: string;
  fallbackTitle?: string;
}) {
  const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  const matched = ROUTE_LABELS[normalized];

  if (normalized.startsWith("/producao/ordens/")) {
    return (
      <Breadcrumb>
        <BreadcrumbList className="text-xs sm:text-sm">
          <BreadcrumbItem className="hidden sm:inline-flex">
            <BreadcrumbLink asChild>
              <Link to="/producao">Produção</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:inline-flex" />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/producao/ordens">Ordens de Produção</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">
              {fallbackTitle && fallbackTitle !== "Produção" ? fallbackTitle : "Detalhe da OP"}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  if (matched) {
    const showParent = matched.parentTo && matched.parentTo !== normalized;
    return (
      <Breadcrumb>
        <BreadcrumbList className="text-xs sm:text-sm">
          {matched.group && (
            <>
              <BreadcrumbItem className="hidden md:inline-flex">
                <span className="text-muted-foreground/80">{matched.group}</span>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:inline-flex" />
            </>
          )}
          {showParent && (
            <>
              <BreadcrumbItem className="hidden sm:inline-flex">
                <BreadcrumbLink asChild>
                  <Link to={matched.parentTo!}>{matched.parentLabel}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden sm:inline-flex" />
            </>
          )}
          <BreadcrumbItem>
            <BreadcrumbPage className="font-medium">
              {normalized === "/pedidos/novo" && fallbackTitle ? fallbackTitle : matched.label}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList className="text-xs sm:text-sm">
        <BreadcrumbItem>
          <BreadcrumbPage className="font-medium">
            {fallbackTitle ?? "Art Frame Hub"}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function HeaderAlertsMenu() {
  const { auth, isLoading, authRequired, can } = useAuth();
  const isSessionReady = !isLoading && (!authRequired || (auth.isAuthenticated && auth.isActive));
  const canViewProdutos = isSessionReady && can("produtos.view");

  const alertasQ = useQuery({
    queryKey: ["alertas-essenciais"],
    queryFn: () => produtosService.listAlertasEssenciais(),
    enabled: canViewProdutos,
    staleTime: 60_000,
  });

  const count = alertasQ.data?.length ?? 0;
  if (!canViewProdutos || count === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label={`${count} alerta(s) de estoque crítico`}
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
            {count}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Alertas de Estoque Essencial ({count})
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-60 overflow-y-auto py-1">
          {(alertasQ.data ?? []).slice(0, 6).map((a) => (
            <DropdownMenuItem key={a.produto.id} asChild>
              <Link
                to="/produtos/essenciais"
                className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
              >
                <div className="flex w-full items-center justify-between gap-2 text-xs font-medium">
                  <span className="truncate">{a.produto.nome}</span>
                  <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                    {a.estoque_real} {a.produto.unidade_estoque ?? a.produto.unidade}
                  </Badge>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {PRODUTO_TIPO_LABEL[a.produto.tipo]} · Mínimo: {a.produto.estoque_minimo}
                </span>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            to="/produtos/essenciais"
            className="justify-center text-xs font-medium text-primary cursor-pointer"
          >
            Gerenciar produtos essenciais →
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function HeaderUserMenu() {
  const { auth, user, signOut, canPath } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    toast.success("Sessão encerrada com sucesso.");
    await navigate({ to: "/login", search: { redirect: undefined, expired: undefined } });
  };

  if (!auth.isAuthenticated) {
    return (
      <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
        <Link to="/login" search={{ redirect: undefined, expired: undefined }}>
          <LogIn className="mr-1.5 h-3.5 w-3.5" />
          Entrar
        </Link>
      </Button>
    );
  }

  const displayRoles = user?.roles?.map((r) => r.name) ?? auth.roles;
  const initials = (auth.name || auth.email || "U")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2 text-xs font-normal text-foreground"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {initials || "U"}
          </span>
          <span className="hidden max-w-[140px] truncate font-medium md:inline">
            {auth.name || auth.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="truncate text-xs font-semibold text-foreground">
              {auth.name || auth.email}
            </p>
            {auth.email && (
              <p className="truncate text-[11px] text-muted-foreground">{auth.email}</p>
            )}
            {displayRoles.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {displayRoles.slice(0, 3).map((r) => (
                  <Badge
                    key={r}
                    variant="secondary"
                    className="px-1.5 py-0 text-[10px] font-normal"
                  >
                    {r}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canPath("/configuracoes") && (
          <DropdownMenuItem asChild>
            <Link to="/configuracoes" className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => void handleLogout()}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Encerrar sessão
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  children,
  title,
  layoutMode = "default",
}: {
  children: React.ReactNode;
  title?: string;
  layoutMode?: "default" | "focus";
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [commandOpen, setCommandOpen] = React.useState(false);
  const isFocus = layoutMode === "focus";

  return (
    <SidebarProvider>
      {!isFocus && (
        <Sidebar collapsible="icon">
          <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  size="lg"
                  asChild
                  tooltip="ART FRAME HUB"
                  className="hover:bg-transparent active:bg-transparent"
                >
                  <Link to="/">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                      <Frame className="h-4 w-4" />
                    </div>
                    <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                      <span className="truncate text-xs font-bold tracking-tight text-sidebar-foreground">
                        ART FRAME HUB
                      </span>
                      <span className="truncate text-[10px] font-medium text-sidebar-foreground/60">
                        Molduraria ERP
                      </span>
                    </div>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>

          <AppSidebarNavigation pathname={pathname} />
          <AppSidebarFooter />
          <SidebarRail />
        </Sidebar>
      )}

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            {!isFocus ? (
              <>
                <SidebarTrigger className="-ml-1 h-8 w-8 text-muted-foreground hover:text-foreground" />
                <Separator orientation="vertical" className="h-4" />
              </>
            ) : (
              <Link
                to="/"
                className="flex items-center gap-2 text-xs font-semibold tracking-tight text-foreground"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
                  <Frame className="h-3.5 w-3.5" />
                </div>
                <span className="hidden sm:inline">ART FRAME HUB</span>
                <Separator orientation="vertical" className="mx-1 h-4" />
              </Link>
            )}
            <HeaderBreadcrumbs pathname={pathname} fallbackTitle={title} />
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCommandOpen(true)}
              className="h-8 gap-2 border-border/80 bg-muted/30 px-2.5 text-xs font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:w-56 sm:justify-between"
              aria-label="Pesquisar no sistema (Ctrl+K)"
            >
              <span className="inline-flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Buscar ou navegar…</span>
              </span>
              <kbd className="pointer-events-none hidden h-5 select-none items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
                Ctrl K
              </kbd>
            </Button>
            <HeaderAlertsMenu />
            <HeaderUserMenu />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div
            className={isFocus ? "mx-auto w-full max-w-[1600px]" : "mx-auto w-full max-w-[1440px]"}
          >
            <RouteAccessGuard>{children}</RouteAccessGuard>
          </div>
        </div>
      </SidebarInset>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </SidebarProvider>
  );
}
