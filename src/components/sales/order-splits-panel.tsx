"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCLP, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import {
  fetchOrderSplits,
  createOrderSplit,
  payOrderSplit,
  cancelOrderSplit,
} from "@/lib/api/order-splits";
import { fetchPaymentMethods } from "@/lib/api/payments";

export function OrderSplitsPanel({ orderId, orderTotal }: { orderId: string; orderTotal: string | number }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [payingSplitId, setPayingSplitId] = useState<number | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [methodDropdownOpen, setMethodDropdownOpen] = useState(false);

  const splitsQuery = useQuery({
    queryKey: ["orders", orderId, "splits"],
    queryFn: () => fetchOrderSplits(orderId),
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  const activeMethods = paymentMethods.filter((m) => m.is_active);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["orders", orderId, "splits"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  }

  const create = useMutation({
    mutationFn: () =>
      createOrderSplit({
        order: orderId,
        split_number: (splitsQuery.data?.length ?? 0) + 1,
        amount: Number.parseFloat(amount) || 0,
        notes: notes || undefined,
      } as never),
    onSuccess: () => {
      setAmount("");
      setNotes("");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo crear el pago"),
  });

  const pay = useMutation({
    mutationFn: ({ id, methodId }: { id: number; methodId: string | null }) =>
      payOrderSplit(id, { payment_method_id: methodId }),
    onSuccess: () => {
      setPayingSplitId(null);
      setSelectedMethodId("");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo registrar el pago"),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => cancelOrderSplit(id),
    onSuccess: () => {
      refresh();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo anular el pago"),
  });

  const splits = splitsQuery.data ?? [];

  function handlePaySplit(splitId: number) {
    pay.mutate({ id: splitId, methodId: selectedMethodId || null });
  }

  function startPaySplit(splitId: number) {
    setPayingSplitId(splitId);
    if (activeMethods.length > 0 && !selectedMethodId) {
      setSelectedMethodId(activeMethods[0].id);
    }
    setMethodDropdownOpen(false);
  }

  function cancelPaySplit() {
    setPayingSplitId(null);
    setSelectedMethodId("");
    setMethodDropdownOpen(false);
  }

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pagos · {formatCLP(orderTotal ?? "0")}
      </p>
      {splitsQuery.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Cargando pagos…</p>
      ) : splits.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sin pagos, agrega el primero abajo.</p>
      ) : (
        <div className="mt-2 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
          {splits.map((s) => {
            const isPaying = payingSplitId === s.id;
            return (
            <div key={s.id} className="flex flex-col gap-2 px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">Pago {s.split_number}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {s.status ?? "PENDING"}
                    {s.payment_method_name ? ` · ${s.payment_method_name}` : ""}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">{formatCLP(s.amount ?? 0)}</p>
                <div className="flex shrink-0 gap-1.5">
                  {s.status !== "PAID" && s.status !== "CANCELLED" && !isPaying && (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => startPaySplit(s.id)}>
                      Pagar
                    </Button>
                  )}
                  {s.status !== "PAID" && s.status !== "CANCELLED" && (
                    <Button size="sm" variant="ghost" className="h-8 text-danger" onClick={() => cancel.mutate(s.id)} disabled={cancel.isPending}>
                      Anular
                    </Button>
                  )}
                </div>
              </div>
              {isPaying && (
                <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 p-2">
                  <div className="relative flex-1" onClick={() => setMethodDropdownOpen(!methodDropdownOpen)}>
                    <button
                      type="button"
                      className="flex h-8 w-full items-center justify-between rounded-md border border-border/60 bg-background pl-2 pr-7 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <span className="truncate">
                        {activeMethods.find((m) => m.id === selectedMethodId)?.name ?? "Método de pago"}
                      </span>
                      <ChevronDown className={cn("pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-transform", methodDropdownOpen && "rotate-180")} />
                    </button>
                    {methodDropdownOpen && (
                      <div className="absolute left-0 top-full z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-background shadow-md">
                        {activeMethods.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => { setSelectedMethodId(m.id); setMethodDropdownOpen(false); }}
                            className={cn(
                              "flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted",
                              selectedMethodId === m.id && "bg-primary/5 font-medium text-primary",
                            )}
                          >
                            <span className="truncate">{m.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="h-8 shrink-0"
                    onClick={() => handlePaySplit(s.id)}
                    disabled={pay.isPending}
                  >
                    Confirmar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 shrink-0"
                    onClick={cancelPaySplit}
                    disabled={pay.isPending}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Monto"
          inputMode="decimal"
          className="h-9"
        />
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Nota (opcional)"
          className="h-9"
        />
        <Button size="sm" className="h-9 shrink-0" onClick={() => create.mutate()} disabled={create.isPending || !amount}>
          Agregar pago
        </Button>
      </div>
    </div>
  );
}
