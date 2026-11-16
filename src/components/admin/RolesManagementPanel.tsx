import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthContextProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { rolesKeys, rolesService } from "@/lib/services/roles.service";
import type { RoleWithDetails } from "@/types/permissions";

export function RolesManagementPanel({
  onSelectRoleForPermissions,
}: {
  onSelectRoleForPermissions?: (roleId: string) => void;
}) {
  const qc = useQueryClient();
  const { canAny } = useAuth();

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<RoleWithDetails | null>(null);
  const [formCode, setFormCode] = React.useState("");
  const [formName, setFormName] = React.useState("");
  const [formDescription, setFormDescription] = React.useState("");
  const [formActive, setFormActive] = React.useState(true);

  const [inspectUsersRole, setInspectUsersRole] = React.useState<RoleWithDetails | null>(null);

  const rolesQ = useQuery({
    queryKey: rolesKeys.all,
    queryFn: () => rolesService.list(),
  });

  const roleUsersQ = useQuery({
    queryKey: rolesKeys.usersByRole(inspectUsersRole?.id ?? ""),
    queryFn: () => rolesService.listUsersByRole(inspectUsersRole!.id),
    enabled: Boolean(inspectUsersRole?.id),
  });

  const canManageRoles = canAny(["roles.manage", "perfis.create", "perfis.update"]);
  const canDeleteRoles = canAny(["roles.manage", "perfis.delete"]);

  const openCreate = () => {
    setEditingRole(null);
    setFormCode("");
    setFormName("");
    setFormDescription("");
    setFormActive(true);
    setFormOpen(true);
  };

  const openEdit = (role: RoleWithDetails) => {
    setEditingRole(role);
    setFormCode(role.code);
    setFormName(role.name);
    setFormDescription(role.description ?? "");
    setFormActive(role.active);
    setFormOpen(true);
  };

  const saveRoleMutation = useMutation({
    mutationFn: async () => {
      if (editingRole) {
        return rolesService.update(editingRole.id, {
          name: formName.trim(),
          description: formDescription.trim() || null,
          active: formActive,
        });
      }
      return rolesService.create({
        code: formCode.trim(),
        name: formName.trim(),
        description: formDescription.trim() || null,
        active: formActive,
      });
    },
    onSuccess: () => {
      toast.success(editingRole ? "Perfil atualizado." : "Perfil personalizado criado.");
      void qc.invalidateQueries({ queryKey: rolesKeys.all });
      setFormOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao salvar perfil.");
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => rolesService.remove(id),
    onSuccess: () => {
      toast.success("Perfil personalizado excluído.");
      void qc.invalidateQueries({ queryKey: rolesKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Não foi possível excluir o perfil.");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Perfis de sistema possuem código estável e proteção contra exclusão. Você também pode
          criar perfis personalizados.
        </p>
        {canManageRoles && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo perfil
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Perfil</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-center">Permissões</TableHead>
              <TableHead className="text-center">Usuários</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rolesQ.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  Carregando perfis…
                </TableCell>
              </TableRow>
            )}
            {(rolesQ.data ?? []).map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground max-w-md">{r.description}</div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>
                  {r.is_system ? (
                    <Badge variant="secondary" className="text-xs">
                      <Lock className="mr-1 h-3 w-3" /> Sistema
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Personalizado
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    size="sm"
                    variant="link"
                    onClick={() => onSelectRoleForPermissions?.(r.id)}
                  >
                    {r.permissions.length} permissão(ões)
                  </Button>
                </TableCell>
                <TableCell className="text-center">
                  <Button size="sm" variant="ghost" onClick={() => setInspectUsersRole(r)}>
                    <Users className="mr-1.5 h-3.5 w-3.5" />
                    {r.users_count}
                  </Button>
                </TableCell>
                <TableCell>
                  <Badge variant={r.active ? "default" : "outline"}>
                    {r.active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {canManageRoles && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Editar perfil"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canDeleteRoles && !r.is_system && (
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Excluir perfil personalizado"
                        disabled={deleteRoleMutation.isPending || r.users_count > 0}
                        onClick={() => deleteRoleMutation.mutate(r.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog Criar / Editar Perfil */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRole ? "Editar perfil" : "Novo perfil personalizado"}</DialogTitle>
            <DialogDescription>
              Defina o nome e a descrição do perfil. As permissões granulares podem ser ajustadas na
              aba Matriz de Permissões.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do perfil *</Label>
              <Input
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (!editingRole && !formCode) {
                    setFormCode(
                      e.target.value
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9]+/g, "_")
                        .replace(/^_+|_+$/g, ""),
                    );
                  }
                }}
                placeholder="Ex.: Supervisor de Produção"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Código identificador *</Label>
              <Input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                disabled={Boolean(editingRole)}
                className="font-mono text-xs"
                placeholder="Ex.: supervisor_producao"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Responsabilidades e escopo deste perfil…"
              />
            </div>

            {editingRole?.code !== "admin" && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Perfil ativo</div>
                  <div className="text-xs text-muted-foreground">
                    Perfis inativos não concedem permissões aos usuários vinculados.
                  </div>
                </div>
                <Switch checked={formActive} onCheckedChange={setFormActive} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveRoleMutation.mutate()}
              disabled={saveRoleMutation.isPending || !formName.trim() || !formCode.trim()}
            >
              {saveRoleMutation.isPending ? "Salvando…" : "Salvar perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Usuários associados ao Perfil */}
      <Dialog
        open={Boolean(inspectUsersRole)}
        onOpenChange={(o) => !o && setInspectUsersRole(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Usuários no perfil — {inspectUsersRole?.name}</DialogTitle>
            <DialogDescription>
              Colaboradores atualmente vinculados ao perfil <code>{inspectUsersRole?.code}</code>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {roleUsersQ.isLoading && (
              <p className="text-xs text-muted-foreground text-center py-4">Carregando…</p>
            )}
            {!roleUsersQ.isLoading && (roleUsersQ.data ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Nenhum usuário atribuído a este perfil.
              </p>
            )}
            {(roleUsersQ.data ?? []).map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded border p-2.5 text-sm"
              >
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </div>
                <Badge variant={u.status === "active" ? "default" : "outline"}>{u.status}</Badge>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button onClick={() => setInspectUsersRole(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
