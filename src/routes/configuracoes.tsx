import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthAuditLogPanel } from "@/components/admin/AuthAuditLogPanel";
import { PermissionsMatrixPanel } from "@/components/admin/PermissionsMatrixPanel";
import { RolesManagementPanel } from "@/components/admin/RolesManagementPanel";
import { UsersManagementPanel } from "@/components/admin/UsersManagementPanel";
import { useAuth } from "@/components/auth/AuthContextProvider";
import { PageHeader } from "@/components/erp/PageHeader";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CONFIG_KEY_MAX_PARCELAS, DEFAULT_MAX_PARCELAS } from "@/lib/pagamento/modalidade";
import { configuracoesService } from "@/lib/services/configuracoes.service";
import { CONFIG_KEYS } from "@/types/estoque";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações e Acessos — Molduraria ERP" }] }),
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
    <AppShell title="Configurações e Controle de Acesso">
      <PageHeader
        title="Configurações e Gestão de Acessos"
        description="Parâmetros operacionais do ERP, administração de usuários, perfis e permissões granulares."
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {canManageConfigs && <TabsTrigger value="parametros">Parâmetros do Sistema</TabsTrigger>}
          {canManageUsers && <TabsTrigger value="usuarios">Usuários</TabsTrigger>}
          {canManageRoles && <TabsTrigger value="perfis">Perfis de Acesso</TabsTrigger>}
          {canManageRoles && <TabsTrigger value="permissoes">Matriz de Permissões</TabsTrigger>}
          {canManageUsers && <TabsTrigger value="auditoria">Auditoria & Arquitetura</TabsTrigger>}
        </TabsList>

        {canManageConfigs && (
          <TabsContent value="parametros" className="space-y-4">
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
                  <Button
                    onClick={() => salvar.mutate()}
                    disabled={salvar.isPending}
                    variant="outline"
                  >
                    {salvar.isPending ? "Salvando..." : "Salvar configurações"}
                  </Button>
                </CardContent>
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
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
