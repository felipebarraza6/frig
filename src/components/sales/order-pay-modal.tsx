"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { formatCLP } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { payOrder } from "@/lib/api/orders";
import { fetchPaymentMethods } from "@/lib/api/payments";

function toNum(value: unknown): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

export function OrderPayModal({
  open,
  onClose,
  orderId,
  orderLabel,
  total,
  paid,
}: {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderLabel: string;
  total: number;
  paid: number;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const remaining = Math.max(0, toNum(total) - toNum(paid));

  const { data: methods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
    enabled: open,
  });

  const activeMethods = useMemo(() => methods.filter((m) => m.is_active !== false), [methods]);

  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount(remaining > 0 ? remaining.toFixed(0) : "");
    setMethodId((prev) => prev || activeMethods[0]?.id || "");
    setReference("");
    setNotes("");
  }, [open, remaining, activeMethods]);

  const selected = activeMethods.find((m) => m.id === methodId);
  const amountNum = toNum(amount);
  const canSubmit =
    amountNum > 0 &&
    amountNum <= remaining + 0.009 &&
    Boolean(methodId) &&
    (!selected?.requires_reference || reference.trim().length > 0);

  const pay = useMutation({
    mutationFn: () =>
      payOrder(orderId, {
        payment_method_id: methodId,
        amount: amountNum.toFixed(2),
        reference: reference.trim() || null,
        notes: notes.trim() || null,
        skip_cash_register_validation: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Pago de ${formatCLP(amountNum)} registrado`);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo registrar el pago"),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar pago"
      description={orderLabel}
      size="sm"
      containerClassName="z-[80]"
    >
      <ModalBody className="flex flex-col gap-4">
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="tabular-nums font-medium">{formatCLP(total)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-muted-foreground">Ya pagado</span>
            <span className="tabular-nums">{formatCLP(paid)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between border-t border-border/60 pt-1.5">
            <span className="font-medium">Saldo</span>
            <span className="text-base font-semibold tabular-nums text-primary">
              {formatCLP(remaining)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pay-amount" className="text-xs font-medium text-muted-foreground">
            Monto
          </label>
          <Input
            id="pay-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, "").replace(",", "."))}
            className="h-10 tabular-nums"
            autoFocus
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setAmount(remaining.toFixed(0))}
              className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted"
            >
              Saldo {formatCLP(remaining)}
            </button>
            {remaining > 1 && (
              <button
                type="button"
                onClick={() => setAmount(Math.round(remaining / 2).toString())}
                className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted"
              >
                Mitad
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pay-method" className="text-xs font-medium text-muted-foreground">
            Tipo de pago
          </label>
          <Select
            id="pay-method"
            value={methodId}
            onChange={(e) => setMethodId(e.target.value)}
            className="h-10"
          >
            {activeMethods.length === 0 ? (
              <option value="">Sin métodos activos</option>
            ) : (
              activeMethods.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))
            )}
          </Select>
        </div>

        {selected?.requires_reference && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pay-ref" className="text-xs font-medium text-muted-foreground">
              Referencia
            </label>
            <Input
              id="pay-ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="N° de operación, voucher…"
              className="h-10"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="pay-notes" className="text-xs font-medium text-muted-foreground">
            Nota (opcional)
          </label>
          <Input
            id="pay-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="h-10"
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={pay.isPending}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => pay.mutate()}
          disabled={!canSubmit}
          isLoading={pay.isPending}
        >
          Confirmar pago
        </Button>
      </ModalFooter>
    </Modal>
  );
}
