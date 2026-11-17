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
import { clientesService } from "@/lib/services/clientes.service";
import { pedidosService } from "@/lib/services/pedidos.service";
import { produtosService } from "@/lib/services/produtos.service";
import { ordemProducaoService } from "@/lib/services/ordem-producao.service";
import { productionKeys } from "@/lib/services/production-cache";
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

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { auth, canPath } = useAuth();

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

  const canViewPedidos = !auth.isAuthenticated || canPath("/pedidos");
  const canViewClientes = !auth.isAuthenticated || canPath("/clientes");
  const canViewProdutos = !auth.isAuthenticated || canPath("/produtos");
  const canViewProducao = !auth.isAuthenticated || canPath("/producao");

  const pedidosQ = useQuery({
    queryKey: ["pedidos"],
    queryFn: () => pedidosService.list(),
    enabled: open && canViewPedidos,
    staleTime: 30_000,
  });

  const clientesQ = useQuery({
    queryKey: ["clientes"],
    queryFn: () => clientesService.list(),
    enabled: open && canViewClientes,
    staleTime: 30_000,
  });

  const produtosQ = useQuery({
    queryKey: ["produtos"],
    queryFn: () => produtosService.list(),
    enabled: open && canViewProdutos,
    staleTime: 30_000,
  });

  const opsQ = useQuery({
    queryKey: productionKeys.ordens,
    queryFn: () => ordemProducaoService.list(),
    enabled: open && canViewProducao,
    staleTime: 30_000,
  });

  const visibleNav = React.useMemo(
    () =>
      NAV_COMMANDS.filter((item) => {
        if (!auth.isAuthenticated) return true;
        return canPath(item.to);
      }),
    [auth.isAuthenticated, canPath],
  );

  const runCommand = (cb: () => void) => {
    onOpenChange(false);
    cb();
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar módulos, pedidos, clientes, produtos ou OPs…" />
      <CommandList className="max-h-[380px]">
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

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

        {canViewPedidos && (pedidosQ.data?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Pedidos Recentes">
              {(pedidosQ.data ?? []).slice(0, 8).map((p) => (
                <CommandItem
                  key={p.id}
                  value={`pedido #${p.numero_pedido} ${p.cliente?.nome ?? ""} ${PEDIDO_STATUS_LABEL[p.status]}`}
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
              {(opsQ.data ?? []).slice(0, 6).map((op) => (
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
              {(clientesQ.data ?? []).slice(0, 8).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`cliente ${c.nome} ${c.whatsapp ?? ""} ${c.cpf_cnpj ?? ""} ${c.email ?? ""}`}
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
              {(produtosQ.data ?? []).slice(0, 8).map((pr) => {
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
