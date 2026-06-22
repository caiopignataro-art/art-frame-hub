import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { clientesService } from "@/lib/services/clientes.service";
import type { Cliente } from "@/types/erp";

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  whatsapp: z.string().trim().min(8, "Informe o WhatsApp / celular").max(40),
  telefone: z.string().trim().max(40).optional().or(z.literal("")),
  endereco: z.string().trim().max(300).optional().or(z.literal("")),
  cpf_cnpj: z.string().trim().max(40).optional().or(z.literal("")),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail inválido"),
});

type FormState = z.infer<typeof schema>;

const EMPTY: FormState = {
  nome: "",
  whatsapp: "",
  telefone: "",
  endereco: "",
  cpf_cnpj: "",
  email: "",
};

export function ClienteFormDialog({
  open,
  onOpenChange,
  cliente,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente?: Cliente | null;
  onSaved?: (c: Cliente) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setForm({
        nome: cliente?.nome ?? "",
        whatsapp: cliente?.whatsapp ?? "",
        telefone: cliente?.telefone ?? "",
        endereco: cliente?.endereco ?? "",
        cpf_cnpj: cliente?.cpf_cnpj ?? "",
        email: cliente?.email ?? "",
      });
      setErrors({});
    }
  }, [open, cliente]);

  const mutation = useMutation({
    mutationFn: async (values: FormState) => {
      const payload = {
        nome: values.nome,
        whatsapp: values.whatsapp,
        telefone: values.telefone || values.whatsapp,
        endereco: values.endereco || null,
        cpf_cnpj: values.cpf_cnpj || null,
        email: values.email || null,
      };
      if (cliente?.id) return clientesService.update(cliente.id, payload);
      return clientesService.create(payload);
    },
    onSuccess: (c) => {
      toast.success(cliente ? "Cliente atualizado" : "Cliente cadastrado");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      onSaved?.(c);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao salvar"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path.join(".")] = i.message;
      setErrors(errs);
      return;
    }
    mutation.mutate(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            {cliente
              ? "Altere os dados do cliente. Histórico é registrado automaticamente."
              : "Cadastre um novo cliente. Apenas Nome e WhatsApp são obrigatórios."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Nome *" error={errors.nome}>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <Field label="Celular / WhatsApp *" error={errors.whatsapp}>
            <Input
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="(11) 99999-0000"
            />
          </Field>
          <Field label="Endereço" error={errors.endereco}>
            <Textarea
              rows={2}
              value={form.endereco}
              onChange={(e) => setForm({ ...form, endereco: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="CPF / CNPJ" error={errors.cpf_cnpj}>
              <Input value={form.cpf_cnpj} onChange={(e) => setForm({ ...form, cpf_cnpj: e.target.value })} />
            </Field>
            <Field label="E-mail" error={errors.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {cliente ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
