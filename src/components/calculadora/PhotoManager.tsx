import * as React from "react";
import { Camera, ImagePlus, X, GripVertical } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { compressImage } from "@/lib/image-utils";

export interface PhotoManagerProps {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export function PhotoManager({
  value,
  onChange,
  max = 8,
  label = "Adicionar Fotos",
  hint = "Tire fotos diretamente da câmera ou escolha da galeria. Limite de "
    + "8 imagens.",
}: PhotoManagerProps) {
  const cameraRef = React.useRef<HTMLInputElement>(null);
  const galleryRef = React.useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = React.useState<string | null>(null);
  const [draggingIdx, setDraggingIdx] = React.useState<number | null>(null);

  const remaining = max - value.length;
  const full = remaining <= 0;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const arr = Array.from(files).slice(0, remaining);
    if (files.length > arr.length) {
      toast.warning(`Limite de ${max} fotos. Algumas imagens foram ignoradas.`);
    }
    try {
      const compressed = await Promise.all(arr.map((f) => compressImage(f)));
      onChange([...value, ...compressed]);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao processar imagem.");
    }
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  // Drag & drop reorder (HTML5)
  const onDragStart = (idx: number) => setDraggingIdx(idx);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = (idx: number) => {
    if (draggingIdx === null || draggingIdx === idx) return;
    const next = [...value];
    const [moved] = next.splice(draggingIdx, 1);
    next.splice(idx, 0, moved);
    onChange(next);
    setDraggingIdx(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {value.length}/{max}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{hint}</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={full}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="mr-1 h-4 w-4" />
          Tirar foto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={full}
          onClick={() => galleryRef.current?.click()}
        >
          <ImagePlus className="mr-1 h-4 w-4" />
          Escolher da galeria
        </Button>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {value.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
          Nenhuma foto adicionada.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((src, idx) => (
            <div
              key={idx}
              className="group relative aspect-square overflow-hidden rounded-md border bg-muted"
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={onDragOver}
              onDrop={() => onDrop(idx)}
            >
              <button
                type="button"
                onClick={() => setZoom(src)}
                className="block h-full w-full"
                aria-label={`Ampliar foto ${idx + 1}`}
              >
                <img
                  src={src}
                  alt={`Foto ${idx + 1}`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
                {idx + 1}
              </span>
              <span
                className="absolute bottom-1 left-1 hidden rounded bg-black/60 p-0.5 text-white sm:block"
                aria-hidden
              >
                <GripVertical className="h-3 w-3" />
              </span>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute right-1 top-1 h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(idx);
                }}
                aria-label={`Remover foto ${idx + 1}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-3xl p-2">
          {zoom && (
            <img
              src={zoom}
              alt="Foto ampliada"
              className="max-h-[80vh] w-full rounded object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
