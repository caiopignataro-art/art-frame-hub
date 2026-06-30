/**
 * Compressão de imagens para upload via canvas.
 * Mantém qualidade boa para impressão (max 1920px) reduzindo bytes.
 */
const MAX_DIM = 1920;
const QUALITY = 0.85;

export async function compressImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Arquivo não é uma imagem");
  }
  const dataUrl = await readAsDataURL(file);
  // SVGs e formatos exóticos: retorna direto
  if (file.type === "image/svg+xml") return dataUrl;

  const img = await loadImage(dataUrl);
  let { width, height } = img;
  if (width > MAX_DIM || height > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, width, height);
  // PNG preserva transparência; o resto converte para JPEG (menor)
  const outType = file.type === "image/png" ? "image/png" : "image/jpeg";
  return canvas.toDataURL(outType, QUALITY);
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
