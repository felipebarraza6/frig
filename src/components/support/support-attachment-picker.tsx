"use client";

import { useRef, useState } from "react";
import { Paperclip, X, FileText, ImageIcon, Loader2 } from "lucide-react";
import {
  SUPPORT_ATTACHMENT_MAX_FILES,
  fileToSupportAttachment,
  type SupportAttachment,
} from "@/lib/api/support";
import { mediaUrl } from "@/lib/api/client";
import { cn } from "@/lib/utils";

function attachmentHref(att: SupportAttachment): string {
  if (att.data) return att.data;
  return mediaUrl(att.file_url) ?? "";
}

interface SupportAttachmentPickerProps {
  value: SupportAttachment[];
  onChange: (next: SupportAttachment[]) => void;
  /** Cuántos ya existen en el ticket (al responder). */
  existingCount?: number;
  disabled?: boolean;
  className?: string;
}

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf";

export function SupportAttachmentPicker({
  value,
  onChange,
  existingCount = 0,
  disabled,
  className,
}: SupportAttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = Math.max(0, SUPPORT_ATTACHMENT_MAX_FILES - existingCount - value.length);

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0 || disabled) return;
    setError(null);
    const files = Array.from(list).slice(0, remaining);
    if (files.length === 0) {
      setError(`Máximo ${SUPPORT_ATTACHMENT_MAX_FILES} archivos por solicitud.`);
      return;
    }
    setBusy(true);
    try {
      const next: SupportAttachment[] = [...value];
      for (const file of files) {
        if (!ACCEPT.split(",").some((t) => file.type === t || (t.startsWith("image/") && file.type.startsWith("image/")))) {
          throw new Error(`"${file.name}" no es una imagen ni un PDF.`);
        }
        next.push(await fileToSupportAttachment(file));
      }
      onChange(next.slice(0, SUPPORT_ATTACHMENT_MAX_FILES - existingCount));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo adjuntar el archivo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={disabled || busy || remaining <= 0}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium transition-colors",
            "hover:border-primary/40 hover:bg-primary/5 hover:text-primary",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          Adjuntar captura o PDF
        </button>
        <span className="text-[11px] text-muted-foreground">
          Hasta {SUPPORT_ATTACHMENT_MAX_FILES} archivos · imágenes o PDF
        </span>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <p className="rounded-lg bg-danger/10 px-2.5 py-1.5 text-[11px] text-danger">{error}</p>
      )}

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((att, index) => {
            const href = attachmentHref(att);
            const isImage = att.content_type.startsWith("image/");
            return (
              <li
                key={`${att.name}-${index}`}
                className="group relative overflow-hidden rounded-xl border border-border bg-muted/20"
              >
                {isImage && href ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={href}
                    alt={att.name}
                    className="h-20 w-28 object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-28 flex-col items-center justify-center gap-1 px-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="line-clamp-2 text-center text-[9px] text-muted-foreground">
                      {att.name}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(index)}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm opacity-90 hover:bg-danger hover:text-white"
                  aria-label={`Quitar ${att.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {isImage && (
                  <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded bg-background/85 px-1 py-px text-[9px] text-muted-foreground">
                    <ImageIcon className="h-2.5 w-2.5" />
                    {att.name.length > 14 ? `${att.name.slice(0, 12)}…` : att.name}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Galería de solo lectura para el detalle del ticket. */
export function SupportAttachmentGallery({
  attachments,
}: {
  attachments: SupportAttachment[];
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Adjuntos ({attachments.length})
      </p>
      <ul className="flex flex-wrap gap-2">
        {attachments.map((att, index) => {
          const href = attachmentHref(att);
          const isImage = att.content_type.startsWith("image/");
          return (
            <li key={`${att.id ?? att.name}-${index}`}>
              <a
                href={href || undefined}
                download={att.name}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-xl border border-border bg-muted/20 transition-colors hover:border-primary/40"
                title={att.name}
              >
                {isImage && href ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={href} alt={att.name} className="h-24 w-32 object-cover" />
                ) : (
                  <div className="flex h-24 w-32 flex-col items-center justify-center gap-1 px-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="line-clamp-2 text-center text-[10px] text-muted-foreground">
                      {att.name}
                    </span>
                  </div>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
