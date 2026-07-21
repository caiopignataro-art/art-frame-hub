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

// Indicadores perenes (Ajuste 7)
export function PreparedIndicator() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/30 text-[10px] text-muted-foreground hover:bg-muted/50 cursor-default transition-colors">
      ○
    </span>
  );
}

export function ProblemIndicator() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-muted-foreground/30 text-[10px] text-muted-foreground hover:bg-muted/50 cursor-default transition-colors">
      ○
    </span>
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

  return (
    <div className="space-y-6">
      {groupedOrders.map((groupedOrder) => (
        <Card key={groupedOrder.pedidoId} className="overflow-hidden border border-border shadow-sm">
          {/* Cabeçalho do Bloco de Pedido (Ajuste 1 - Sem rowspan) */}
          <div className="bg-muted/40 px-4 py-3 border-b flex justify-between items-center">
            <span className="font-semibold text-sm text-foreground">
              Pedido #{groupedOrder.pedidoNumero}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              {groupedOrder.totalItens} item(ns)
            </span>
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
}

export function ProductionTableRow({ row, columns }: ProductionTableRowProps) {
  return (
    <TableRow className="hover:bg-muted/5 transition-colors">
      {columns.map((col) => (
        <ProductionTableCell
          key={col.key}
          columnKey={col.key}
          row={row}
        />
      ))}
    </TableRow>
  );
}

interface ProductionTableCellProps {
  columnKey: ProductionColumnKey;
  row: ProductionRow;
}

export function ProductionTableCell({ columnKey, row }: ProductionTableCellProps) {
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
        return <PreparedIndicator />;
      case "problemas":
        return <ProblemIndicator />;
      default:
        return "";
    }
  }, [columnKey, row]);

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
