import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Calculator,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  Hammer,
  History,
  LayoutDashboard,
  Layers,
  Loader2,
  Package,
  Plus,
  Scissors,
  Settings,
  ShoppingBag,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthContextProvider";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { commandSearchService } from "@/lib/services/command-search.service";
import { formatBRL, formatOPNumber } from "@/lib/format";
import { PEDIDO_STATUS_LABEL, PRODUTO_CATEGORIAS_IMPORTACAO, type ProdutoTipo } from "@/types/erp";

const NAV_COMMANDS = [
  {
    to: "/",
    label: "Calculadora de Orçamento",
    group: "Visão Geral",
    icon: Calculator,
    keywords: "orcamento quadro moldura calculo",
  },
  {
    to: "/dashboard",
    label: "Dashboard Executivo",
    group: "Visão Geral",
    icon: LayoutDashboard,
    keywords: "faturamento indicadores kpi metricas",
  },
  {
    to: "/clientes",
    label: "Clientes",
    group: "Comercial",
    icon: Users,
    keywords: "cadastro contatos whatsapp cpf",
  },
  {
    to: "/pedidos",
    label: "Pedidos",
    group: "Comercial",
    icon: ShoppingBag,
    keywords: "vendas orcamentos entregas",
  },
  {
    to: "/pedidos/novo",
    label: "Novo Pedido",
    group: "Comercial",
    icon: Plus,
    keywords: "criar lancar venda",
  },
  {
    to: "/produtos",
    label: "Produtos — Catálogo",
    group: "Catálogo",
    icon: Package,
    keywords: "molduras passe-partout precos",
  },
  {
    to: "/produtos/essenciais",
    label: "Produtos — Essenciais",
    group: "Catálogo",
    icon: Layers,
    keywords: "vidro fundo chassi impressao servicos",
  },
  {
    to: "/produtos/importacao",
    label: "Produtos — Importação XLSX",
    group: "Catálogo",
    icon: FileSpreadsheet,
    keywords: "planilha excel upload",
  },
  {
    to: "/producao",
    label: "Produção — Fluxo Kanban",
    group: "Operação",
    icon: Hammer,
    keywords: "kanban fila fabrica",
  },
  {
    to: "/producao/ordens",
    label: "Produção — Lotes de OP",
    group: "Operação",
    icon: ClipboardList,
    keywords: "ordens producao lotes",
  },
  {
    to: "/estoque",
    label: "Estoque — Saldo de Perfis",
    group: "Operação",
    icon: Boxes,
    keywords: "barras molduras alerta minimo",
  },
  {
    to: "/estoque/retalhos",
    label: "Estoque — Retalhos",
    group: "Operação",
    icon: Scissors,
    keywords: "sobras cortes",
  },
  {
    to: "/estoque/movimentacoes",
    label: "Estoque — Movimentações",
    group: "Operação",
    icon: History,
    keywords: "reservas consumos estornos",
  },
  {
    to: "/estoque/ordens",
    label: "Estoque — Consumo por OP",
    group: "Operação",
    icon: ClipboardList,
    keywords: "insumos ordens",
  },
  {
    to: "/pagamentos",
    label: "Pagamentos e Recebíveis",
    group: "Financeiro",
    icon: CreditCard,
    keywords: "financeiro pix cartao sinal",
  },
  {
    to: "/historico",
    label: "Histórico de Auditoria",
    group: "Gestão",
    icon: History,
    keywords: "logs alteracoes",
  },
  {
    to: "/configuracoes",
    label: "Configurações e Acessos",
    group: "Gestão",
    icon: Settings,
    keywords: "usuarios perfis permissoes parametros",
  },
] as const;

const SEARCH_DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 8;

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { auth, isLoading, authRequired, can, canPath } = useAuth();
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setDebouncedSearch("");
      return;
    }
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search, open]);

  const isSessionReady = !isLoading && (!authRequired || (auth.isAuthenticated && auth.isActive));

  const canViewPedidos = isSessionReady && can("pedidos.view");
  const canViewClientes = isSessionReady && can("clientes.view");
  const canViewProdutos = isSessionReady && can("produtos.view");
  const canViewProducao = isSessionReady && can("producao.view");

  const pedidosQ = useQuery({
    queryKey: ["command-palette", "pedidos", debouncedSearch],
    queryFn: () =>
      commandSearchService.searchPedidos({ query: debouncedSearch, limit: SEARCH_LIMIT }),
    enabled: open && canViewPedidos,
    staleTime: 30_000,
  });

  const clientesQ = useQuery({
    queryKey: ["command-palette", "clientes", debouncedSearch],
    queryFn: () =>
      commandSearchService.searchClientes({ query: debouncedSearch, limit: SEARCH_LIMIT }),
    enabled: open && canViewClientes,
    staleTime: 30_000,
  });

  const produtosQ = useQuery({
    queryKey: ["command-palette", "produtos", debouncedSearch],
    queryFn: () =>
      commandSearchService.searchProdutos({ query: debouncedSearch, limit: SEARCH_LIMIT }),
    enabled: open && canViewProdutos,
    staleTime: 30_000,
  });

  const opsQ = useQuery({
    queryKey: ["command-palette", "ordens-producao", debouncedSearch],
    queryFn: () =>
      commandSearchService.searchOrdensProducao({ query: debouncedSearch, limit: SEARCH_LIMIT }),
    enabled: open && canViewProducao,
    staleTime: 30_000,
  });

  const visibleNav = React.useMemo(() => {
    if (!isSessionReady) return [];
    return NAV_COMMANDS.filter((item) => canPath(item.to));
  }, [isSessionReady, canPath]);

  const isSearching =
    pedidosQ.isFetching || clientesQ.isFetching || produtosQ.isFetching || opsQ.isFetching;

  const runCommand = (cb: () => void) => {
    onOpenChange(false);
    cb();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Buscar módulos, pedidos (#), clientes, código de produto ou OPs…"
      />
      <CommandList className="max-h-[380px]">
        {isSearching && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Buscando registros…</span>
          </div>
        )}
        <CommandEmpty>
          {!isSessionReady
            ? "Autentique-se para acessar módulos e registros do ERP."
            : "Nenhum resultado encontrado."}
        </CommandEmpty>

        {visibleNav.length > 0 && (
          <CommandGroup heading="Módulos e Navegação Rápida">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              return (
                <CommandItem
                  key={item.to}
                  value={`${item.label} ${item.group} ${item.keywords}`}
                  onSelect={() =>
                    runCommand(() => {
                      if (item.to === "/pedidos/novo") {
                        void navigate({ to: "/pedidos/novo", search: {} });
                      } else {
                        void navigate({ to: item.to });
                      }
                    })
                  }
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{item.label}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{item.group}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {canViewPedidos && (pedidosQ.data?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={debouncedSearch ? "Pedidos Encontrados" : "Pedidos Recentes"}>
              {(pedidosQ.data ?? []).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`pedido #${p.numero_pedido} ${p.numero_pedido} ${p.cliente?.nome ?? ""} ${PEDIDO_STATUS_LABEL[p.status]}`}
                  onSelect={() =>
                    runCommand(() => {
                      void navigate({ to: "/pedidos/novo", search: { id: p.id } });
                    })
                  }
                >
                  <ShoppingBag className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-xs font-medium">#{p.numero_pedido}</span>
                  <span className="truncate">{p.cliente?.nome ?? "Cliente não informado"}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {formatBRL(p.valor_total)} · {PEDIDO_STATUS_LABEL[p.status]}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {canViewProducao && (opsQ.data?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ordens de Produção">
              {(opsQ.data ?? []).map((op) => (
                <CommandItem
                  key={op.id}
                  value={`op ordem producao ${formatOPNumber(op.numero)} ${op.numero} ${op.status}`}
                  onSelect={() =>
                    runCommand(() => {
                      void navigate({ to: "/producao/ordens/$id", params: { id: op.id } });
                    })
                  }
                >
                  <Hammer className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-mono text-xs font-semibold">
                    {formatOPNumber(op.numero)}
                  </span>
                  <span className="text-xs text-muted-foreground">{op.qtd_pedidos} pedido(s)</span>
                  <span className="ml-auto text-[11px] uppercase text-muted-foreground">
                    {op.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {canViewClientes && (clientesQ.data?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Clientes">
              {(clientesQ.data ?? []).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`cliente ${c.nome} ${c.whatsapp ?? ""} ${c.telefone ?? ""} ${c.cpf_cnpj ?? ""} ${c.email ?? ""}`}
                  onSelect={() =>
                    runCommand(() => {
                      void navigate({ to: "/clientes" });
                    })
                  }
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate font-medium">{c.nome}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {c.whatsapp ?? c.telefone ?? "—"}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {canViewProdutos && (produtosQ.data?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Produtos">
              {(produtosQ.data ?? []).map((pr) => {
                const isImportado = (
                  PRODUTO_CATEGORIAS_IMPORTACAO as readonly ProdutoTipo[]
                ).includes(pr.tipo);
                return (
                  <CommandItem
                    key={pr.id}
                    value={`produto ${pr.codigo ?? ""} ${pr.nome} ${pr.fabricante ?? ""}`}
                    onSelect={() =>
                      runCommand(() => {
                        void navigate({
                          to: isImportado ? "/produtos" : "/produtos/essenciais",
                        });
                      })
                    }
                  >
                    <Package className="mr-2 h-4 w-4 text-muted-foreground" />
                    {pr.codigo && (
                      <span className="font-mono text-xs text-muted-foreground">[{pr.codigo}]</span>
                    )}
                    <span className="truncate">{pr.nome}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {formatBRL(pr.preco_venda)}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
