import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Database, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { authKeys, authService } from "@/lib/services/auth.service";
import { usersKeys, usersService } from "@/lib/services/users.service";
import { AUTH_AUDIT_EVENT_LABELS, type AuthAuditEventType } from "@/types/auth";

const EVENT_TYPES = Object.keys(AUTH_AUDIT_EVENT_LABELS) as AuthAuditEventType[];

export function AuthAuditLogPanel() {
  const [eventTypeFilter, setEventTypeFilter] = React.useState<string>("todos");

  const logsQ = useQuery({
    queryKey: usersKeys.auditLogs({ eventType: eventTypeFilter, limit: 150 }),
    queryFn: () =>
      usersService.listAuditLogs({
        eventType: eventTypeFilter,
        limit: 150,
      }),
  });

  const healthQ = useQuery({
    queryKey: authKeys.health,
    queryFn: () => authService.checkArchitectureHealth(),
  });

  const h = healthQ.data;

  return (
    <div className="space-y-6">
      {/* Diagnóstico Read-Only da Nova Arquitetura (Seção 14.5) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Diagnóstico da Arquitetura Server-Side (Fase A)
            </CardTitle>
            <CardDescription className="text-xs">
              Verificação somente leitura: Frontend → AuthProvider → Service → Server Function →
              Auth Middleware → Database Provider → Repository → Supabase.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void healthQ.refetch()}
            disabled={healthQ.isFetching}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${healthQ.isFetching ? "animate-spin" : ""}`}
            />
            Testar conexão
          </Button>
        </CardHeader>
        <CardContent>
          {h ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              <div className="rounded-md border p-3 space-y-1">
                <div className="text-muted-foreground">Database Provider Ativo</div>
                <div className="font-mono font-semibold text-sm uppercase flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  {h.databaseProvider}
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-1">
                <div className="text-muted-foreground">Comunicação Server → Banco</div>
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  {h.supabaseReachable ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Conectado (Read-Only OK)
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-destructive" />
                      Indisponível
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-1">
                <div className="text-muted-foreground">Tabelas RBAC no Banco</div>
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  {h.rbacTablesMigrated ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Migradas ({h.rolesCount} perfis · {h.permissionsCount} perms)
                    </>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
                      Aguardando aplicação da migration SQL ({h.rolesCount} perfis em catálogo)
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-1">
                <div className="text-muted-foreground">Política de Segurança</div>
                <div className="font-semibold text-sm">
                  {h.authRequired ? "AUTH_REQUIRED=true" : "Modo Desenvolvimento"} ·{" "}
                  {h.hasActiveAdmin ? "Admin ativo" : "Sem Admin ativo"}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Executando verificação arquitetural…</p>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Eventos de Auditoria de Segurança */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">Auditoria de Autenticação e Acessos</h3>
            <p className="text-xs text-muted-foreground">
              Trilha de segurança dedicada (logins, falhas, alterações de usuários, perfis e
              tentativas de acesso negado).
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por evento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os eventos</SelectItem>
                {EVENT_TYPES.map((ev) => (
                  <SelectItem key={ev} value={ev}>
                    {AUTH_AUDIT_EVENT_LABELS[ev]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Usuário Alvo</TableHead>
                <TableHead>Executado Por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsQ.isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Carregando registros de auditoria…
                  </TableCell>
                </TableRow>
              )}
              {!logsQ.isLoading && (logsQ.data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhum evento de auditoria de acesso registrado até o momento.
                  </TableCell>
                </TableRow>
              )}
              {(logsQ.data ?? []).map((log) => {
                const isAlert =
                  log.event_type === "LOGIN_FAILED" || log.event_type === "UNAUTHORIZED_ACCESS";
                return (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isAlert ? "destructive" : "secondary"} className="text-xs">
                        {AUTH_AUDIT_EVENT_LABELS[log.event_type as AuthAuditEventType] ??
                          log.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-md">{log.description}</TableCell>
                    <TableCell className="text-xs">
                      {log.user ? `${log.user.name} (${log.user.email})` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {log.actor ? `${log.actor.name} (${log.actor.email})` : "Sistema / Anônimo"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
