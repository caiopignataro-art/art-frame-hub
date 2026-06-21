import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clientesService } from "@/lib/services/clientes.service";
import { orcamentosService } from "@/lib/services/orcamentos.service";
import { pedidosService } from "@/lib/services/pedidos.service";
import { pagamentosService } from "@/lib/services/pagamentos.service";
import { formatBRL } from "@/lib/format";
import { Users, FileText, ShoppingBag, CreditCard } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Molduraria ERP" },
      { name: "description", content: "Visão geral do ERP de molduraria." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const clientes = useQuery({ queryKey: ["clientes"], queryFn: clientesService.list });
  const orcamentos = useQuery({ queryKey: ["orcamentos"], queryFn: orcamentosService.list });
  const pedidos = useQuery({ queryKey: ["pedidos"], queryFn: () => pedidosService.list() });
  const pagamentos = useQuery({ queryKey: ["pagamentos"], queryFn: pagamentosService.listAll });

  const totalRecebido = (pagamentos.data ?? [])
    .filter((p) => p.status === "pago")
    .reduce((s, p) => s + Number(p.valor), 0);

  const pedidosAtivos = (pedidos.data ?? []).filter(
    (p) => p.status === "aguardando_producao" || p.status === "em_producao",
  );

  return (
    <AppShell title="Dashboard">
      <PageHeader
        title="Visão geral"
        description="Resumo dos principais indicadores da operação."
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Clientes" value={clientes.data?.length ?? 0} />
        <StatCard icon={<FileText className="h-4 w-4" />} label="Orçamentos" value={orcamentos.data?.length ?? 0} />
        <StatCard icon={<ShoppingBag className="h-4 w-4" />} label="Pedidos ativos" value={pedidosAtivos.length} />
        <StatCard icon={<CreditCard className="h-4 w-4" />} label="Total recebido" value={formatBRL(totalRecebido)} />
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Próximos passos</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>✓ Banco de dados, RLS, índices, triggers de auditoria e seeds criados.</p>
          <p>✓ Camada de serviços tipada em <code className="rounded bg-muted px-1 py-0.5">src/lib/services/</code>.</p>
          <p>✓ Rotas para cada módulo do ERP.</p>
          <p>→ Próximos módulos: calculadora de quadros, formulários, geração de PDF, autenticação por papel.</p>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
