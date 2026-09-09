"use client";

import { useMemo, useState } from "react";
import { FileText, Printer, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { downloadOrderThermalPdf } from "@/lib/api/orders";
import { formatCLP } from "@/lib/utils";
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
  const [showPreview, setShowPreview] = useState(true);
  const toast = useToast();

  const orderLabel = useMemo(
    () => order.order_number || `#${order.id.slice(0, 8)}`,
    [order],
  );

  // Previsualización del ticket: precios reales desde la orden; si no hay
  // productos cargados, cae a los ítems del carrito (sin precio).
  const previewItems = useMemo(() => {
    const fromOrder = (order.products ?? []).map((p) => ({
      quantity: p.quantity ?? 1,
      name: p.product_name ?? "Producto",
      notes: null as string | null,
      total: p.total_price ?? 0,
    }));
    if (fromOrder.length > 0) return fromOrder;
    return (items ?? []).map((item) => ({
      quantity: item.quantity,
      name: item.product.name,
      notes: item.notes?.trim() ? item.notes.trim() : null,
      total: null as number | null,
    }));
  }, [order, items]);

  const previewTotal = useMemo(() => {
    const sum = previewItems.reduce((acc, i) => acc + (i.total ?? 0), 0);
    return sum > 0 ? sum : Number(order.total_amount ?? 0);
  }, [previewItems, order]);

  const previewDate = useMemo(
    () =>
      new Date().toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }),
    [],
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
        {/* Previsualización del ticket cobrado */}
        <div className="overflow-hidden rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="flex w-full items-center justify-between bg-muted/50 px-3 py-2 text-xs font-medium transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <span className="flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> Vista previa del ticket
            </span>
            <span className="text-[10px] text-muted-foreground">
              {showPreview ? "Ocultar" : "Mostrar"}
            </span>
          </button>
          {showPreview && (
            <div className="max-h-56 overflow-y-auto bg-background px-3 py-2">
              <p className="text-center text-xs font-semibold">{branchName || "Ticket"}</p>
              <p className="text-center text-[10px] text-muted-foreground">
                {orderLabel} · {previewDate}
              </p>
              <div className="my-2 border-t border-dashed border-border" />
              <ul className="space-y-1">
                {previewItems.map((item, idx) => (
                  <li key={idx} className="text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="font-medium">{item.quantity}×</span> {item.name}
                      </span>
                      {item.total != null && (
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {formatCLP(item.total)}
                        </span>
                      )}
                    </div>
                    {item.notes && (
                      <p className="pl-4 text-[10px] text-muted-foreground">Nota: {item.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="my-2 border-t border-dashed border-border" />
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold">Total</span>
                <span className="text-sm font-bold tabular-nums text-primary">
                  {formatCLP(previewTotal)}
                </span>
              </div>
            </div>
          )}
        </div>

        <Button
          variant="outline"
          className="h-auto justify-start gap-3 py-3"
          onClick={handleDownloadBoleta}
          isLoading={downloadingPdf}
        >
          <Receipt className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-medium">Boleta (PDF 80mm)</p>
            <p className="text-xs text-muted-foreground">Comprobante bonito para impresora térmica</p>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-auto justify-start gap-3 py-3"
          onClick={handleDownloadTicket}
          isLoading={downloadingTxt}
        >
          <FileText className="h-5 w-5 text-primary" />
          <div className="text-left">
            <p className="text-sm font-medium">Ticket simple (TXT)</p>
            <p className="text-xs text-muted-foreground">Solo contenido, sin precios</p>
          </div>
        </Button>

        <Button
          variant="outline"
          className="h-auto justify-start gap-3 py-3"
          onClick={handlePrintTicket}
          isLoading={printingTicket}
        >
          <Printer className="h-5 w-5 text-primary" />
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
