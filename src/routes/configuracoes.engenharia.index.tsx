import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Terminal,
  Layers,
  RotateCcw,
  Code,
  Database,
  CheckCircle2,
  Search,
  Settings2,
  ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/configuracoes/engenharia/")({
  head: () => ({ meta: [{ title: "Engenharia e Testes — Molduraria ERP" }] }),
  component: EngenhariaIndex,
});

const TOOLS = [
  {
    to: "/configuracoes/engenharia/barras",
    icon: Terminal,
    title: "Simulador de Barras",
    desc: "Otimize cortes lineares de perfis em barras de 270 cm.",
  },
  {
    to: "/configuracoes/engenharia/chapas",
    icon: Layers,
    title: "Simulador de Chapas",
    desc: "Encaixe bidimensional via estratégia Guillotine.",
  },
  {
    to: "/configuracoes/engenharia/bobinas",
    icon: RotateCcw,
    title: "Simulador de Bobinas",
    desc: "Rotação e avanço linear em rolos de impressão.",
  },
  {
    to: "/configuracoes/engenharia/manufacturing",
    icon: Code,
    title: "Manufacturing Engine",
    desc: "Inspecione cálculos, aberturas e desdobramento de peças.",
  },
  {
    to: "/configuracoes/engenharia/stock",
    icon: Database,
    title: "Stock Engine",
    desc: "Fluxo de reservas, retalhos e movimentações.",
  },
  {
    to: "/configuracoes/engenharia/testes",
    icon: CheckCircle2,
    title: "Testes Automatizados",
    desc: "Bateria de cenários críticos dos motores.",
  },
  {
    to: "/configuracoes/engenharia/logs",
    icon: Search,
    title: "Log dos Algoritmos",
    desc: "Auditoria de decisões e alocações.",
  },
  {
    to: "/configuracoes/engenharia/algoritmos",
    icon: Settings2,
    title: "Configurações",
    desc: "Mapeamento de algoritmos por tipo de estoque.",
  },
] as const;

function EngenhariaIndex() {
  return (
    <AppShell title="Engenharia e Testes">
      <PageHeader
        title="Engenharia e Testes"
        description="Ferramentas de validação dos motores de cálculo e estratégias de corte."
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <Link key={t.to} to={t.to} className="group">
              <Card className="h-full border-border/60 bg-card transition-colors hover:border-primary/60 hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </CardHeader>
                <CardContent className="space-y-1">
                  <CardTitle className="text-sm font-semibold tracking-tight">{t.title}</CardTitle>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
