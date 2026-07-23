import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ordemProducaoService,
  type ProductionOperationResult,
  type ProductionConclusionResult,
} from "@/lib/services/ordem-producao.service";
import {
  prepareProductionRows,
  type ProductionRow,
  type OrdemProducaoDetalhadaCompleta,
} from "@/lib/production/prepareProductionRows";

// Tipo fortemente tipado das chaves de coluna (Ajuste 5)
export type ProductionColumnKey =
  | "pedido"
  | "quantidade"
  | "moldura"
  | "medidas"
  | "protecao_frontal"
  | "fundo"
  | "passe_partout"
  | "mao_de_obra"
  | "identificacao"
  | "preparado"
  | "problemas";

// Interface evoluída das colunas (Ajuste 6 & Refinamento 8)
export interface ProductionColumn {
  key: ProductionColumnKey;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  visible?: boolean;
  printable?: boolean;
  sortable?: boolean;
  exportable?: boolean;
  className?: string;
}

// Configurações das colunas
export const productionColumns: ProductionColumn[] = [
  { key: "pedido", label: "Pedido", visible: false, exportable: true, printable: true },
  { key: "quantidade", label: "Qtde", align: "center", className: "w-[80px] text-center", exportable: true, printable: true },
  { key: "moldura", label: "Moldura", className: "min-w-[150px]", exportable: true, printable: true },
  { key: "medidas", label: "Medidas", align: "center", className: "w-[120px] text-center", exportable: true, printable: true },
  { key: "protecao_frontal", label: "Proteção Frontal", className: "min-w-[140px]", exportable: true, printable: true },
  { key: "fundo", label: "Fundo", className: "min-w-[120px]", exportable: true, printable: true },
  { key: "passe_partout", label: "Passe-partout", align: "center", className: "w-[120px] text-center", exportable: true, printable: true },
  { key: "mao_de_obra", label: "Mão de Obra", className: "min-w-[140px]", exportable: true, printable: true },
  { key: "identificacao", label: "Identificação", className: "min-w-[160px]", exportable: true, printable: true },
  { key: "preparado", label: "Preparado", align: "center", className: "w-[100px] text-center font-mono", exportable: false, printable: true },
  { key: "problemas", label: "Problemas", align: "center", className: "w-[100px] text-center font-mono", exportable: false, printable: true },
];

// Componente para exibir o status do Pedido (P-008 Badge)
export function PedidoStatusBadge({
  pronto,
  concluido
}: {
  pronto: boolean;
  concluido: boolean;
}) {
  if (concluido) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 border border-green-200">
        ✔ Concluído
      </span>
    );
  }
  if (pronto) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200 animate-pulse">
        ✅ Pronto para concluir
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
      ⏳ Em preparação
    </span>
  );
}

// Botão com modal de confirmação para conclusão do pedido (P-008)
export function ConcluirPedidoButton({
  pedidoId,
  opId,
  disabled
}: {
  pedidoId: string;
  opId: string;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const queryKey = ["ordem_producao", opId];
  const [isOpen, setIsOpen] = React.useState(false);

  const mutation = useMutation({
    mutationFn: () => ordemProducaoService.concluirPedidoProducao(pedidoId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey });
      const previousOpData = qc.getQueryData(queryKey);

      qc.setQueryData(queryKey, (prev: any) => {
        if (!prev || !prev.pedidos) return prev;
        return {
          ...prev,
          pedidos: prev.pedidos.map((p: any) =>
            p.id === pedidoId
              ? {
                  ...p,
                  status: "pronto",
                  pedido_concluido: true,
                }
              : p
          ),
        };
      });

      return { previousOpData };
    },
    onError: (err: any, variables, context) => {
      if (context?.previousOpData) {
        qc.setQueryData(queryKey, context.previousOpData);
      }
      toast.error(err.message || "Erro ao concluir pedido.");
    },
    onSuccess: (result: ProductionConclusionResult) => {
      qc.setQueryData(queryKey, (prev: any) => {
        if (!prev) return prev;

        const updatedPedidos = prev.pedidos.map((p: any) => {
          if (p.id === pedidoId) {
            return {
              ...p,
              status: "pronto",
              pedido_concluido: true,
            };
          }
          return p;
        });

        const updatedOp = {
          ...prev.op,
          status: result.ordemProducao.concluida ? "Concluída" : prev.op.status,
          concluido_em: result.ordemProducao.concluida ? new Date().toISOString() : prev.op.concluido_em,
        };

        return {
          ...prev,
          op: updatedOp,
          pedidos: updatedPedidos,
        };
      });
      toast.success("Pedido concluído com sucesso!");
      setIsOpen(false);
    },
  });

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="border-green-600 text-green-700 hover:bg-green-50 h-7 text-xs py-1 px-2"
        disabled={disabled || mutation.isPending}
        onClick={() => setIsOpen(true)}
      >
        Concluir Pedido
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Concluir Pedido?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Após concluir este pedido ele será removido da fila de produção.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Concluindo..." : "Concluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Componente interativo para a preparação do item (P-007)
export function PreparedItemControl({
  itemId,
  preparado,
  opId,
  disabled
}: {
  itemId: string;
  preparado: boolean;
  opId: string;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const queryKey = ["ordem_producao", opId];

  const mutation = useMutation({
    mutationFn: (newVal: boolean) => ordemProducaoService.marcarItemPreparado(itemId, newVal),
    onMutate: async (newVal) => {
      await qc.cancelQueries({ queryKey });
      const previousOpData = qc.getQueryData(queryKey);

      qc.setQueryData(queryKey, (prev: any) => {
        if (!prev || !prev.opItens) return prev;
        return {
          ...prev,
          opItens: prev.opItens.map((oi: any) =>
            oi.id === itemId
              ? {
                  ...oi,
                  preparado: newVal,
                  possui_problema: newVal ? false : oi.possui_problema,
                  problema_tipo: newVal ? null : oi.problema_tipo,
                  problema_descricao: newVal ? null : oi.problema_descricao,
                }
              : oi
          ),
        };
      });

      return { previousOpData };
    },
    onError: (err: any, newVal, context) => {
      if (context?.previousOpData) {
        qc.setQueryData(queryKey, context.previousOpData);
      }
      toast.error(err.message || "Erro ao atualizar item.");
    },
    onSuccess: (result: ProductionOperationResult) => {
      qc.setQueryData(queryKey, (prev: any) => {
        if (!prev || !prev.opItens) return prev;
        return {
          ...prev,
          opItens: prev.opItens.map((oi: any) =>
            oi.id === itemId ? { ...oi, ...result.item } : oi
          ),
        };
      });
    },
  });

  const isPending = mutation.isPending;
  const isError = mutation.isError;

  if (isPending) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center animate-spin text-muted-foreground font-mono text-[10px]">
        ◌
      </span>
    );
  }

  if (isError) {
    return (
      <button
        onClick={() => mutation.mutate(!preparado)}
        disabled={disabled}
        title="Erro ao atualizar. Clique para tentar novamente."
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-destructive text-[10px] text-destructive hover:bg-destructive/10 transition-colors"
      >
        ⚠
      </button>
    );
  }

  return (
    <button
      onClick={() => mutation.mutate(!preparado)}
      disabled={disabled}
      className={`inline-flex h-5 w-5 items-center justify-center rounded border transition-colors ${
        preparado
          ? "border-green-600 bg-green-600 text-white"
          : "border-muted-foreground/30 text-transparent hover:border-muted-foreground/60"
      }`}
    >
      {preparado ? "✔" : " "}
    </button>
  );
}

// Componente interativo para gerenciamento de problemas do item (P-007-A)
export function ProblemItemControl({
  itemId,
  possuiProblema,
  problemaTipo,
  problemaDescricao,
  opId,
  disabled
}: {
  itemId: string;
  possuiProblema: boolean;
  problemaTipo: string | null;
  problemaDescricao: string | null;
  opId: string;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const queryKey = ["ordem_producao", opId];
  const [isOpen, setIsOpen] = React.useState(false);
  const [tipo, setTipo] = React.useState(problemaTipo || "MATERIAL_FALTANTE");
  const [descricao, setDescricao] = React.useState(problemaDescricao || "");

  React.useEffect(() => {
    if (isOpen) {
      setTipo(problemaTipo || "MATERIAL_FALTANTE");
      setDescricao(problemaDescricao || "");
    }
  }, [isOpen, problemaTipo, problemaDescricao]);

  const mutation = useMutation({
    mutationFn: (params: { possui_problema: boolean; tipo?: string; descricao?: string }) =>
      ordemProducaoService.registrarProblemaItem(itemId, params),
    onMutate: async (params) => {
      await qc.cancelQueries({ queryKey });
      const previousOpData = qc.getQueryData(queryKey);

      qc.setQueryData(queryKey, (prev: any) => {
        if (!prev || !prev.opItens) return prev;
        return {
          ...prev,
          opItens: prev.opItens.map((oi: any) =>
            oi.id === itemId
              ? {
                  ...oi,
                  possui_problema: params.possui_problema,
                  problema_tipo: params.tipo || null,
                  problema_descricao: params.descricao || null,
                  preparado: false,
                  preparado_em: null,
                  preparado_por: null,
                }
              : oi
          ),
        };
      });

      return { previousOpData };
    },
    onError: (err: any, params, context) => {
      if (context?.previousOpData) {
        qc.setQueryData(queryKey, context.previousOpData);
      }
      toast.error(err.message || "Erro ao atualizar problema.");
    },
    onSuccess: (result: ProductionOperationResult) => {
      qc.setQueryData(queryKey, (prev: any) => {
        if (!prev || !prev.opItens) return prev;
        return {
          ...prev,
          opItens: prev.opItens.map((oi: any) =>
            oi.id === itemId ? { ...oi, ...result.item } : oi
          ),
        };
      });
      setIsOpen(false);
    },
  });

  const isPending = mutation.isPending;
  const isError = mutation.isError;

  const handleSave = () => {
    mutation.mutate({
      possui_problema: true,
      tipo,
      descricao
    });
  };

  const handleRemove = () => {
    mutation.mutate({
      possui_problema: false
    });
  };

  if (isPending) {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center animate-spin text-muted-foreground font-mono text-[10px]">
        ◌
      </span>
    );
  }

  if (isError) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-destructive text-[10px] text-destructive hover:bg-destructive/10 transition-colors"
      >
        ⚠
      </button>
    );
  }

  const indicator = possuiProblema
    ? (problemaDescricao ? "✎" : "⚠")
    : "○";

  const btnClass = possuiProblema
    ? (problemaDescricao
        ? "border-amber-500 bg-amber-50 text-amber-600 hover:bg-amber-100/50"
        : "border-destructive bg-destructive/5 text-destructive hover:bg-destructive/10")
    : "border-muted-foreground/30 text-muted-foreground/60 hover:border-muted-foreground/60 hover:text-muted-foreground";

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-colors font-medium ${btnClass}`}
      >
        {indicator}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {possuiProblema ? "Detalhes do Problema" : "Registrar Problema"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="tipo-problema">Tipo de Problema</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger id="tipo-problema">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MATERIAL_FALTANTE">Material Faltante</SelectItem>
                  <SelectItem value="MEDIDA_INCORRETA">Medida Incorreta</SelectItem>
                  <SelectItem value="MOLDURA_DANIFICADA">Moldura Danificada</SelectItem>
                  <SelectItem value="VIDRO_DANIFICADO">Vidro Danificado</SelectItem>
                  <SelectItem value="PASSE_PARTOUT_DANIFICADO">Passe-partout Danificado</SelectItem>
                  <SelectItem value="IMPRESSAO_INCORRETA">Impressão Incorreta</SelectItem>
                  <SelectItem value="OUTRO">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="descricao-problema">Descrição (Opcional)</Label>
              <Textarea
                id="descricao-problema"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Detalhes sobre o problema encontrado..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex sm:justify-between gap-2">
            {possuiProblema && (
              <Button type="button" variant="destructive" onClick={handleRemove} disabled={mutation.isPending}>
                Remover Problema
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={mutation.isPending}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave} disabled={mutation.isPending}>
                Salvar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export interface ProductionTableProps {
  ordemData: OrdemProducaoDetalhadaCompleta;
}

export function ProductionTable({ ordemData }: ProductionTableProps) {
  // Prepara os dados uma única vez utilizando useMemo (Performance e Ajuste 3)
  const groupedOrders = React.useMemo(() => {
    return prepareProductionRows(ordemData);
  }, [ordemData]);

  // Filtra as colunas visíveis para a exibição na tabela interativa
  const visibleColumns = React.useMemo(() => {
    return productionColumns.filter((col) => col.visible !== false);
  }, []);

  if (groupedOrders.length === 0) {
    return (
      <Card className="p-12 text-center border border-dashed border-muted-foreground/30 bg-muted/10">
        <p className="text-sm text-muted-foreground font-medium">
          Nenhum item encontrado nesta Ordem de Produção.
        </p>
      </Card>
    );
  }

  // OP status validation: disable controls if archived or concluded
  const isReadOnly =
    ordemData.op.status === "Concluída" || ordemData.op.status === "Arquivada";

  return (
    <div className="space-y-6">
      {groupedOrders.map((groupedOrder) => (
        <Card key={groupedOrder.pedidoId} className="overflow-hidden border border-border shadow-sm">
          {/* Cabeçalho do Bloco de Pedido (Ajuste 1 - Sem rowspan) */}
          <div className="bg-muted/40 px-4 py-3 border-b flex justify-between items-center">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-sm text-foreground">
                Pedido #{groupedOrder.pedidoNumero}
              </span>
              <PedidoStatusBadge
                pronto={groupedOrder.pedidoPronto}
                concluido={groupedOrder.pedidoConcluido}
              />
            </div>
            <div className="flex items-center gap-3">
              {groupedOrder.pedidoPronto && !groupedOrder.pedidoConcluido && (
                <ConcluirPedidoButton
                  pedidoId={groupedOrder.pedidoId}
                  opId={ordemData.op.id}
                  disabled={isReadOnly}
                />
              )}
              <span className="text-xs text-muted-foreground font-medium">
                {groupedOrder.totalItens} item(ns)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="w-full border-collapse">
              <ProductionTableHeader columns={visibleColumns} />
              <TableBody>
                {groupedOrder.itens.map((row) => (
                  <ProductionTableRow
                    key={row.itemId}
                    row={row}
                    columns={visibleColumns}
                    opId={ordemData.op.id}
                    disabled={isReadOnly || groupedOrder.pedidoConcluido}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      ))}
    </div>
  );
}

interface ProductionTableHeaderProps {
  columns: ProductionColumn[];
}

export function ProductionTableHeader({ columns }: ProductionTableHeaderProps) {
  return (
    <TableHeader className="bg-muted/20">
      <TableRow className="hover:bg-transparent">
        {columns.map((col) => (
          <TableHead key={col.key} className={col.className}>
            {col.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

interface ProductionTableRowProps {
  row: ProductionRow;
  columns: ProductionColumn[];
  opId: string;
  disabled?: boolean;
}

export function ProductionTableRow({ row, columns, opId, disabled }: ProductionTableRowProps) {
  return (
    <TableRow className="hover:bg-muted/5 transition-colors">
      {columns.map((col) => (
        <ProductionTableCell
          key={col.key}
          columnKey={col.key}
          row={row}
          opId={opId}
          disabled={disabled}
        />
      ))}
    </TableRow>
  );
}

interface ProductionTableCellProps {
  columnKey: ProductionColumnKey;
  row: ProductionRow;
  opId: string;
  disabled?: boolean;
}

export function ProductionTableCell({ columnKey, row, opId, disabled }: ProductionTableCellProps) {
  // Apenas renderiza dados preparados (Ajuste 4)
  const cellValue = React.useMemo(() => {
    switch (columnKey) {
      case "quantidade":
        return row.quantidade;
      case "moldura":
        return row.moldura;
      case "medidas":
        return row.medidas;
      case "protecao_frontal":
        return row.protecaoFrontal;
      case "fundo":
        return row.fundo;
      case "passe_partout":
        return row.passePartout;
      case "mao_de_obra":
        return row.maoDeObra;
      case "identificacao":
        return row.identificacao;
      case "preparado":
        return (
          <PreparedItemControl
            itemId={row.itemId}
            preparado={row.preparado}
            opId={opId}
            disabled={disabled}
          />
        );
      case "problemas":
        return (
          <ProblemItemControl
            itemId={row.itemId}
            possuiProblema={row.possuiProblema}
            problemaTipo={row.problemaTipo}
            problemaDescricao={row.problemaDescricao}
            opId={opId}
            disabled={disabled}
          />
        );
      default:
        return "";
    }
  }, [columnKey, row, opId, disabled]);

  const alignClass =
    columnKey === "quantidade" ||
    columnKey === "medidas" ||
    columnKey === "passe_partout" ||
    columnKey === "preparado" ||
    columnKey === "problemas"
      ? "text-center"
      : "";

  return <TableCell className={alignClass}>{cellValue}</TableCell>;
}
