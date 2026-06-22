/**
 * Geração simples de PDF do pedido usando jsPDF.
 * Layout profissional em texto + cabeçalho da empresa.
 */
import { jsPDF } from "jspdf";
import type { Cliente, Pedido, PedidoItem } from "@/types/erp";
import { FORMA_PAGAMENTO_LABEL, PEDIDO_STATUS_LABEL } from "@/types/erp";
import { formatBRL, formatDate } from "@/lib/format";

const EMPRESA = {
  nome: "Molduraria",
  subtitulo: "Quadros personalizados",
};

export function gerarPedidoPDF(opts: {
  pedido: Pedido;
  cliente: Cliente | null;
  itens: PedidoItem[];
}): { blob: Blob; dataUrl: string; filename: string } {
  const { pedido, cliente, itens } = opts;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  let y = 48;

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(EMPRESA.nome, 40, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(EMPRESA.subtitulo, 40, y + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Pedido #${pedido.numero_pedido}`, W - 40, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Status: ${PEDIDO_STATUS_LABEL[pedido.status]}`, W - 40, y + 14, { align: "right" });
  doc.text(`Emitido: ${formatDate(pedido.data_pedido ?? pedido.created_at)}`, W - 40, y + 28, { align: "right" });

  y += 56;
  doc.setDrawColor(220);
  doc.line(40, y, W - 40, y);
  y += 18;

  // Cliente
  doc.setFont("helvetica", "bold");
  doc.text("Cliente", 40, y);
  doc.setFont("helvetica", "normal");
  y += 14;
  if (cliente) {
    doc.text(cliente.nome, 40, y); y += 12;
    if (cliente.whatsapp || cliente.telefone)
      { doc.text(`WhatsApp: ${cliente.whatsapp ?? cliente.telefone}`, 40, y); y += 12; }
    if (cliente.email) { doc.text(`E-mail: ${cliente.email}`, 40, y); y += 12; }
    if (cliente.endereco) { doc.text(`Endereço: ${cliente.endereco}`, 40, y); y += 12; }
    if (cliente.cpf_cnpj) { doc.text(`CPF/CNPJ: ${cliente.cpf_cnpj}`, 40, y); y += 12; }
  } else {
    doc.text("Sem cliente vinculado.", 40, y); y += 12;
  }
  y += 8;

  // Itens
  doc.setFont("helvetica", "bold");
  doc.text("Itens", 40, y);
  y += 14;
  doc.setFontSize(9);
  doc.text("Descrição", 40, y);
  doc.text("Med.", 320, y);
  doc.text("Qtd", 380, y, { align: "right" });
  doc.text("Unit.", 450, y, { align: "right" });
  doc.text("Total", W - 40, y, { align: "right" });
  y += 6;
  doc.line(40, y, W - 40, y);
  y += 12;
  doc.setFont("helvetica", "normal");

  for (const i of itens) {
    if (y > 760) { doc.addPage(); y = 60; }
    const desc = doc.splitTextToSize(i.descricao ?? "", 270);
    doc.text(desc, 40, y);
    const medidas = `${Number(i.largura_cm)}×${Number(i.altura_cm)}`;
    doc.text(medidas, 320, y);
    doc.text(String(i.quantidade), 380, y, { align: "right" });
    doc.text(formatBRL(Number(i.valor_unitario)), 450, y, { align: "right" });
    doc.text(formatBRL(Number(i.valor_total)), W - 40, y, { align: "right" });
    y += Math.max(14, desc.length * 11);
  }

  y += 8;
  doc.line(40, y, W - 40, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Total geral", 40, y);
  doc.text(formatBRL(Number(pedido.valor_total)), W - 40, y, { align: "right" });
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  if (pedido.forma_pagamento)
    { doc.text(`Forma de pagamento: ${FORMA_PAGAMENTO_LABEL[pedido.forma_pagamento]}`, 40, y); y += 12; }
  if (pedido.data_entrega_prevista)
    { doc.text(`Entrega prevista: ${formatDate(pedido.data_entrega_prevista)}`, 40, y); y += 12; }
  if (pedido.observacoes) {
    y += 6;
    doc.setFont("helvetica", "bold"); doc.text("Observações", 40, y); y += 12;
    doc.setFont("helvetica", "normal");
    const obs = doc.splitTextToSize(pedido.observacoes, W - 80);
    doc.text(obs, 40, y);
  }

  const blob = doc.output("blob");
  const dataUrl = doc.output("datauristring");
  const filename = `pedido-${pedido.numero_pedido}.pdf`;
  return { blob, dataUrl, filename };
}

export function gerarMensagemWhatsapp(opts: {
  pedido: Pedido;
  cliente: Cliente | null;
  itens: PedidoItem[];
}): string {
  const { pedido, cliente, itens } = opts;
  const linhas = [
    `*Pedido #${pedido.numero_pedido}* — ${EMPRESA.nome}`,
    cliente ? `Cliente: ${cliente.nome}` : "",
    `Status: ${PEDIDO_STATUS_LABEL[pedido.status]}`,
    pedido.data_entrega_prevista
      ? `Entrega prevista: ${formatDate(pedido.data_entrega_prevista)}`
      : "",
    pedido.forma_pagamento
      ? `Pagamento: ${FORMA_PAGAMENTO_LABEL[pedido.forma_pagamento]}`
      : "",
    "",
    "*Itens:*",
    ...itens.map(
      (i) =>
        `• ${i.descricao} (${Number(i.largura_cm)}×${Number(i.altura_cm)} cm) — ${i.quantidade}x ${formatBRL(Number(i.valor_total))}`,
    ),
    "",
    `*Total: ${formatBRL(Number(pedido.valor_total))}*`,
  ].filter(Boolean);
  return linhas.join("\n");
}

export function whatsappUrl(telefone: string | null | undefined, mensagem: string): string {
  const digits = (telefone ?? "").replace(/\D/g, "");
  const base = digits ? `https://wa.me/${digits}` : `https://wa.me/`;
  return `${base}?text=${encodeURIComponent(mensagem)}`;
}
