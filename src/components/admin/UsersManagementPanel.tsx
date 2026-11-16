import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Eye,
  History,
  Pencil,
  Plus,
  Search,
  Shield,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthContextProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { rolesKeys, rolesService } from "@/lib/services/roles.service";
import { usersKeys, usersService } from "@/lib/services/users.service";
import {
  APP_USER_STATUS_LABEL,
  AUTH_AUDIT_EVENT_LABELS,
  type AppUserStatus,
  type AppUserWithDetails,
  type AuthAuditEventType,
} from "@/types/auth";

const STATUS_BADGE_VARIANT: Record<
  AppUserStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  active: "default",
  invited: "secondary",
  inactive: "outline",
  suspended: "destructive",
};

export function UsersManagementPanel() {
  const qc = useQueryClient();
  const { auth, can } = useAuth();

  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("todos");
  const [statusFilter, setStatusFilter] = React.useState<AppUserStatus | "todos">("todos");

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<AppUserWithDetails | null>(null);
  const [formName, setFormName] = React.useState("");
  const [formEmail, setFormEmail] = React.useState("");
  const [formPassword, setFormPassword] = React.useState("");
  const [formStatus, setFormStatus] = React.useState<AppUserStatus>("active");
  const [formRoleIds, setFormRoleIds] = React.useState<string[]>([]);
  const [provisioningNotice, setProvisioningNotice] = React.useState<string | null>(null);

  const [inspectPermissionsUser, setInspectPermissionsUser] =
    React.useState<AppUserWithDetails | null>(null);
  const [inspectLogsUser, setInspectLogsUser] = React.useState<AppUserWithDetails | null>(null);

  const usersQ = useQuery({
    queryKey: usersKeys.list({
      search: search.trim() || undefined,
      roleCode: roleFilter,
      status: statusFilter,
    }),
    queryFn: () =>
      usersService.list({
        search: search.trim() || undefined,
        roleCode: roleFilter,
        status: statusFilter,
      }),
  });

  const rolesQ = useQuery({
    queryKey: rolesKeys.all,
    queryFn: () => rolesService.list(),
  });

  const userLogsQ = useQuery({
    queryKey: usersKeys.auditLogs({ userId: inspectLogsUser?.id, limit: 50 }),
    queryFn: () =>
      usersService.listAuditLogs({
        userId: inspectLogsUser!.id,
        limit: 50,
      }),
    enabled: Boolean(inspectLogsUser?.id),
  });

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormStatus("active");
    const defaultRole = (rolesQ.data ?? []).find((r) => r.code === "atendimento");
    setFormRoleIds(defaultRole ? [defaultRole.id] : []);
    setFormOpen(true);
  };

  const openEditDialog = (u: AppUserWithDetails) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormPassword("");
    setFormStatus(u.status);
    setFormRoleIds(u.roles.map((r) => r.id));
    setFormOpen(true);
  };

  const toggleRoleInForm = (roleId: string, checked: boolean) => {
    setFormRoleIds((prev) =>
      checked ? Array.from(new Set([...prev, roleId])) : prev.filter((id) => id !== roleId),
    );
  };

  const saveUserMutation = useMutation({
    mutationFn: async () => {
      if (editingUser) {
        const updated = await usersService.update(editingUser.id, {
          name: formName.trim(),
          email: formEmail.trim(),
          status: formStatus,
          roleIds: formRoleIds,
        });
        return { user: updated, notice: undefined };
      }

      const created = await usersService.create({
        name: formName.trim(),
        email: formEmail.trim(),
        password: formPassword.trim() || undefined,
        status: formStatus,
        roleIds: formRoleIds,
      });
      return { user: created.user, notice: created.provisioningNotice };
    },
    onSuccess: (res) => {
      toast.success(
        editingUser ? "Usuário atualizado com sucesso." : "Usuário criado com sucesso.",
      );
      if (res.notice) {
        setProvisioningNotice(res.notice);
      }
      void qc.invalidateQueries({ queryKey: usersKeys.all });
      void qc.invalidateQueries({ queryKey: rolesKeys.all });
      setFormOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Não foi possível salvar o usuário.");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: AppUserStatus }) =>
      usersService.setStatus(id, nextStatus),
    onSuccess: (updated) => {
      toast.success(
        updated.status === "active"
          ? `Usuário "${updated.name}" reativado.`
          : `Usuário "${updated.name}" desativado.`,
      );
      void qc.invalidateQueries({ queryKey: usersKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Falha ao alterar status do usuário.");
    },
  });

  const canCreate = can("usuarios.create");
  const canUpdate = can("usuarios.update");
  const canDeactivate = can("usuarios.deactivate");

  return (
    <div className="space-y-4">
      {provisioningNotice && (
        <Alert className="border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <AlertTitle>Informação sobre Provisionamento de Identidade</AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground flex items-center justify-between gap-4">
            <span>{provisioningNotice}</span>
            <Button size="sm" variant="ghost" onClick={() => setProvisioningNotice(null)}>
              Fechar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por perfil" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os perfis</SelectItem>
                {(rolesQ.data ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.code}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as AppUserStatus | "todos")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="invited">Convidado</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {canCreate && (
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Novo usuário
            </Button>
          )}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Perfis</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersQ.isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Carregando usuários…
                </TableCell>
              </TableRow>
            )}

            {!usersQ.isLoading && (usersQ.data ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum usuário encontrado para os filtros informados.
                </TableCell>
              </TableRow>
            )}

            {(usersQ.data ?? []).map((u) => {
              const isSelf = auth.userId === u.id;
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">
                      {u.name}
                      {isSelf && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          Você
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.length === 0 && (
                        <span className="text-xs text-muted-foreground">Sem perfil</span>
                      )}
                      {u.roles.map((r) => (
                        <Badge key={r.id} variant="secondary" className="text-xs font-normal">
                          {r.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[u.status]}>
                      {APP_USER_STATUS_LABEL[u.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.last_login_at ? formatDateTime(u.last_login_at) : "Nunca acessou"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Permissões herdadas"
                        onClick={() => setInspectPermissionsUser(u)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>

                      <Button
                        size="icon"
                        variant="ghost"
                        title="Eventos de auditoria do usuário"
                        onClick={() => setInspectLogsUser(u)}
                      >
                        <History className="h-4 w-4" />
                      </Button>

                      {canUpdate && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Editar usuário"
                          onClick={() => openEditDialog(u)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}

                      {canDeactivate && !isSelf && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title={u.status === "active" ? "Desativar usuário" : "Ativar usuário"}
                          disabled={toggleStatusMutation.isPending}
                          onClick={() =>
                            toggleStatusMutation.mutate({
                              id: u.id,
                              nextStatus: u.status === "active" ? "inactive" : "active",
                            })
                          }
                        >
                          {u.status === "active" ? (
                            <UserX className="h-4 w-4 text-destructive" />
                          ) : (
                            <UserCheck className="h-4 w-4 text-emerald-600" />
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog Criar / Editar Usuário */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Editar usuário" : "Novo usuário"}</DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Atualize os dados cadastrais, status e perfis de acesso atribuídos."
                : "Cadastre um usuário interno e atribua os perfis de acesso correspondentes."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nome do colaborador"
              />
            </div>

            <div className="space-y-1.5">
              <Label>E-mail corporativo *</Label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="colaborador@empresa.com.br"
              />
            </div>

            {!editingUser && (
              <div className="space-y-1.5">
                <Label>Senha inicial (opcional)</Label>
                <Input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Deixe em branco para fluxo de convite / vínculo"
                />
                <p className="text-[11px] text-muted-foreground">
                  Se o usuário já possuir conta no provedor de autenticação com o mesmo e-mail, o
                  vínculo será realizado automaticamente no primeiro login.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Status da conta</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as AppUserStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="invited">Convidado</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                  <SelectItem value="suspended">Suspenso</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Perfis de acesso atribuídos *</Label>
              <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
                {(rolesQ.data ?? [])
                  .filter((r) => r.active || formRoleIds.includes(r.id))
                  .map((r) => {
                    const checked = formRoleIds.includes(r.id);
                    return (
                      <label
                        key={r.id}
                        className="flex items-start gap-2 rounded p-1.5 text-sm hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleRoleInForm(r.id, Boolean(v))}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="font-medium leading-tight">{r.name}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">
                            {r.description || r.code}
                          </div>
                        </div>
                      </label>
                    );
                  })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveUserMutation.mutate()}
              disabled={
                saveUserMutation.isPending ||
                !formName.trim() ||
                !formEmail.trim() ||
                formRoleIds.length === 0
              }
            >
              {saveUserMutation.isPending ? "Salvando…" : "Salvar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Permissões Herdadas */}
      <Dialog
        open={Boolean(inspectPermissionsUser)}
        onOpenChange={(o) => !o && setInspectPermissionsUser(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Permissões Herdadas — {inspectPermissionsUser?.name}
            </DialogTitle>
            <DialogDescription>
              Perfis ativos:{" "}
              {inspectPermissionsUser?.roles.map((r) => r.name).join(", ") || "Nenhum"}. Total de{" "}
              {inspectPermissionsUser?.permissions.length ?? 0} permissão(ões) efetiva(s).
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-1.5 py-2">
            {(inspectPermissionsUser?.permissions ?? []).length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma permissão herdada para este usuário.
              </p>
            )}
            {(inspectPermissionsUser?.permissions ?? []).map((code) => (
              <Badge key={code} variant="outline" className="font-mono text-xs">
                {code}
              </Badge>
            ))}
          </div>

          <DialogFooter>
            <Button onClick={() => setInspectPermissionsUser(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Histórico de Auditoria do Usuário */}
      <Dialog open={Boolean(inspectLogsUser)} onOpenChange={(o) => !o && setInspectLogsUser(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Eventos de Segurança e Acesso — {inspectLogsUser?.name}</DialogTitle>
            <DialogDescription>
              Histórico de logins, alterações cadastrais e atribuições de perfil de{" "}
              {inspectLogsUser?.email}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {userLogsQ.isLoading && (
              <p className="text-center text-xs text-muted-foreground py-4">Carregando eventos…</p>
            )}
            {!userLogsQ.isLoading && (userLogsQ.data ?? []).length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-4">
                Nenhum evento de auditoria encontrado para este usuário.
              </p>
            )}
            {(userLogsQ.data ?? []).map((log) => (
              <div key={log.id} className="rounded-md border border-border p-3 text-xs space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary">
                    {AUTH_AUDIT_EVENT_LABELS[log.event_type as AuthAuditEventType] ??
                      log.event_type}
                  </Badge>
                  <span className="text-muted-foreground">{formatDateTime(log.created_at)}</span>
                </div>
                <p className="text-foreground">{log.description}</p>
                {log.actor && (
                  <p className="text-[11px] text-muted-foreground">
                    Executado por: {log.actor.name} ({log.actor.email})
                  </p>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button onClick={() => setInspectLogsUser(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
