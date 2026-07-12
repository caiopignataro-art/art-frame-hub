import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { clientesService } from "@/lib/services/clientes.service";
import { ClienteFormDialog } from "@/components/erp/ClienteFormDialog";
import type { Cliente } from "@/types/erp";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Molduraria ERP" }] }),
  component: ClientesPage,
});

function ClientesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["clientes"], queryFn: clientesService.list });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);

  const openNovo = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: Cliente) => { setEditing(c); setOpen(true); };

  return (
    <AppShell title="Clientes">
      <PageHeader
        title="Clientes"
        description="Cadastro de clientes."
        actions={
          <Button onClick={openNovo}>
            <Plus className="mr-2 h-4 w-4" /> Novo cliente
          </Button>
        }
      />
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>CPF/CNPJ</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {data?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{c.whatsapp ?? c.telefone ?? "—"}</TableCell>
                <TableCell>{c.email ?? "—"}</TableCell>
                <TableCell>{c.cpf_cnpj ?? "—"}</TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)} aria-label="Editar cliente">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {data?.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum cliente cadastrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <ClienteFormDialog open={open} onOpenChange={setOpen} cliente={editing} />
    </AppShell>
  );
}
