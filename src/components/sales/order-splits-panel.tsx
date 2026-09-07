"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCLP } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import {
  fetchOrderSplits,
  createOrderSplit,
  payOrderSplit,
  cancelOrderSplit,
} from "@/lib/api/order-splits";

export function OrderSplitsPanel({ orderId, orderTotal }: { orderId: string; orderTotal: string | number }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const splitsQuery = useQuery({
    queryKey: ["orders", orderId, "splits"],
    queryFn: () => fetchOrderSplits(orderId),
  });

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
      toast.success("División creada");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo crear la división"),
  });

  const pay = useMutation({
    mutationFn: (id: number) => payOrderSplit(id),
    onSuccess: () => {
      refresh();
      toast.success("División pagada");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo pagar la división"),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => cancelOrderSplit(id),
    onSuccess: () => {
      refresh();
      toast.success("División anulada");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo anular la división"),
  });

  const splits = splitsQuery.data ?? [];

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Divisiones de cuenta · {formatCLP(orderTotal ?? "0")}
      </p>
      {splitsQuery.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">Cargando divisiones…</p>
      ) : splits.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Sin divisiones, crea la primera abajo.</p>
      ) : (
        <div className="mt-2 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
          {splits.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">División {s.split_number}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.status ?? "PENDING"}
                  {s.payment_method_name ? ` · ${s.payment_method_name}` : ""}
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">{formatCLP(s.amount ?? 0)}</p>
              <div className="flex shrink-0 gap-1.5">
                {s.status !== "PAID" && s.status !== "CANCELLED" && (
                  <Button size="sm" variant="outline" className="h-8" onClick={() => pay.mutate(s.id)} disabled={pay.isPending}>
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
          ))}
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
          Dividir
        </Button>
      </div>
    </div>
  );
}
