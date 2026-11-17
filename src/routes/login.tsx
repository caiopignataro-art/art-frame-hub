import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Frame,
  KeyRound,
  Loader2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthContextProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { authService } from "@/lib/services/auth.service";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Art Frame Hub (Molduraria ERP)" },
      { name: "description", content: "Acesso autenticado ao sistema Art Frame Hub." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { redirect?: string; expired?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
    expired: typeof search.expired === "string" ? search.expired : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { auth, isLoading: sessionLoading, signIn } = useAuth();
  const { redirect, expired } = Route.useSearch();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Modal de recuperação de senha
  const [resetOpen, setResetOpen] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState("");
  const [resetSending, setResetSending] = React.useState(false);
  const [resetSent, setResetSent] = React.useState(false);

  React.useEffect(() => {
    if (!sessionLoading && auth.isAuthenticated) {
      const target = redirect && redirect !== "/login" ? redirect : "/";
      void navigate({ to: target });
    }
  }, [sessionLoading, auth.isAuthenticated, redirect, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMessage("Preencha o e-mail e a senha para continuar.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await signIn({
        email: trimmedEmail,
        password,
      });

      toast.success(
        res.auth.name ? `Bem-vindo(a), ${res.auth.name}!` : "Autenticação realizada com sucesso.",
      );
      const target = redirect && redirect !== "/login" ? redirect : "/";
      await navigate({ to: target });
    } catch (err) {
      const msg = (err as Error)?.message || "Não foi possível realizar o login.";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = resetEmail.trim() || email.trim();
    if (!targetEmail) {
      toast.error("Informe seu e-mail para receber o link de recuperação.");
      return;
    }

    setResetSending(true);
    try {
      await authService.requestPasswordReset(targetEmail);
      setResetSent(true);
      toast.success("Instruções de recuperação enviadas para o seu e-mail.");
    } catch (err) {
      toast.error((err as Error)?.message || "Falha ao solicitar recuperação de senha.");
    } finally {
      setResetSending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Frame className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">ART FRAME HUB</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Molduraria ERP — Gestão Comercial, Estoque e Produção
          </p>
        </div>

        {expired === "1" && !errorMessage && (
          <Alert variant="default" className="border-amber-500/40 bg-amber-500/5">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700 dark:text-amber-400">Sessão expirada</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground">
              Por segurança, sua sessão foi encerrada. Faça login novamente para continuar.
            </AlertDescription>
          </Alert>
        )}

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Falha na autenticação</AlertTitle>
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        )}

        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold">Acessar sua conta</CardTitle>
            <CardDescription className="text-xs">
              Informe suas credenciais corporativas para acessar o sistema.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-email">E-mail</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu.nome@empresa.com.br"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Senha</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetSent(false);
                      setResetOpen(true);
                    }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Autenticando…
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Entrar
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          O cadastro de novos usuários é restrito aos administradores do sistema.
        </p>
      </div>

      {/* Dialog de Recuperação de Senha */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              Recuperação de senha
            </DialogTitle>
            <DialogDescription>
              Informe o e-mail da sua conta para receber as instruções de redefinição de senha.
            </DialogDescription>
          </DialogHeader>

          {resetSent ? (
            <div className="space-y-4 py-2">
              <Alert className="border-emerald-500/40 bg-emerald-500/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <AlertTitle className="text-emerald-700 dark:text-emerald-400">
                  Solicitação enviada
                </AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground">
                  Se o endereço <strong>{resetEmail || email}</strong> estiver cadastrado, você
                  receberá um link seguro para redefinir sua senha em instantes.
                </AlertDescription>
              </Alert>
              <DialogFooter>
                <Button type="button" onClick={() => setResetOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">E-mail cadastrado</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="seu.nome@empresa.com.br"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  disabled={resetSending}
                  required
                />
              </div>
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetOpen(false)}
                  disabled={resetSending}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={resetSending}>
                  {resetSending ? "Enviando…" : "Enviar instruções"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
