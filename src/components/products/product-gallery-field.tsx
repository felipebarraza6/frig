"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCanManageInventory } from "@/lib/store/session";
import {
  deleteProductImage,
  fetchProductGallery,
  galleryImageSrc,
  replaceProductImage,
  setPrimaryProductImage,
  uploadPendingProductImages,
  uploadProductImage,
  validateProductImageFile,
} from "@/lib/api/product-gallery";

export interface ProductGalleryFieldHandle {
  /** Sube las vistas previas locales cuando el producto acaba de crearse. */
  flushPending: (productId: number) => Promise<void>;
}

interface PendingImage {
  key: string;
  file: File;
  preview: string;
}

interface ProductGalleryFieldProps {
  productId?: number;
  /** El formulario conserva los archivos si esta pestaña se desmonta antes de crear. */
  onPendingFilesChange?: (files: File[]) => void;
}

export const ProductGalleryField = forwardRef<
  ProductGalleryFieldHandle,
  ProductGalleryFieldProps
>(function ProductGalleryField({ productId, onPendingFilesChange }, ref) {
  const canEdit = useCanManageInventory();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef<number | null>(null);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const galleryQuery = useQuery({
    queryKey: ["product-gallery", productId],
    queryFn: () => fetchProductGallery(productId!),
    enabled: productId != null,
  });

  const pendingRef = useRef(pending);
  // Un montaje nuevo (AnimatePresence desmonta la pestaña Datos) no debe
  // avisar [] y borrar los archivos que el formulario ya guardó.
  const skipInitialEmptySync = useRef(true);
  useEffect(() => {
    pendingRef.current = pending;
    if (skipInitialEmptySync.current) {
      skipInitialEmptySync.current = false;
      if (pending.length === 0) return;
    }
    onPendingFilesChange?.(pending.map((item) => item.file));
  }, [pending, onPendingFilesChange]);
  const onPendingFilesChangeRef = useRef(onPendingFilesChange);
  useEffect(() => {
    onPendingFilesChangeRef.current = onPendingFilesChange;
  }, [onPendingFilesChange]);
  useEffect(() => {
    return () => {
      for (const item of pendingRef.current) URL.revokeObjectURL(item.preview);
      // El File sigue vivo en el formulario; solo se revoca la vista previa.
      onPendingFilesChangeRef.current?.(pendingRef.current.map((item) => item.file));
    };
  }, []);

  function invalidate() {
    if (productId != null) {
      void queryClient.invalidateQueries({ queryKey: ["product-gallery", productId] });
    }
    void queryClient.invalidateQueries({ queryKey: ["product-gallery", "branch"] });
    void queryClient.invalidateQueries({ queryKey: ["products"] });
  }

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await task();
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la imagen");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  useImperativeHandle(ref, () => ({
    async flushPending(nextProductId: number) {
      const queue = pendingRef.current;
      // canEdit se lee en el render. Si el handle queda viejo (pestaña que
      // sale) no hay que negarse a subir archivos que el usuario ya eligió.
      if (queue.length === 0) return;
      await run(async () => {
        await uploadPendingProductImages(
          nextProductId,
          queue.map((item) => item.file),
        );
        for (const item of queue) URL.revokeObjectURL(item.preview);
        pendingRef.current = [];
        onPendingFilesChange?.([]);
        setPending([]);
      });
    },
  }));

  function takeFiles(list: FileList | null) {
    if (!canEdit || !list?.length) return;
    const incoming = Array.from(list);
    const next: PendingImage[] = [];
    for (const file of incoming) {
      const message = validateProductImageFile(file);
      if (message) {
        setError(message);
        return;
      }
      next.push({
        key: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        preview: URL.createObjectURL(file),
      });
    }
    setError(null);

    const targetId = replaceId.current;
    replaceId.current = null;
    if (targetId != null && productId != null) {
      const file = next[0]?.file;
      const saved = (galleryQuery.data ?? []).find((img) => img.id === targetId);
      if (!file || !saved) return;
      void run(async () => {
        await replaceProductImage({
          productId,
          imageId: targetId,
          file,
          isPrimary: saved.is_primary,
        });
      }).catch(() => undefined);
      for (const item of next) URL.revokeObjectURL(item.preview);
      return;
    }

    if (productId != null) {
      const hasPrimary = (galleryQuery.data ?? []).some((img) => img.is_primary);
      void run(async () => {
        for (let i = 0; i < next.length; i++) {
          await uploadProductImage({
            productId,
            file: next[i].file,
            isPrimary: !hasPrimary && i === 0,
            altText: next[i].file.name,
          });
        }
      }).catch(() => undefined);
      for (const item of next) URL.revokeObjectURL(item.preview);
      return;
    }

    const merged = [...pendingRef.current, ...next];
    pendingRef.current = merged;
    onPendingFilesChange?.(merged.map((item) => item.file));
    setPending(merged);
  }

  const saved = galleryQuery.data ?? [];

  return (
    <div className="sm:col-span-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Imágenes</p>
        {canEdit && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              replaceId.current = null;
              inputRef.current?.click();
            }}
          >
            <ImagePlus className="h-3.5 w-3.5" />
            Subir
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        aria-label="Subir imagen del producto"
        disabled={!canEdit || busy}
        onChange={(e) => {
          takeFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {saved.length === 0 && pending.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-xl bg-muted/50 text-xs text-muted-foreground ring-1 ring-border/40">
          Sin imagen
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {saved.map((image) => (
            <GalleryThumb
              key={image.id}
              src={galleryImageSrc(image)}
              alt={image.alt_text || image.title || "Imagen del producto"}
              primary={image.is_primary}
              canEdit={canEdit}
              busy={busy}
              onReplace={() => {
                replaceId.current = image.id;
                inputRef.current?.click();
              }}
              onDelete={() => {
                void run(() => deleteProductImage(image.id)).catch(() => undefined);
              }}
              onPrimary={
                image.is_primary || productId == null
                  ? undefined
                  : () => {
                      void run(() => setPrimaryProductImage(productId, image.id)).catch(
                        () => undefined,
                      );
                    }
              }
            />
          ))}
          {pending.map((item, index) => (
            <GalleryThumb
              key={item.key}
              src={item.preview}
              alt={item.file.name}
              primary={index === 0 && saved.length === 0}
              canEdit={canEdit}
              busy={busy}
              onDelete={() => {
                URL.revokeObjectURL(item.preview);
                setPending((current) => current.filter((row) => row.key !== item.key));
              }}
            />
          ))}
        </ul>
      )}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
      {!canEdit && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Solo quien puede editar productos puede cambiar las imágenes.
        </p>
      )}
    </div>
  );
});

function GalleryThumb({
  src,
  alt,
  primary,
  canEdit,
  busy,
  onReplace,
  onDelete,
  onPrimary,
}: {
  src: string | null;
  alt: string;
  primary: boolean;
  canEdit: boolean;
  busy: boolean;
  onReplace?: () => void;
  onDelete?: () => void;
  onPrimary?: () => void;
}) {
  return (
    <li className="relative h-24 w-24 overflow-hidden rounded-xl bg-muted ring-1 ring-border/50">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
          Sin vista
        </span>
      )}
      {primary && (
        <span className="absolute left-1 top-1 rounded-full bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
          Principal
        </span>
      )}
      {canEdit && (
        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-0.5 bg-background/80 p-0.5">
          {onPrimary && (
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Marcar como principal"
              disabled={busy}
              onClick={onPrimary}
            >
              <Star className={cn("h-3.5 w-3.5", primary && "fill-current")} />
            </button>
          )}
          {onReplace && (
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
              aria-label="Reemplazar imagen"
              disabled={busy}
              onClick={onReplace}
            >
              <ImagePlus className="h-3.5 w-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:text-danger"
              aria-label="Eliminar imagen"
              disabled={busy}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}
