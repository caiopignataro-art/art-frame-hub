import type { ProdutoCategoriaImportacao } from "@/types/erp";

/** Linha normalizada pronta para upsert em `produtos`. */
export type ProdutoImportRow = {
  codigo: string;
  nome: string;
  tipo: ProdutoCategoriaImportacao;
  unidade: string;
  preco_custo: number;
  preco_venda: number;
  estoque: number;
  ativo: boolean;
  fabricante: string | null;
  perfil: string | null;
  acabamento: string | null;
  altura_cm: number | null;
  largura_cm: number | null;
  descricao: string | null;
};

export type ImportIssue = {
  linha: number;
  campo?: string;
  mensagem: string;
  severidade: "erro" | "aviso";
};

export type ParseResult = {
  categoria: ProdutoCategoriaImportacao;
  rows: ProdutoImportRow[];
  issues: ImportIssue[];
  duplicados: string[];
};

// ---------- helpers ----------
const norm = (s: unknown) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function pickKey<T extends Record<string, unknown>>(row: T, aliases: string[]): unknown {
  const map = new Map(Object.keys(row).map((k) => [norm(k), k]));
  for (const a of aliases) {
    const k = map.get(norm(a));
    if (k) return row[k];
  }
  return undefined;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().replace(/\s/g, "").replace(/R\$/i, "");
  // suporta "1.234,56" e "1234.56"
  const normalized = s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(/,/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function toBoolStatus(v: unknown): boolean {
  const s = norm(v);
  if (!s) return true;
  return ["ativo", "ativa", "1", "true", "sim", "s", "yes", "y", "habilitado"].includes(s);
}

// ---------- parsers por categoria ----------

/** Perfil de Moldura — schema obrigatório completo. */
export function parsePerfilMoldura(rawRows: Record<string, unknown>[]): ParseResult {
  const rows: ProdutoImportRow[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  const duplicados: string[] = [];

  rawRows.forEach((raw, idx) => {
    const linha = idx + 2; // header = 1
    const fabricante = String(pickKey(raw, ["Fábrica", "Fabrica", "Fabricante"]) ?? "").trim();
    const codigo = String(pickKey(raw, ["Código", "Codigo", "Cod"]) ?? "").trim();
    const perfil = String(pickKey(raw, ["Perfil", "Modelo"]) ?? "").trim();
    const acabamento = String(pickKey(raw, ["Acabamento", "Cor"]) ?? "").trim();
    const descricao = String(pickKey(raw, ["Descrição", "Descricao"]) ?? "").trim();
    const status = pickKey(raw, ["Status", "Situação", "Situacao"]);
    const altura = toNumber(pickKey(raw, ["Alt(Cm)", "Alt (Cm)", "Altura", "Alt"]));
    const largura = toNumber(pickKey(raw, ["Larg(Cm)", "Larg (Cm)", "Largura", "Larg"]));
    const precoCompra = toNumber(pickKey(raw, ["Preço Compra", "Preco Compra", "Custo"]));
    const precoVenda = toNumber(pickKey(raw, ["Preço Venda", "Preco Venda", "Venda"]));
    const quantidade = toNumber(pickKey(raw, ["Quantidade", "Qtd", "Estoque"]));

    if (!codigo) {
      issues.push({ linha, campo: "Código", mensagem: "Código é obrigatório", severidade: "erro" });
      return;
    }
    if (seen.has(codigo)) {
      duplicados.push(codigo);
      issues.push({ linha, campo: "Código", mensagem: `Código duplicado na planilha: ${codigo}`, severidade: "erro" });
      return;
    }
    seen.add(codigo);

    if (precoCompra === null) issues.push({ linha, campo: "Preço Compra", mensagem: "Valor inválido ou vazio", severidade: "aviso" });
    if (precoVenda === null) issues.push({ linha, campo: "Preço Venda", mensagem: "Valor inválido ou vazio", severidade: "aviso" });
    if (precoVenda !== null && precoCompra !== null && precoVenda < precoCompra) {
      issues.push({ linha, mensagem: "Preço de venda menor que o preço de compra", severidade: "aviso" });
    }
    if (!perfil && !descricao) {
      issues.push({ linha, campo: "Perfil/Descrição", mensagem: "Sem perfil nem descrição — produto sem nome legível", severidade: "aviso" });
    }

    const nome =
      [perfil, acabamento].filter(Boolean).join(" — ") ||
      descricao ||
      `Perfil ${codigo}`;

    rows.push({
      codigo,
      nome,
      tipo: "perfil_moldura",
      unidade: "barra",
      preco_custo: precoCompra ?? 0,
      preco_venda: precoVenda ?? 0,
      estoque: quantidade ?? 0,
      ativo: toBoolStatus(status),
      fabricante: fabricante || null,
      perfil: perfil || null,
      acabamento: acabamento || null,
      altura_cm: altura,
      largura_cm: largura,
      descricao: descricao || null,
    });
  });

  return { categoria: "perfil_moldura", rows, issues, duplicados };
}

/** Schema genérico para Passe-partout, Proteção Frontal, Fundo e Serviços.
 * Colunas mínimas: Código, Descrição, Preço Compra, Preço Venda, Quantidade.
 * Colunas opcionais: Fabricante, Status, Unidade.
 */
export function parseGenerico(
  categoria: Exclude<ProdutoCategoriaImportacao, "perfil_moldura">,
  rawRows: Record<string, unknown>[],
): ParseResult {
  const rows: ProdutoImportRow[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Set<string>();
  const duplicados: string[] = [];

  const unidadePadrao: Record<typeof categoria, string> = {
    passe_partout: "folha",
    protecao_frontal: "folha",
    fundo: "folha",
    servico: "un",
  };

  rawRows.forEach((raw, idx) => {
    const linha = idx + 2;
    const codigo = String(pickKey(raw, ["Código", "Codigo", "Cod"]) ?? "").trim();
    const descricao = String(pickKey(raw, ["Descrição", "Descricao", "Nome"]) ?? "").trim();
    const fabricante = String(pickKey(raw, ["Fábrica", "Fabrica", "Fabricante"]) ?? "").trim();
    const status = pickKey(raw, ["Status", "Situação", "Situacao"]);
    const unidade = String(pickKey(raw, ["Unidade", "Un"]) ?? "").trim() || unidadePadrao[categoria];
    const precoCompra = toNumber(pickKey(raw, ["Preço Compra", "Preco Compra", "Custo"]));
    const precoVenda = toNumber(pickKey(raw, ["Preço Venda", "Preco Venda", "Venda"]));
    const quantidade = toNumber(pickKey(raw, ["Quantidade", "Qtd", "Estoque"]));

    if (!codigo) {
      issues.push({ linha, campo: "Código", mensagem: "Código é obrigatório", severidade: "erro" });
      return;
    }
    if (!descricao) {
      issues.push({ linha, campo: "Descrição", mensagem: "Descrição é obrigatória", severidade: "erro" });
      return;
    }
    if (seen.has(codigo)) {
      duplicados.push(codigo);
      issues.push({ linha, campo: "Código", mensagem: `Código duplicado na planilha: ${codigo}`, severidade: "erro" });
      return;
    }
    seen.add(codigo);

    if (precoVenda === null) issues.push({ linha, campo: "Preço Venda", mensagem: "Valor inválido ou vazio", severidade: "aviso" });

    rows.push({
      codigo,
      nome: descricao,
      tipo: categoria,
      unidade,
      preco_custo: precoCompra ?? 0,
      preco_venda: precoVenda ?? 0,
      estoque: quantidade ?? 0,
      ativo: toBoolStatus(status),
      fabricante: fabricante || null,
      perfil: null,
      acabamento: null,
      altura_cm: null,
      largura_cm: null,
      descricao,
    });
  });

  return { categoria, rows, issues, duplicados };
}

export function parsePlanilha(
  categoria: ProdutoCategoriaImportacao,
  rawRows: Record<string, unknown>[],
): ParseResult {
  if (categoria === "perfil_moldura") return parsePerfilMoldura(rawRows);
  return parseGenerico(categoria, rawRows);
}
