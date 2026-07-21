export const formatBRL = (value: number | string | null | undefined): string => {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
};

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("pt-BR");
};

export const formatDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("pt-BR");
};

export const formatOPNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "string" ? parseInt(value, 10) : value;
  if (isNaN(num)) return "—";
  return `OP-${String(num).padStart(6, "0")}`;
};

