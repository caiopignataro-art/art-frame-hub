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
import type { PedidoItem, PedidoComItens } from "@/types/erp";

// Configuração das Colunas (Refinamento sugerido)
export interface ProductionColumn {
  key: string;
  label: string;
  className?: string;
}

export const productionColumns: ProductionColumn[] = [
  { key: "pedido", label: "Pedido", className: "w-[120px] font-semibold text-muted-foreground" },
  { key: "quantidade", label: "Qtde", className: "w-[80px] text-center" },
  { key: "moldura", label: "Moldura", className: "min-w-[150px]" },
  { key: "medidas", label: "Medidas", className: "w-[120px] text-center" },
  { key: "protecao_frontal", label: "Proteção Frontal", className: "min-w-[140px]" },
  { key: "fundo", label: "Fundo", className: "min-w-[120px]" },
  { key: "passe_partout", label: "Passe-partout", className: "w-[120px] text-center" },
  { key: "mao_de_obra", label: "Mão de Obra", className: "min-w-[140px]" },
  { key: "identificacao", label: "Identificação", className: "min-w-[160px]" },
  { key: "preparado", label: "Preparado", className: "w-[100px] text-center font-mono text-muted-foreground" },
  { key: "problemas", label: "Problemas", className: "w-[100px] text-center font-mono text-muted-foreground" },
];

export interface ProductionTableProps {
  pedidos: PedidoComItens[];
}

interface ProductionRowItem {
  pedidoId: string;
  pedidoNumero: number;
  item: PedidoItem;
  itemIndex: number;
  totalItensNoPedido: number;
  isFirstItemOfPedido: boolean;
}

export function ProductionTable({ pedidos }: ProductionTableProps) {
  // Prepara os dados de forma otimizada antes da renderização
  const rows = React.useMemo(() => {
    const list: ProductionRowItem[] = [];
    pedidos.forEach((p) => {
      const itens = p.itens ?? [];
      itens.forEach((item, index) => {
        list.push({
          pedidoId: p.id,
          pedidoNumero: p.numero_pedido,
          item,
          itemIndex: index,
          totalItensNoPedido: itens.length,
          isFirstItemOfPedido: index === 0,
        });
      });
    });
    return list;
  }, [pedidos]);

  if (rows.length === 0) {
    return (
      <Card className="p-12 text-center border border-dashed border-muted-foreground/30 bg-muted/10">
        <p className="text-sm text-muted-foreground font-medium">
          Nenhum item encontrado nesta Ordem de Produção.
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border border-border">
      <div className="overflow-x-auto">
        <Table className="w-full border-collapse">
          <ProductionTableHeader columns={productionColumns} />
          <TableBody>
            {rows.map((row) => (
              <ProductionTableRow
                key={row.item.id}
                row={row}
                columns={productionColumns}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

interface ProductionTableHeaderProps {
  columns: ProductionColumn[];
}

export function ProductionTableHeader({ columns }: ProductionTableHeaderProps) {
  return (
    <TableHeader className="bg-muted/40">
      <TableRow className="hover:bg-transparent">
        {columns.map((col) => (
          <TableHead
            key={col.key}
            className={col.className}
          >
            {col.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

interface ProductionTableRowProps {
  row: ProductionRowItem;
  columns: ProductionColumn[];
}

export function ProductionTableRow({ row, columns }: ProductionTableRowProps) {
  return (
    <TableRow className="hover:bg-muted/10 transition-colors">
      {columns.map((col) => {
        // Se a coluna for "pedido", aplicamos agrupamento (rowspan)
        if (col.key === "pedido") {
          if (!row.isFirstItemOfPedido) {
            return null; // Não renderiza a célula para evitar repetição
          }
          return (
            <TableCell
              key={col.key}
              rowSpan={row.totalItensNoPedido}
              className="align-middle border-r border-border font-mono text-center bg-muted/5 font-semibold"
            >
              #{row.pedidoNumero}
            </TableCell>
          );
        }

        return (
          <ProductionTableCell
            key={col.key}
            columnKey={col.key}
            item={row.item}
          />
        );
      })}
    </TableRow>
  );
}

interface ProductionTableCellProps {
  columnKey: string;
  item: PedidoItem;
}

export function ProductionTableCell({ columnKey, item }: ProductionTableCellProps) {
  const md = item.metadados as any;

  // Extrai informações dos metadados de forma robusta e otimizada
  const cellValue = React.useMemo(() => {
    switch (columnKey) {
      case "quantidade":
        return Number(item.quantidade);

      case "moldura": {
        const moldurasInput = md?.entrada?.molduras ?? [];
        if (moldurasInput.length > 0) {
          return moldurasInput.map((m: any) => m.codigo || m.descricao).join(" + ");
        }
        return "—";
      }

      case "medidas":
        return `${Number(item.largura_cm)} × ${Number(item.altura_cm)}`;

      case "protecao_frontal":
        return (
          md?.calculo?.materiais?.find((m: any) => m.origem === "protecao_frontal")?.descricao ||
          "—"
        );

      case "fundo":
        return (
          md?.calculo?.materiais?.find((m: any) => m.origem === "fundo")?.descricao ||
          "—"
        );

      case "passe_partout":
        return md?.entrada?.passe_partouts?.length > 0 ? "Sim" : "Não";

      case "mao_de_obra": {
        const servicos = md?.calculo?.materiais
          ?.filter((m: any) => m.origem === "servico")
          ?.map((m: any) => m.descricao);
        if (servicos && servicos.length > 0) {
          return servicos.join(", ");
        }
        return "—";
      }

      case "identificacao":
        return md?.entrada?.observacoes || item.descricao || "—";

      case "preparado":
        return "○"; // Placeholder de status preparado (não interativo)

      case "problemas":
        return "○"; // Placeholder de status de problemas (não interativo)

      default:
        return "";
    }
  }, [columnKey, item, md]);

  const alignClass =
    columnKey === "quantidade" ||
    columnKey === "medidas" ||
    columnKey === "passe_partout" ||
    columnKey === "preparado" ||
    columnKey === "problemas"
      ? "text-center"
      : "";

  return (
    <TableCell className={alignClass}>
      {cellValue}
    </TableCell>
  );
}
