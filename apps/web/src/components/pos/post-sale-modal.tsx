"use client";

import { useMemo, useState } from "react";
import { FileText, Printer, Receipt, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { downloadOrderThermalPdf } from "@/lib/api/orders";
import { useToast } from "@/lib/store/toast";
import type { CartItem } from "@/lib/store/cart";
import type { YggdraSchemas } from "@/lib/api/types";

type Order = YggdraSchemas["Order"] & { order_number?: string | null };

interface PostSaleModalProps {
  order: Order;
  items?: CartItem[];
  branchName?: string;
  onClose: () => void;
}

type TicketLineItem = {
  quantity: number;
  name: string;
  modifiers?: { name: string }[];
  notes?: string | null;
};

function buildSimpleTicket(order: Order, items: CartItem[] | undefined, branchName?: string): string {
  const now = new Date().toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
  });

  // Si no vienen items del carrito, armamos líneas desde los productos de la orden.
  const lineItems: TicketLineItem[] =
    items && items.length > 0
      ? items.map((item) => ({
          quantity: item.quantity,
          name: item.product.name,
          modifiers: item.modifiers.map((m) => ({ name: m.name })),
          notes: item.notes,
        }))
      : (order.products ?? []).map((p) => ({
          quantity: p.quantity ?? 1,
          name: p.product_name ?? "Producto",
          modifiers: [],
          notes: null,
        }));

  const lines: string[] = [];
  lines.push(branchName || "TICKET");
  lines.push("================");
  lines.push(`Orden: ${order.order_number || order.id.slice(0, 8)}`);
  lines.push(`Fecha: ${now}`);
  lines.push("");
  lines.push("CONTENIDO:");
  lines.push("----------------");
  for (const item of lineItems) {
    lines.push(`${item.quantity}x ${item.name}`);
    for (const modifier of item.modifiers ?? []) {
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
            <title>Ticket ${orderLabel.replace(/</g, "&lt;")}</title>
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
    <Modal
      open
      onClose={onClose}
      title="Pago registrado"
      description={`Orden ${orderLabel}`}
      size="sm"
      hideCloseButton
    >
      <ModalBody className="flex flex-col gap-3">
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
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose} className="w-full sm:w-auto">
          Cerrar y seguir
        </Button>
      </ModalFooter>
    </Modal>
  );
}
