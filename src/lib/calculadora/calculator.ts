/**
 * Engine de cálculo da Calculadora de Orçamento.
 *
 * Regras (vide docs/calculadora.md):
 *  - largura/altura informadas = tamanho INTERNO da arte
 *  - largura_final = largura_interna + (soma_passe_partout * 2)
 *  - altura_final  = altura_interna  + (soma_passe_partout * 2)
 *  - moldura (m linear) = ((largura_final + altura_final) * 2) / 100
 *  - área de materiais (m²) = (largura_final * altura_final) / 10000
 *  - tudo multiplicado pela quantidade de quadros
 */
import type {
  CalcInput,
  CalcResult,
  MaterialCalculado,
  MaterialOrigem,
} from "./types";
import type { Produto } from "@/types/erp";

const round = (n: number, d = 4) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

function material(
  produto: Produto,
  origem: MaterialOrigem,
  quantidadeUnitaria: number,
  quantidadeQuadros: number,
): MaterialCalculado {
  const qty = round(quantidadeUnitaria * quantidadeQuadros);
  const custo = round(qty * Number(produto.preco_custo));
  const venda = round(qty * Number(produto.preco_venda));
  return {
    produto_id: produto.id,
    codigo: produto.codigo,
    descricao: produto.nome,
    origem,
    unidade: produto.unidade,
    quantidade: qty,
    preco_custo: Number(produto.preco_custo),
    preco_venda: Number(produto.preco_venda),
    custo_total: custo,
    venda_total: venda,
    lucro: round(venda - custo),
  };
}

export function calcular(input: CalcInput): CalcResult {
  const qtd = Math.max(1, Number(input.quantidade) || 1);
  const li = Math.max(0, Number(input.largura_interna_cm) || 0);
  const ai = Math.max(0, Number(input.altura_interna_cm) || 0);

  const somaPp = input.passe_partouts.reduce(
    (s, pp) => s + Math.max(0, Number(pp.medida_cm) || 0),
    0,
  );

  const largFinal = round(li + somaPp * 2, 2);
  const altFinal = round(ai + somaPp * 2, 2);

  const perimetroMl = round(((largFinal + altFinal) * 2) / 100);
  const areaM2 = round((largFinal * altFinal) / 10000);

  const materiais: MaterialCalculado[] = [];

  for (const m of input.molduras) {
    materiais.push(material(m.produto, "perfil_moldura", perimetroMl, qtd));
  }
  for (const pp of input.passe_partouts) {
    materiais.push(material(pp.produto, "passe_partout", areaM2, qtd));
  }
  if (input.protecao) {
    materiais.push(material(input.protecao, "protecao_frontal", areaM2, qtd));
  }
  if (input.fundo) {
    materiais.push(material(input.fundo, "fundo", areaM2, qtd));
  }
  for (const s of input.servicos) {
    materiais.push(material(s, "servico", 1, qtd));
  }

  const total_custo = round(materiais.reduce((s, m) => s + m.custo_total, 0), 2);
  const total_venda = round(materiais.reduce((s, m) => s + m.venda_total, 0), 2);
  const lucro_bruto = round(total_venda - total_custo, 2);
  const margem_pct = total_venda > 0 ? round((lucro_bruto / total_venda) * 100, 2) : 0;

  return {
    quantidade: qtd,
    largura_interna_cm: li,
    altura_interna_cm: ai,
    soma_passe_partout_cm: somaPp,
    largura_final_cm: largFinal,
    altura_final_cm: altFinal,
    perimetro_ml: perimetroMl,
    area_m2: areaM2,
    materiais,
    total_custo,
    total_venda,
    lucro_bruto,
    margem_pct,
  };
}
