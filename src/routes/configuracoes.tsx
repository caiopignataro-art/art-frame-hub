import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Boxes, CreditCard, Database, KeyRound, Lock, Save, Sliders, Users } from "lucide-react";
import { AuthAuditLogPanel } from "@/components/admin/AuthAuditLogPanel";
import { PermissionsMatrixPanel } from "@/components/admin/PermissionsMatrixPanel";
import { RolesManagementPanel } from "@/components/admin/RolesManagementPanel";
import { UsersManagementPanel } from "@/components/admin/UsersManagementPanel";
import { useAuth } from "@/components/auth/AuthContextProvider";
import { PageHeader } from "@/components/erp/PageHeader";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONFIG_KEY_MAX_PARCELAS, DEFAULT_MAX_PARCELAS } from "@/lib/pagamento/modalidade";
import { configuracoesService } from "@/lib/services/configuracoes.service";
import { CONFIG_KEYS } from "@/types/estoque";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações e Acessos — Art Frame Hub" }] }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const qc = useQueryClient();
  const { canAny } = useAuth();

  const canManageConfigs = canAny([
    "configuracoes.view",
    "configuracoes.manage",
    "configuracoes.update",
  ]);
  const canManageUsers = canAny(["usuarios.view", "usuarios.create", "usuarios.update"]);
  const canManageRoles = canAny(["perfis.view", "roles.manage", "permissions.manage"]);

  const [activeTab, setActiveTab] = useState<string>("parametros");
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<string | null>(null);

  const { data: configs } = useQuery({
    queryKey: ["configs"],
    queryFn: () => configuracoesService.list(),
    enabled: canManageConfigs,
  });

  const [barra, setBarra] = useState("270");
  const [perda, setPerda] = useState("15");
  const [minDefault, setMinDefault] = useState("2");
  const [maxParcelas, setMaxParcelas] = useState(String(DEFAULT_MAX_PARCELAS));

  useEffect(() => {
    for (const c of configs ?? []) {
      const v = String(c.valor);
      if (c.chave === CONFIG_KEYS.comprimento_barra_cm) setBarra(v);
      if (c.chave === CONFIG_KEYS.perda_corte_percentual) setPerda(v);
      if (c.chave === CONFIG_KEYS.estoque_minimo_default) setMinDefault(v);
      if (c.chave === CONFIG_KEY_MAX_PARCELAS) setMaxParcelas(v);
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
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      void qc.invalidateQueries({ queryKey: ["configs"] });
      void qc.invalidateQueries({ queryKey: ["estoque"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Configurações">
      <PageHeader
        title="Configurações e Governança de Acessos"
        description="Parâmetros operacionais do ERP, administração de usuários corporativos, perfis RBAC e trilha de auditoria."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted/50 p-1">
          {canManageConfigs && (
            <TabsTrigger value="parametros" className="gap-1.5 text-xs sm:text-sm">
              <Sliders className="h-3.5 w-3.5" />
              Parâmetros do Sistema
            </TabsTrigger>
          )}
          {canManageUsers && (
            <TabsTrigger value="usuarios" className="gap-1.5 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5" />
              Usuários
            </TabsTrigger>
          )}
          {canManageRoles && (
            <TabsTrigger value="perfis" className="gap-1.5 text-xs sm:text-sm">
              <Lock className="h-3.5 w-3.5" />
              Perfis de Acesso
            </TabsTrigger>
          )}
          {canManageRoles && (
            <TabsTrigger value="permissoes" className="gap-1.5 text-xs sm:text-sm">
              <KeyRound className="h-3.5 w-3.5" />
              Matriz de Permissões
            </TabsTrigger>
          )}
          {canManageUsers && (
            <TabsTrigger value="auditoria" className="gap-1.5 text-xs sm:text-sm">
              <Database className="h-3.5 w-3.5" />
              Auditoria & Arquitetura
            </TabsTrigger>
          )}
        </TabsList>

        {canManageConfigs && (
          <TabsContent value="parametros" className="space-y-4">
            <div className="grid gap-5 md:grid-cols-2">
              <Card className="flex flex-col justify-between">
                <div>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <Boxes className="h-4 w-4 text-primary" />
                      Engenharia e Estoque de Molduras
                    </CardTitle>
                    <CardDescription>
                      Regras técnicas aplicadas no cálculo de barras, cortes e alertas de reposição.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field
                      label="Comprimento padrão da barra (cm)"
                      value={barra}
                      onChange={setBarra}
                      hint="Padrão de mercado: 270 cm. Utilizado na otimização de corte da calculadora e estoque."
                    />
                    <Field
                      label="Margem de perda de corte (%)"
                      value={perda}
                      onChange={setPerda}
                      hint="Acréscimo técnico sobre o consumo linear de moldura para cobrir chanfros e perdas."
                    />
                    <Field
                      label="Estoque mínimo padrão (barras)"
                      value={minDefault}
                      onChange={setMinDefault}
                      hint="Limiar padrão para alertas quando o perfil não possui estoque mínimo individual."
                    />
                  </CardContent>
                </div>
                <CardFooter className="border-t border-border/60 pt-4">
                  <Button size="sm" onClick={() => salvar.mutate()} disabled={salvar.isPending}>
                    <Save className="h-3.5 w-3.5" />
                    {salvar.isPending ? "Salvando…" : "Salvar configurações"}
                  </Button>
                </CardFooter>
              </Card>

              <Card className="flex flex-col justify-between">
                <div>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                      <CreditCard className="h-4 w-4 text-primary" />
                      Regras Comerciais e Pagamentos
                    </CardTitle>
                    <CardDescription>
                      Parâmetros financeiros aplicados na emissão e aprovação de pedidos.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field
                      label="Quantidade máxima de parcelas (Crédito)"
                      value={maxParcelas}
                      onChange={(v) => {
                        const n = Math.max(1, Math.min(12, Number(v) || 1));
                        setMaxParcelas(String(n));
                      }}
                      hint="Valor permitido entre 1 e 12. Define o limite de parcelamento na tela de pedidos (padrão: 6x)."
                    />
                  </CardContent>
                </div>
                <CardFooter className="border-t border-border/60 pt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => salvar.mutate()}
                    disabled={salvar.isPending}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {salvar.isPending ? "Salvando…" : "Salvar configurações"}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
        )}

        {canManageUsers && (
          <TabsContent value="usuarios">
            <UsersManagementPanel />
          </TabsContent>
        )}

        {canManageRoles && (
          <TabsContent value="perfis">
            <RolesManagementPanel
              onSelectRoleForPermissions={(roleId) => {
                setSelectedRoleForMatrix(roleId);
                setActiveTab("permissoes");
              }}
            />
          </TabsContent>
        )}

        {canManageRoles && (
          <TabsContent value="permissoes">
            <PermissionsMatrixPanel
              selectedRoleId={selectedRoleForMatrix}
              onSelectRoleId={setSelectedRoleForMatrix}
            />
          </TabsContent>
        )}

        {canManageUsers && (
          <TabsContent value="auditoria">
            <AuthAuditLogPanel />
          </TabsContent>
        )}
      </Tabs>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono text-sm"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
