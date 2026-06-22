import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { configuracoesService } from "@/lib/services/configuracoes.service";
import { CONFIG_KEYS } from "@/types/estoque";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Molduraria ERP" }] }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const qc = useQueryClient();
  const { data: configs } = useQuery({
    queryKey: ["configs"],
    queryFn: () => configuracoesService.list(),
  });

  const [barra, setBarra] = useState("270");
  const [perda, setPerda] = useState("15");
  const [minDefault, setMinDefault] = useState("2");

  useEffect(() => {
    for (const c of configs ?? []) {
      const v = String(c.valor);
      if (c.chave === CONFIG_KEYS.comprimento_barra_cm) setBarra(v);
      if (c.chave === CONFIG_KEYS.perda_corte_percentual) setPerda(v);
      if (c.chave === CONFIG_KEYS.estoque_minimo_default) setMinDefault(v);
    }
  }, [configs]);

  const salvar = useMutation({
    mutationFn: async () => {
      await configuracoesService.setNumber(
        CONFIG_KEYS.comprimento_barra_cm,
        Number(barra),
        "Comprimento padrão da barra (cm)",
      );
      await configuracoesService.setNumber(
        CONFIG_KEYS.perda_corte_percentual,
        Number(perda),
        "Perda de corte (%)",
      );
      await configuracoesService.setNumber(
        CONFIG_KEYS.estoque_minimo_default,
        Number(minDefault),
        "Estoque mínimo padrão (barras)",
      );
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      qc.invalidateQueries({ queryKey: ["configs"] });
      qc.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Configurações">
      <PageHeader
        title="Configurações do sistema"
        description="Parâmetros usados pela engine de estoque e calculadora."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estoque de molduras</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Comprimento da barra (cm)"
              value={barra}
              onChange={setBarra}
              hint="Padrão de mercado: 270 cm. Aplica-se a todos os perfis."
            />
            <Field
              label="Perda de corte (%)"
              value={perda}
              onChange={setPerda}
              hint="Acréscimo no consumo de moldura para cobrir perdas no corte."
            />
            <Field
              label="Estoque mínimo padrão (barras)"
              value={minDefault}
              onChange={setMinDefault}
              hint="Usado para alertas quando o perfil não tem mínimo próprio."
            />
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
              {salvar.isPending ? "Salvando..." : "Salvar configurações"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Field({
  label, value, onChange, hint,
}: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
