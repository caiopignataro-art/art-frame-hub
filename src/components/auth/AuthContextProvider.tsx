import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { ShieldAlert, ShieldCheck, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  canAccessModule,
  canAccessPathname,
  canExecute,
  canExecuteAny,
} from "@/lib/auth/permission.guard";
import type { SignInResponse } from "@/lib/server/functions/auth.functions";
import { authKeys, authService } from "@/lib/services/auth.service";
import type { AppUserWithDetails, AuthContext, SignInInput } from "@/types/auth";
import type { PermissionCode, PermissionModule } from "@/types/permissions";

const ANONYMOUS_AUTH_CONTEXT: AuthContext = {
  userId: null,
  providerSubject: null,
  email: null,
  name: null,
  status: null,
  isAuthenticated: false,
  isActive: false,
  roles: [],
  permissions: [],
  ipAddress: null,
  userAgent: null,
};

export interface AuthContextValue {
  auth: AuthContext;
  user: AppUserWithDetails | null;
  isLoading: boolean;
  authRequired: boolean;
  hasActiveAdmin: boolean;
  can: (permission: PermissionCode) => boolean;
  canAny: (permissions: readonly PermissionCode[]) => boolean;
  canModule: (module: PermissionModule) => boolean;
  canPath: (pathname: string) => boolean;
  signIn: (input: SignInInput) => Promise<SignInResponse>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthReactContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: authKeys.session,
    queryFn: () => authService.getSessionStatus(),
    staleTime: 30_000,
    retry: false,
  });

  const auth = sessionQuery.data?.auth ?? ANONYMOUS_AUTH_CONTEXT;
  const user = sessionQuery.data?.user ?? null;
  const authRequired = sessionQuery.data?.authRequired ?? true;
  const hasActiveAdmin = sessionQuery.data?.hasActiveAdmin ?? true;

  // Renovação preventiva de sessão a cada 10 minutos quando autenticado
  React.useEffect(() => {
    if (!auth.isAuthenticated) return;
    const timer = window.setInterval(
      () => {
        void authService.refreshSession().then(() => {
          void qc.invalidateQueries({ queryKey: authKeys.session });
        });
      },
      10 * 60 * 1000,
    );
    return () => window.clearInterval(timer);
  }, [auth.isAuthenticated, qc]);

  const signIn = React.useCallback(
    async (input: SignInInput): Promise<SignInResponse> => {
      const res = await authService.signInWithContext(input);
      await qc.invalidateQueries({ queryKey: authKeys.session });
      return res;
    },
    [qc],
  );

  const signOut = React.useCallback(async () => {
    await authService.signOut();
    qc.clear();
    await qc.invalidateQueries({ queryKey: authKeys.session });
  }, [qc]);

  const refresh = React.useCallback(async () => {
    await qc.invalidateQueries({ queryKey: authKeys.session });
  }, [qc]);

  const can = React.useCallback(
    (permission: PermissionCode): boolean => {
      if (sessionQuery.isLoading) return false;
      if (!authRequired && !auth.isAuthenticated) return true;
      return canExecute(auth, permission);
    },
    [auth, authRequired, sessionQuery.isLoading],
  );

  const canAny = React.useCallback(
    (permissions: readonly PermissionCode[]): boolean => {
      if (sessionQuery.isLoading) return false;
      if (!authRequired && !auth.isAuthenticated) return true;
      return canExecuteAny(auth, permissions);
    },
    [auth, authRequired, sessionQuery.isLoading],
  );

  const canModule = React.useCallback(
    (module: PermissionModule): boolean => {
      if (sessionQuery.isLoading) return false;
      if (!authRequired && !auth.isAuthenticated) return true;
      return canAccessModule(auth, module);
    },
    [auth, authRequired, sessionQuery.isLoading],
  );

  const canPath = React.useCallback(
    (pathname: string): boolean => {
      if (pathname === "/login") return true;
      if (sessionQuery.isLoading) return false;
      if (!authRequired && !auth.isAuthenticated) return true;
      return canAccessPathname(auth, pathname);
    },
    [auth, authRequired, sessionQuery.isLoading],
  );

  const value = React.useMemo<AuthContextValue>(
    () => ({
      auth,
      user,
      isLoading: sessionQuery.isLoading,
      authRequired,
      hasActiveAdmin,
      can,
      canAny,
      canModule,
      canPath,
      signIn,
      signOut,
      refresh,
    }),
    [
      auth,
      user,
      sessionQuery.isLoading,
      authRequired,
      hasActiveAdmin,
      can,
      canAny,
      canModule,
      canPath,
      signIn,
      signOut,
      refresh,
    ],
  );

  return <AuthReactContext.Provider value={value}>{children}</AuthReactContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthReactContext);
  if (!ctx) {
    throw new Error("useAuth deve ser utilizado dentro de um <AuthProvider>.");
  }
  return ctx;
}

/**
 * Componente utilitário para exibir elementos na interface apenas quando o usuário
 * possui a permissão exigida.
 */
export function PermissionGate({
  permission,
  anyOf,
  fallback = null,
  children,
}: {
  permission?: PermissionCode;
  anyOf?: readonly PermissionCode[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { can, canAny } = useAuth();
  if (permission && !can(permission)) return <>{fallback}</>;
  if (anyOf && !canAny(anyOf)) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Guarda de proteção de rotas internas no cliente (complementando a validação obrigatória no servidor).
 */
export function RouteAccessGuard({ children }: { children: React.ReactNode }) {
  const { auth, isLoading, authRequired, hasActiveAdmin, canPath, signOut, refresh } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const [bootstrapName, setBootstrapName] = React.useState(auth.name ?? "Administrador");
  const [bootstrapSecret, setBootstrapSecret] = React.useState("");
  const [provisioning, setProvisioning] = React.useState(false);

  React.useEffect(() => {
    if (auth.name) setBootstrapName(auth.name);
  }, [auth.name]);

  React.useEffect(() => {
    if (isLoading) return;
    if (pathname === "/login") return;

    if (authRequired && !auth.isAuthenticated) {
      void navigate({
        to: "/login",
        search: { redirect: pathname, expired: undefined },
      });
    }
  }, [isLoading, pathname, authRequired, auth.isAuthenticated, navigate]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Verificando credenciais e permissões de acesso…</p>
      </div>
    );
  }

  if (authRequired && !auth.isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm">Redirecionando para autenticação…</p>
      </div>
    );
  }

  // Caso o usuário esteja autenticado no provedor mas ainda não exista administrador ativo no banco
  if (auth.isAuthenticated && !auth.isActive && !hasActiveAdmin) {
    const handleProvisionFirstAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!bootstrapName.trim() || bootstrapName.trim().length < 2) {
        toast.error("Informe seu nome para concluir o provisionamento.");
        return;
      }
      if (!bootstrapSecret.trim() || bootstrapSecret.trim().length < 16) {
        toast.error("Informe o segredo de inicialização (mínimo 16 caracteres).");
        return;
      }
      setProvisioning(true);
      try {
        await authService.provisionFirstAdmin({
          name: bootstrapName.trim(),
          bootstrapSecret: bootstrapSecret.trim(),
        });
        toast.success("Primeiro administrador provisionado com sucesso!");
        setBootstrapSecret("");
        await refresh();
      } catch (err) {
        toast.error((err as Error).message || "Não foi possível provisionar o administrador.");
      } finally {
        setProvisioning(false);
      }
    };

    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center py-12">
        <Card className="border-primary/30 shadow-md">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle>Provisionamento Controlado do Primeiro Administrador</CardTitle>
            <CardDescription>
              Sua identidade (<strong>{auth.email}</strong>) foi autenticada e o sistema ainda não
              possui nenhum administrador ativo em <code>app_users</code>. Informe seu nome e o
              segredo de uso único configurado no servidor (
              <code>FIRST_ADMIN_BOOTSTRAP_SECRET</code>) ou execute{" "}
              <code>public.bootstrap_first_admin(...)</code> diretamente via SQL.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProvisionFirstAdmin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="first-admin-name">Seu nome completo</Label>
                <Input
                  id="first-admin-name"
                  value={bootstrapName}
                  onChange={(e) => setBootstrapName(e.target.value)}
                  placeholder="Ex.: Administrador Geral"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="first-admin-secret">Segredo de inicialização (uso único)</Label>
                <Input
                  id="first-admin-secret"
                  type="password"
                  autoComplete="off"
                  value={bootstrapSecret}
                  onChange={(e) => setBootstrapSecret(e.target.value)}
                  placeholder="Valor de FIRST_ADMIN_BOOTSTRAP_SECRET no servidor"
                  minLength={16}
                  required
                />
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => void signOut()}>
                  <LogOut className="mr-1.5 h-4 w-4" /> Sair
                </Button>
                <Button type="submit" disabled={provisioning}>
                  {provisioning ? "Ativando perfil…" : "Ativar como Primeiro Administrador"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Usuário autenticado, porém ainda não vinculado ou sem perfil ativo quando já existe admin
  if (auth.isAuthenticated && !auth.isActive) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center py-12">
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <CardTitle>Conta Aguardando Liberação</CardTitle>
            <CardDescription>
              Você está autenticado como <strong>{auth.email}</strong>, mas seu usuário ainda não
              possui vínculo ativo ou perfil atribuído no cadastro interno do Art Frame Hub.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between">
            <Button variant="outline" onClick={() => void refresh()}>
              Verificar novamente
            </Button>
            <Button variant="destructive" onClick={() => void signOut()}>
              Encerrar sessão
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!canPath(pathname)) {
    return (
      <div className="mx-auto flex max-w-lg flex-col justify-center py-12">
        <Card className="border-destructive/40">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Seu perfil atual não possui permissão para visualizar este módulo (
              <code>{pathname}</code>). Solicite a permissão correspondente ao administrador do
              sistema.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => void navigate({ to: "/" })}>
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
