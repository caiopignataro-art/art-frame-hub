import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, MapPin, Pencil, Phone, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/erp/PageHeader";
import { PageToolbar } from "@/components/erp/PageToolbar";
import { EmptyState } from "@/components/erp/EmptyState";
import { ErrorState } from "@/components/erp/ErrorState";
import { TableLoadingRows } from "@/components/erp/LoadingState";
import { ClienteFormDialog } from "@/components/erp/ClienteFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clientesService } from "@/lib/services/clientes.service";
import type { Cliente } from "@/types/erp";

export const Route = createFileRoute("/clientes")({
  head: () => ({ meta: [{ title: "Clientes — Art Frame Hub" }] }),
  component: ClientesPage,
});

function ClientesPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["clientes"],
    queryFn: clientesService.list,
  });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);

  const openNovo = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (c: Cliente) => {
    setEditing(c);
    setOpen(true);
  };

  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        (c.whatsapp ?? "").toLowerCase().includes(q) ||
        (c.telefone ?? "").toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.cpf_cnpj ?? "").toLowerCase().includes(q) ||
        (c.endereco ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  return (
    <AppShell title="Clientes">
      <PageHeader
        title="Clientes"
        description="Base cadastral de clientes, contatos para envio de orçamentos via WhatsApp e histórico comercial."
        badge={
          data ? (
            <Badge variant="secondary" className="font-mono text-xs tabular-nums">
              {data.length}
            </Badge>
          ) : undefined
        }
        actions={
          <Button size="sm" onClick={openNovo}>
            <Plus className="h-4 w-4" />
            Novo cliente
          </Button>
        }
      />

      {isError && (
        <ErrorState
          title="Erro ao carregar clientes"
          description="Não foi possível consultar a lista de clientes."
          onRetry={() => void refetch()}
        />
      )}

      <PageToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nome, WhatsApp, CPF/CNPJ ou e-mail…"
        meta={
          <span>
            Exibindo <strong className="text-foreground">{filtered.length}</strong> de{" "}
            {data?.length ?? 0} cliente(s)
          </span>
        }
      />

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Contato / WhatsApp</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>CPF / CNPJ</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableLoadingRows columns={5} rows={6} />}

            {!isLoading &&
              filtered.map((c) => {
                const initials = c.nome
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("");
                const phone = c.whatsapp ?? c.telefone;

                return (
                  <TableRow
                    key={c.id}
                    className="group cursor-pointer"
                    onClick={() => openEdit(c)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted font-mono text-xs font-semibold text-muted-foreground">
                          {initials || "C"}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{c.nome}</div>
                          {c.endereco && (
                            <div className="flex items-center gap-1 truncate text-xs text-muted-foreground max-w-xs">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{c.endereco}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {phone ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {phone}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.email ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate max-w-[220px]">{c.email}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.cpf_cnpj ?? "—"}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(c)}
                        aria-label={`Editar ${c.nome}`}
                        className="h-7 px-2 text-xs"
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}

            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="p-0">
                  <EmptyState
                    icon={Users}
                    title={
                      search
                        ? "Nenhum cliente encontrado para a busca"
                        : "Nenhum cliente cadastrado"
                    }
                    description={
                      search
                        ? "Tente buscar por outro termo ou limpe o filtro de pesquisa."
                        : "Cadastre seu primeiro cliente para agilizar a emissão de orçamentos e pedidos."
                    }
                    action={
                      search ? (
                        <Button size="sm" variant="outline" onClick={() => setSearch("")}>
                          Limpar busca
                        </Button>
                      ) : (
                        <Button size="sm" onClick={openNovo}>
                          <Plus className="h-4 w-4" />
                          Cadastrar cliente
                        </Button>
                      )
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <ClienteFormDialog open={open} onOpenChange={setOpen} cliente={editing} />
    </AppShell>
  );
}
