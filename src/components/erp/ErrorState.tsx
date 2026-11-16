import { AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = "Não foi possível carregar os dados",
  description = "Ocorreu um erro ao consultar o servidor. Verifique sua conexão e tente novamente.",
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <Alert variant="destructive" className={cn("my-4", className)} role="alert">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">{title}</AlertTitle>
      <AlertDescription className="mt-1 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span>{description}</span>
        {onRetry && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="h-7 shrink-0 text-xs"
          >
            <RefreshCw className="mr-1.5 h-3 w-3" />
            Tentar novamente
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
