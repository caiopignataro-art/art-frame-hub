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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { configuracoesService } from "@/lib/services/configuracoes.service";
import { CONFIG_KEYS } from "@/types/estoque";
import { CONFIG_KEY_MAX_PARCELAS, DEFAULT_MAX_PARCELAS } from "@/lib/pagamento/modalidade";


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
  const [maxParcelas, setMaxParcelas] = useState(String(DEFAULT_MAX_PARCELAS));
  const [algoritmos, setAlgoritmos] = useState<Record<string, string>>({
    barras: "barras_default",
    chapas: "guillotine",
    bobinas: "bobinas_default",
    metro_linear: "padrao",
    area: "padrao",
    unidade: "padrao"
  });


  useEffect(() => {
    for (const c of configs ?? []) {
      const v = String(c.valor);
      if (c.chave === CONFIG_KEYS.comprimento_barra_cm) setBarra(v);
      if (c.chave === CONFIG_KEYS.perda_corte_percentual) setPerda(v);
      if (c.chave === CONFIG_KEYS.estoque_minimo_default) setMinDefault(v);
      if (c.chave === CONFIG_KEY_MAX_PARCELAS) setMaxParcelas(v);
      if (c.chave === "estoque.algoritmos_corte") {
        try {
          const parsed = typeof c.valor === "string" ? JSON.parse(c.valor) : c.valor;
          if (parsed && typeof parsed === "object") {
            setAlgoritmos(parsed as Record<string, string>);
          }
        } catch (e) {
          console.error(e);
        }
      }
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
      const mp = Math.max(1, Math.min(12, Number(maxParcelas) || DEFAULT_MAX_PARCELAS));
      await configuracoesService.setNumber(
        CONFIG_KEY_MAX_PARCELAS,
        mp,
        "Quantidade máxima de parcelas no crédito parcelado (1 a 12)",
      );
      await configuracoesService.setJson(
        "estoque.algoritmos_corte",
        algoritmos,
        "Mapeamento dos algoritmos de corte por Forma de Estoque",
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pagamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Quantidade máxima de parcelas"
              value={maxParcelas}
              onChange={(v) => {
                const n = Math.max(1, Math.min(12, Number(v) || 1));
                setMaxParcelas(String(n));
              }}
              hint="Entre 1 e 12. Define o limite de parcelas no Crédito Parcelado (padrão: 6)."
            />
            <Button onClick={() => salvar.mutate()} disabled={salvar.isPending} variant="outline">
              {salvar.isPending ? "Salvando..." : "Salvar configurações"}
            </Button>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Algoritmos de Corte (Stock Engine)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Algoritmo para Barras</Label>
              <Select value={algoritmos.barras} onValueChange={(v) => setAlgoritmos({ ...algoritmos, barras: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="barras_default">Algoritmo de Barras (Padrão)</SelectItem>
                  <SelectItem value="nesting_irregular" disabled>Nesting Irregular (Futuro)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Otimiza perfis lineares de moldura.</p>
            </div>

            <div className="space-y-2">
              <Label>Algoritmo para Chapas</Label>
              <Select value={algoritmos.chapas} onValueChange={(v) => setAlgoritmos({ ...algoritmos, chapas: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="guillotine">Algoritmo Guillotine (Cortes Retos)</SelectItem>
                  <SelectItem value="maxrects" disabled>MaxRects (Futuro)</SelectItem>
                  <SelectItem value="skyline" disabled>Skyline (Futuro)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Otimiza placas (Vidro, MDF, Passe-partout).</p>
            </div>

            <div className="space-y-2">
              <Label>Algoritmo para Bobinas</Label>
              <Select value={algoritmos.bobinas} onValueChange={(v) => setAlgoritmos({ ...algoritmos, bobinas: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bobinas_default">Algoritmo de Bobinas (Menor Comprimento)</SelectItem>
                  <SelectItem value="otimizacao_multipla" disabled>Otimização Múltipla (Futuro)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Otimiza canvas, vinil e papéis fotográficos.</p>
            </div>

            <div className="col-span-full pt-4">
              <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                {salvar.isPending ? "Salvando..." : "Salvar algoritmos"}
              </Button>
            </div>
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
