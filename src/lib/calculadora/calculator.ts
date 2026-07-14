/**
 * Engine de cálculo da Calculadora de Orçamento.
 *
 * Duas regras independentes para a moldura:
 *  1. Comercial (preço): usa apenas a abertura do quadro, com mínimo de 1m linear.
 *  2. Produção/estoque: usa a abertura + 2× largura do perfil para gerar peças
 *     e distribuição de barras (FFD — First Fit Decreasing).
 *
 * Demais materiais (vidro/fundo/passe-partout) usam a área da abertura (m²).
 */
import type {
  CalcInput,
  CalcResult,
  MaterialCalculado,
  MaterialOrigem,
  MolduraDetalhe,
  BarraDistribuicao,
  PassePartoutDetalhe,
  PasseOrdem,
} from "./types";
import type { Produto } from "@/types/erp";

const round = (n: number, d = 4) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

const ORDEM_RANK: Record<PasseOrdem, number> = { interno: 0, meio: 1, externo: 2 };

function materialDePreco(
  produto: Produto,
  origem: MaterialOrigem,
  quantidadeUnitaria: number,
  quadros: number,
): MaterialCalculado {
  const qty = round(quantidadeUnitaria * quadros);
  return {
    produto_id: produto.id,
    codigo: produto.codigo,
    descricao: produto.nome,
    origem,
    unidade: produto.unidade,
    quantidade: qty,
    preco_venda: Number(produto.preco_venda),
    valor_total: round(qty * Number(produto.preco_venda), 2),
  };
}

/** First Fit Decreasing: distribui peças em barras minimizando o número de barras. */
function packBarras(pecasOriginais: number[], barraCm: number): {
  barras: BarraDistribuicao[];
  excede: boolean;
} {
  const pecas = [...pecasOriginais].sort((a, b) => b - a);
  let excede = false;
  const barras: BarraDistribuicao[] = [];

  for (const p of pecas) {
    if (p > barraCm) {
      excede = true;
      // ainda registra em uma barra dedicada para visibilidade
      barras.push({ pecas: [p], retalho_cm: 0 });
      continue;
    }
    // procura a barra com MENOR retalho que ainda comporte (best-fit decreasing)
    let melhor = -1;
    let melhorSobra = Infinity;
    for (let i = 0; i < barras.length; i++) {
      const sobra = barras[i].retalho_cm - p;
      if (sobra >= 0 && sobra < melhorSobra) {
        melhor = i;
        melhorSobra = sobra;
      }
    }
    if (melhor >= 0) {
      barras[melhor].pecas.push(p);
      barras[melhor].retalho_cm = round(melhorSobra, 2);
    } else {
      barras.push({ pecas: [p], retalho_cm: round(barraCm - p, 2) });
    }
  }

  return { barras, excede };
}

export function calcular(input: CalcInput): CalcResult {
  const qtd = Math.max(1, Number(input.quantidade) || 1);
  const la = Math.max(0, Number(input.largura_interna_cm) || 0);
  const aa = Math.max(0, Number(input.altura_interna_cm) || 0);
  const barraCm = Math.max(1, Number(input.barra_cm) || 270);

  // ----- Passe-partouts (ordenados) -----
  const passesValidos = input.passe_partouts.filter((pp) => pp.produto);
  const passesOrdenados = [...passesValidos].sort((a, b) => {
    if (passesValidos.length <= 1) return 0;
    const ra = a.ordem ? ORDEM_RANK[a.ordem] : 99;
    const rb = b.ordem ? ORDEM_RANK[b.ordem] : 99;
    return ra - rb;
  });

  const somaPp = passesOrdenados.reduce(
    (s, pp) => s + Math.max(0, Number(pp.medida_cm) || 0),
    0,
  );

  const aberturaL = round(la + somaPp * 2, 2);
  const aberturaA = round(aa + somaPp * 2, 2);
  const areaM2 = round((aberturaL * aberturaA) / 10000);

  // Acumulado por PP
  let acL = la;
  let acA = aa;
  const passe_partouts: PassePartoutDetalhe[] = passesOrdenados.map((pp) => {
    const medCm = Math.max(0, Number(pp.medida_cm) || 0);
    acL = round(acL + medCm * 2, 2);
    acA = round(acA + medCm * 2, 2);
    return {
      produto_id: pp.produto.id,
      codigo: pp.produto.codigo,
      descricao: pp.produto.nome,
      medida_cm: medCm,
      ordem: pp.ordem ?? null,
      apos_largura_cm: acL,
      apos_altura_cm: acA,
    };
  });

  const passe_partout_excede_chapa = aberturaL > 100 || aberturaA > 80;

  // ----- Molduras (produção + comercial) -----
  const perfilLargura = Math.max(0, Number(input.molduras[0]?.produto?.largura_cm) || 0);
  const larguraFinal = round(aberturaL + perfilLargura * 2, 2);
  const alturaFinal = round(aberturaA + perfilLargura * 2, 2);

  const molduras: MolduraDetalhe[] = input.molduras
    .filter((m) => m.produto)
    .map((m) => {
      const produto = m.produto;
      const larg = Math.max(0, Number(produto.largura_cm) || 0);
      const pecaH = round(aberturaL + larg * 2, 2);
      const pecaV = round(aberturaA + larg * 2, 2);
      const todasPecas: number[] = [];
      for (let i = 0; i < qtd; i++) {
        todasPecas.push(pecaH, pecaH, pecaV, pecaV);
      }
      const { barras, excede } = packBarras(todasPecas, barraCm);

      const perimetro = round(((aberturaL + aberturaA) * 2) / 100, 4);
      const perimetroCobrado = round(Math.max(perimetro, 1), 4);

      return {
        produto_id: produto.id,
        codigo: produto.codigo,
        descricao: produto.nome,
        perfil_largura_cm: larg,
        perimetro_comercial_m: perimetro,
        perimetro_cobrado_m: perimetroCobrado,
        peca_horizontal_cm: pecaH,
        peca_vertical_cm: pecaV,
        total_pecas: todasPecas.length,
        barras,
        total_barras: barras.length,
        peca_excede_barra: excede,
      };
    });

  // ----- Materiais (preço) -----
  const materiais: MaterialCalculado[] = [];

  for (const m of molduras) {
    const matched = input.molduras.find((x) => x.produto?.id === m.produto_id);
    if (matched?.produto) {
      materiais.push(materialDePreco(matched.produto, "perfil_moldura", m.perimetro_cobrado_m, qtd));
    }
  }
  for (const pp of passesOrdenados) {
    materiais.push(materialDePreco(pp.produto, "passe_partout", areaM2, qtd));
  }
  if (input.protecao) {
    materiais.push(materialDePreco(input.protecao, "protecao_frontal", areaM2, qtd));
  }
  if (input.fundo) {
    materiais.push(materialDePreco(input.fundo, "fundo", areaM2, qtd));
  }

  // Impressão: usa área da ARTE (não abertura), preço_venda × m² × qtd
  if (input.impressao) {
    const areaArteM2 = round((la * aa) / 10000);
    materiais.push(materialDePreco(input.impressao, "impressao", areaArteM2, qtd));
  }

  // Chassi: até limite (default 4 m²) cobra perímetro linear (arte);
  // acima do limite cobra área em m² × preco_venda_acima_m2.
  if (input.chassi) {
    const areaArteM2 = round((la * aa) / 10000);
    const limite = Number(input.chassi.preco_venda_limite_m2 ?? 4);
    const perimetroM = round(((la + aa) * 2) / 100, 4);
    if (areaArteM2 <= limite || !input.chassi.preco_venda_acima_m2) {
      materiais.push(materialDePreco(input.chassi, "chassi", perimetroM, qtd));
    } else {
      const preco = Number(input.chassi.preco_venda_acima_m2);
      const quantidade = round(areaArteM2 * qtd);
      materiais.push({
        produto_id: input.chassi.id,
        codigo: input.chassi.codigo,
        descricao: `${input.chassi.nome} (acima de ${limite} m²)`,
        origem: "chassi",
        unidade: "m2",
        quantidade,
        preco_venda: preco,
        valor_total: round(quantidade * preco, 2),
      });
    }
  }

  for (const s of input.servicos) {
    materiais.push(materialDePreco(s, "servico", 1, qtd));
  }

  const valor_total = round(materiais.reduce((s, m) => s + m.valor_total, 0), 2);
  const valor_unitario = round(valor_total / Math.max(1, qtd), 2);

  return {
    quantidade: qtd,
    largura_arte_cm: la,
    altura_arte_cm: aa,
    soma_passe_partout_cm: somaPp,
    largura_abertura_cm: aberturaL,
    altura_abertura_cm: aberturaA,
    largura_final_cm: larguraFinal,
    altura_final_cm: alturaFinal,
    perfil_largura_cm: perfilLargura,
    passe_partouts,
    passe_partout_excede_chapa,
    molduras,
    area_m2: areaM2,
    materiais,
    valor_unitario,
    valor_total,
  };
}
