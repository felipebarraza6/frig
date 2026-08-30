"use client";

import { useState } from "react";
import { Plus, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { formatCLP, paymentTypeLabel } from "@/lib/utils";
import { createPayment } from "@/lib/api/payments";
import { freeTable } from "@/lib/api/tables";
import type { YggdraSchemas } from "@/lib/api/types";

type Order = YggdraSchemas["Order"] & { order_number?: string | null };
type PaymentMethod = YggdraSchemas["PaymentMethodList"];
type CashRegister = YggdraSchemas["CashRegister"];

interface OrderCollectModalProps {
  order: Order;
  paymentMethods: PaymentMethod[] | undefined;
  currentCashRegister: CashRegister | null | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

interface PaymentLine {
  id: string;
  payment_method_id: string;
  amount: string;
}


function getDocumentTypeLabel(client?: { receiver_type?: string | null; default_document_type?: string | null } | null): { label: string; variant: string } {
  if (!client) return { label: "Boleta", variant: "bg-muted text-muted-foreground" };
  if (client.default_document_type === "FACTURA" || client.receiver_type === "EMPRESA") {
    return { label: "Factura", variant: "bg-primary/10 text-primary" };
  }
  return { label: "Boleta", variant: "bg-muted text-muted-foreground" };
}

export default function OrderCollectModal({
  order,
  paymentMethods,
  currentCashRegister,
  onClose,
  onSuccess,
}: OrderCollectModalProps) {
  const firstMethod = paymentMethods?.[0];
  const total = parseFloat(order.total_amount ?? "0");
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([
    {
      id: "initial",
      payment_method_id: firstMethod?.id ?? "",
      amount: Math.round(total).toString(),
    },
  ]);
  const [collectError, setCollectError] = useState<string | null>(null);
  const [collectSuccess, setCollectSuccess] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function addPaymentLine() {
    setPaymentLines((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        payment_method_id: firstMethod?.id ?? "",
        amount: "",
      },
    ]);
  }

  function removePaymentLine(id: string) {
    setPaymentLines((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePaymentLine(id: string, patch: Partial<PaymentLine>) {
    setPaymentLines((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  const paidAmount = paymentLines.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
  const remaining = Math.max(0, total - paidAmount);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCollectError(null);
    if (paidAmount < total) {
      setCollectError(`Faltan ${formatCLP(remaining)} para completar el pago.`);
      return;
    }
    if (!currentCashRegister) {
      setCollectError("Debes abrir una caja antes de registrar el pago.");
      return;
    }
    setIsPending(true);
    try {
      for (const payment of paymentLines) {
        await createPayment({
          payment_method_id: payment.payment_method_id,
          order_id: order.id,
          amount: Number(payment.amount).toFixed(2),
          status: "COMPLETED",
          cash_register_id: currentCashRegister.id,
        });
      }
      // Al cobrar la cuenta completa, la mesa queda libre.
      if (order.table) {
        try {
          await freeTable(order.table);
        } catch {
          // Si falla, la mesa puede liberarse manualmente.
        }
      }
      setCollectSuccess("Pago registrado correctamente.");
      setTimeout(() => {
        onSuccess();
      }, 800);
    } catch (err) {
      setCollectError(err instanceof Error ? err.message : "Error al registrar el pago.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Cobrar orden ${order.order_number ?? order.id.slice(0, 8)}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="flex flex-col gap-4">
          <div className="rounded-lg border border-border p-3 text-sm">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-muted-foreground">Total a cobrar</span>
              <span className="text-lg font-semibold tabular-nums">{formatCLP(total)}</span>
            </div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Documento a generar</span>
              {(() => {
                const doc = getDocumentTypeLabel(order.client);
                return (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${doc.variant}`}>
                    <FileText className="h-3 w-3" />
                    {doc.label}
                  </span>
                );
              })()}
            </div>
            {(order.net_amount || order.tax_amount || order.tax_rate) && (
              <div className="flex flex-col gap-1 border-t border-border/60 pt-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Neto (sin IVA{order.tax_rate ? ` ${order.tax_rate}%` : ""})</span>
                  <span className="tabular-nums">{formatCLP(parseFloat(order.net_amount ?? "0"))}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA</span>
                  <span className="tabular-nums">{formatCLP(parseFloat(order.tax_amount ?? "0"))}</span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Pagos</label>
              <Button type="button" variant="outline" size="sm" onClick={addPaymentLine}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Agregar
              </Button>
            </div>
            {paymentLines.map((line) => (
              <div key={line.id} className="flex items-end gap-2 rounded-lg border border-border p-2">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Método</label>
                  <Select
                    value={line.payment_method_id}
                    onChange={(e) => updatePaymentLine(line.id, { payment_method_id: e.target.value })}
                  >
                    {paymentMethods?.map((m) => (
                      <option key={m.id} value={m.id}>
                        {paymentTypeLabel(m.payment_type) || m.name || m.payment_type}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex w-28 flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Monto</label>
                  <Input
                    type="number"
                    min={0}
                    step="1"
                    value={line.amount ? Math.round(parseFloat(line.amount)).toString() : ""}
                    onChange={(e) => updatePaymentLine(line.id, { amount: e.target.value })}
                    className="tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removePaymentLine(line.id)}
                  className="mb-2 text-muted-foreground hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-1"
                  aria-label="Quitar pago"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total ingresado</span>
              <span className="tabular-nums">{formatCLP(paidAmount)}</span>
            </div>
          </div>

          {collectError && (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{collectError}</p>
          )}
          {collectSuccess && (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">{collectSuccess}</p>
          )}
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isPending}>
            Registrar pago
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
