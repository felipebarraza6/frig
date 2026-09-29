"use client";

import { QRCodeSVG } from "qrcode.react";
import { Copy, QrCode } from "lucide-react";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/store/toast";

interface QrModalProps {
  url: string;
  /** Subtítulo descriptivo (nombre de la encuesta, cliente…). */
  title?: string;
  heading?: string;
  copyMessage?: string;
  onClose: () => void;
}

/**
 * QR renderizado localmente con qrcode.react (mismo componente que los menús
 * públicos). Evita enviar URLs con token de cliente a servicios externos
 * (api.qrserver.com) y funciona sin conexión.
 */
export function QrModal({
  url,
  title,
  heading = "Código QR",
  copyMessage = "Enlace copiado al portapapeles",
  onClose,
}: QrModalProps) {
  const toast = useToast();
  const absoluteUrl = url.startsWith("http")
    ? url
    : `${window.location.origin}${url}`;

  return (
    <AnimatedOverlay
      open
      onClose={onClose}
      zIndex="z-[80]"
      panelClassName="flex items-center justify-center p-4"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 text-center shadow-xl">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <QrCode className="h-5 w-5" />
        </div>
        <h3 className="mt-2 text-base font-bold text-foreground">{heading}</h3>
        {title ? <p className="mt-0.5 text-xs text-muted-foreground">{title}</p> : null}
        <div className="mt-4 flex justify-center rounded-xl border border-border bg-white p-4 shadow-inner">
          <QRCodeSVG value={absoluteUrl} size={176} level="M" className="rounded-lg" />
        </div>
        <p className="mt-3 truncate text-[11px] text-muted-foreground">{absoluteUrl}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              void navigator.clipboard.writeText(absoluteUrl);
              toast.success(copyMessage);
            }}
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar Link
          </Button>
          <Button size="sm" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </AnimatedOverlay>
  );
}
