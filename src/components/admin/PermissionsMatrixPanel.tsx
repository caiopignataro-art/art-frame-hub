import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Save, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthContextProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authKeys } from "@/lib/services/auth.service";
import { rolesKeys, rolesService } from "@/lib/services/roles.service";
import { usersKeys } from "@/lib/services/users.service";
import {
  PERMISSION_MODULES,
  PERMISSION_MODULE_LABELS,
  type Permission,
  type PermissionModule,
} from "@/types/permissions";

export function PermissionsMatrixPanel({
  selectedRoleId,
  onSelectRoleId,
}: {
  selectedRoleId?: string | null;
  onSelectRoleId?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const { canAny } = useAuth();

  const rolesQ = useQuery({
    queryKey: rolesKeys.all,
    queryFn: () => rolesService.list(),
  });

  const permissionsQ = useQuery({
    queryKey: rolesKeys.permissions(),
    queryFn: () => rolesService.listPermissions(),
  });

  const roles = React.useMemo(() => rolesQ.data ?? [], [rolesQ.data]);
  const allPermissions = React.useMemo(() => permissionsQ.data ?? [], [permissionsQ.data]);

  const [activeRoleId, setActiveRoleId] = React.useState<string>("");
  const [checkedIds, setCheckedIds] = React.useState<Set<string>>(new Set());
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (selectedRoleId && selectedRoleId !== activeRoleId) {
      setActiveRoleId(selectedRoleId);
    } else if (!activeRoleId && roles.length > 0) {
      setActiveRoleId(roles[0]!.id);
    }
  }, [selectedRoleId, activeRoleId, roles]);

  const activeRole = React.useMemo(
    () => roles.find((r) => r.id === activeRoleId) ?? null,
    [roles, activeRoleId],
  );

  React.useEffect(() => {
    if (!activeRole) return;
    setCheckedIds(new Set(activeRole.permissions.map((p) => p.id)));
    setDirty(false);
  }, [activeRole]);

  const permissionsByModule = React.useMemo(() => {
    const map = new Map<PermissionModule, Permission[]>();
    for (const mod of PERMISSION_MODULES) {
      map.set(mod, []);
    }
    for (const perm of allPermissions) {
      const list = map.get(perm.module) ?? [];
      list.push(perm);
      map.set(perm.module, list);
    }
    return map;
  }, [allPermissions]);

  const canEditPermissions = canAny(["permissions.manage", "roles.manage"]);

  const togglePermission = (permId: string, checked: boolean) => {
    if (!canEditPermissions) return;
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permId);
      else next.delete(permId);
      return next;
    });
    setDirty(true);
  };

  const toggleModuleAll = (mod: PermissionModule, selectAll: boolean) => {
    if (!canEditPermissions) return;
    const modPerms = permissionsByModule.get(mod) ?? [];
    setCheckedIds((prev) => {
      const next = new Set(prev);
      for (const p of modPerms) {
        if (selectAll) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
    setDirty(true);
  };

  const savePermissionsMutation = useMutation({
    mutationFn: async () => {
      if (!activeRole) throw new Error("Selecione um perfil.");
      return rolesService.setRolePermissions(activeRole.id, Array.from(checkedIds));
    },
    onSuccess: (updated) => {
      toast.success(`Permissões do perfil "${updated.name}" salvas com sucesso.`);
      setDirty(false);
      void qc.invalidateQueries({ queryKey: rolesKeys.all });
      void qc.invalidateQueries({ queryKey: usersKeys.all });
      void qc.invalidateQueries({ queryKey: authKeys.session });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao atualizar permissões do perfil.");
    },
  });

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="w-full sm:w-72">
              <Select
                value={activeRoleId}
                onValueChange={(id) => {
                  setActiveRoleId(id);
                  onSelectRoleId?.(id);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um perfil…" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeRole && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">
                  {checkedIds.size} de {allPermissions.length} permissões marcadas
                </Badge>
                {activeRole.description && <span>· {activeRole.description}</span>}
              </div>
            )}
          </div>

          {canEditPermissions && (
            <Button
              onClick={() => savePermissionsMutation.mutate()}
              disabled={!dirty || savePermissionsMutation.isPending || !activeRole}
            >
              <Save className="mr-2 h-4 w-4" />
              {savePermissionsMutation.isPending ? "Salvando…" : "Salvar permissões"}
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {PERMISSION_MODULES.map((mod) => {
          const modPerms = permissionsByModule.get(mod) ?? [];
          if (modPerms.length === 0) return null;

          const checkedCount = modPerms.filter((p) => checkedIds.has(p.id)).length;
          const allSelected = checkedCount === modPerms.length;

          return (
            <Card key={mod} className="flex flex-col">
              <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" />
                    {PERMISSION_MODULE_LABELS[mod]}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {checkedCount}/{modPerms.length} ativa(s)
                  </CardDescription>
                </div>

                {canEditPermissions && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => toggleModuleAll(mod, !allSelected)}
                  >
                    <Check className="mr-1 h-3 w-3" />
                    {allSelected ? "Desmarcar módulo" : "Marcar todas"}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {modPerms.map((perm) => {
                  const isChecked = checkedIds.has(perm.id);
                  return (
                    <label
                      key={perm.id}
                      className="flex items-start gap-2.5 rounded-md border border-border/60 p-2.5 text-xs hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={isChecked}
                        disabled={!canEditPermissions}
                        onCheckedChange={(v) => togglePermission(perm.id, Boolean(v))}
                        className="mt-0.5"
                      />
                      <div className="flex-1 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-foreground">{perm.name}</span>
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {perm.code}
                          </code>
                        </div>
                        {perm.description && (
                          <p className="text-[11px] text-muted-foreground">{perm.description}</p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
