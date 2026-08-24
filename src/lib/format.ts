export const formatBRL = (value: number | string | null | undefined): string => {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
};

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return "—";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, y, m, d] = match;
      return `${d}/${m}/${y}`;
    }
  }
  const d = typeof value === "string" ? new Date(value) : value;
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
};

export const formatTelefoneUltimos4Digitos = (telefone: string | null | undefined): string => {
  if (!telefone) return "—";
  const digits = telefone.replace(/\D/g, "");
  if (digits.length < 4) return "—";
  return digits.slice(-4);
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

