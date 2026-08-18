"use client";

import { useMemo, useState } from "react";
import { FileText, Printer, Receipt, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadOrderThermalPdf } from "@/lib/api/orders";
import { useToast } from "@/lib/store/toast";
import type { CartItem } from "@/lib/store/cart";
import type { YggdraSchemas } from "@/lib/api/types";

type Order = YggdraSchemas["Order"] & { order_number?: string | null };

interface PostSaleModalProps {
  order: Order;
  items: CartItem[];
  branchName?: string;
  onClose: () => void;
}

function buildSimpleTicket(order: Order, items: CartItem[], branchName?: string): string {
  const now = new Date().toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const lines: string[] = [];
  lines.push(branchName || "TICKET");
  lines.push("================");
  lines.push(`Orden: ${order.order_number || order.id.slice(0, 8)}`);
  lines.push(`Fecha: ${now}`);
  lines.push("");
  lines.push("CONTENIDO:");
  lines.push("----------------");
  for (const item of items) {
    lines.push(`${item.quantity}x ${item.product.name}`);
    for (const modifier of item.modifiers) {
      lines.push(`   - ${modifier.name}`);
    }
    if (item.notes?.trim()) {
      lines.push(`   Nota: ${item.notes.trim()}`);
    }
  }
  lines.push("");
  lines.push("================");
  lines.push("Gracias por su compra");
  return lines.join("\n");
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export function PostSaleModal({ order, items, branchName, onClose }: PostSaleModalProps) {
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingTxt, setDownloadingTxt] = useState(false);
  const [printingTicket, setPrintingTicket] = useState(false);
  const toast = useToast();

  const orderLabel = useMemo(
    () => order.order_number || `#${order.id.slice(0, 8)}`,
    [order],
  );

  async function handleDownloadBoleta() {
    setDownloadingPdf(true);
    try {
      const { blob, filename } = await downloadOrderThermalPdf(order.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || `boleta_${order.id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al descargar la boleta";
      toast.error(message);
    } finally {
      setDownloadingPdf(false);
    }
  }

  function handleDownloadTicket() {
    setDownloadingTxt(true);
    try {
      const content = buildSimpleTicket(order, items, branchName);
      const filename = `ticket_${order.order_number || order.id.slice(0, 8)}.txt`;
      downloadBlob(content, filename, "text/plain;charset=utf-8");
    } finally {
      // Breve retardo para que el usuario vea el feedback visual del botón.
      setTimeout(() => setDownloadingTxt(false), 300);
    }
  }

  function handlePrintTicket() {
    setPrintingTicket(true);
    try {
      const content = buildSimpleTicket(order, items, branchName);
      const printWindow = window.open("", "_blank", "width=320,height=600");
      if (!printWindow) {
        toast.error("No se pudo abrir la ventana de impresión");
        return;
      }
      printWindow.document.write(
        `<html>
          <head>
            <title>Ticket ${orderLabel}</title>
            <style>
              body { font-family: monospace; font-size: 14px; padding: 16px; margin: 0; }
              pre { white-space: pre-wrap; word-break: break-word; }
              @media print { body { padding: 0; } }
            </style>
          </head>
          <body onload="window.print();">
            <pre>${content.replace(/</g, "&lt;")}</pre>
          </body>
        </html>`
      );
      printWindow.document.close();
    } finally {
      // Breve retardo para que el usuario vea el feedback visual del botón.
      setTimeout(() => setPrintingTicket(false), 300);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col rounded-2xl border border-border/60 bg-card p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Venta registrada</h2>
            <p className="text-xs text-muted-foreground">Orden {orderLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="h-auto justify-start gap-3 py-3"
            onClick={handleDownloadBoleta}
            disabled={downloadingPdf}
          >
            {downloadingPdf ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Receipt className="h-5 w-5 text-primary" />
            )}
            <div className="text-left">
              <p className="text-sm font-medium">Boleta (PDF 80mm)</p>
              <p className="text-xs text-muted-foreground">Comprobante bonito para impresora térmica</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto justify-start gap-3 py-3"
            onClick={handleDownloadTicket}
            disabled={downloadingTxt}
          >
            {downloadingTxt ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <FileText className="h-5 w-5 text-primary" />
            )}
            <div className="text-left">
              <p className="text-sm font-medium">Ticket simple (TXT)</p>
              <p className="text-xs text-muted-foreground">Solo contenido, sin precios</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto justify-start gap-3 py-3"
            onClick={handlePrintTicket}
            disabled={printingTicket}
          >
            {printingTicket ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Printer className="h-5 w-5 text-primary" />
            )}
            <div className="text-left">
              <p className="text-sm font-medium">Imprimir ticket simple</p>
              <p className="text-xs text-muted-foreground">Envía el contenido a la impresora</p>
            </div>
          </Button>

          <Button onClick={onClose} className="mt-1 w-full">
            Cerrar y seguir
          </Button>
        </div>
      </div>
    </div>
  );
}
