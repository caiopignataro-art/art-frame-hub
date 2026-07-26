import * as React from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProductionErrorAlertProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

export function ProductionErrorAlert({
  title = "Erro ao carregar dados",
  description = "Não foi possível carregar as informações da produção.",
  onRetry,
}: ProductionErrorAlertProps) {
  return (
    <Alert variant="destructive" className="mb-6" role="alert">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-4 mt-1">
        <span className="text-xs md:text-sm">{description}</span>
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="border-destructive-foreground text-destructive-foreground hover:bg-destructive/10 shrink-0 text-xs h-8"
          >
            Tentar novamente
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
