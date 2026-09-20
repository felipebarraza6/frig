"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCLP } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { returnOrderProducts } from "@/lib/api/orders";

export interface ReturnRow {
  id: string | number;
  name: string;
  max: number;
  unitPrice: string | number;
  lineTotal?: string | number;
}

function clampQty(raw: string, max: number): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, Math.max(0, max));
}

function LineReturnControls({
  orderId,
  product,
}: {
  orderId: string;
  product: ReturnRow;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const max = Number(product.max) || 0;
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const current = clampQty(qty, max);

  const ret = useMutation({
    mutationFn: () => {
      if (current <= 0) {
        throw new Error("Indica cuántas unidades devolver de este producto.");
      }
      const note = reason.trim();
      return returnOrderProducts(orderId, {
        items: [
          {
            order_product_id: product.id,
            quantity_to_return: current,
            ...(note ? { reason: note } : {}),
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Se devolvió ${current} de “${product.name}”. El resto de la orden se mantiene.`);
      setQty("");
      setReason("");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo devolver este producto"),
  });

  if (max <= 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          aria-label={`Quitar una unidad de ${product.name}`}
          disabled={current <= 0 || ret.isPending}
          onClick={() => setQty(String(Math.max(0, current - 1)))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <Input
          value={qty}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d]/g, "");
            if (raw === "") {
              setQty("");
              return;
            }
            setQty(String(clampQty(raw, max)));
          }}
          placeholder="0"
          inputMode="numeric"
          className="h-8 w-12 text-center tabular-nums"
          aria-label={`Cantidad a devolver de ${product.name}`}
        />
        <button
          type="button"
          aria-label={`Agregar una unidad de ${product.name}`}
          disabled={current >= max || ret.isPending}
          onClick={() => setQty(String(Math.min(max, current + 1)))}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 border-danger/30 px-2 text-danger hover:bg-danger/5"
          disabled={current <= 0}
          isLoading={ret.isPending}
          onClick={() => ret.mutate()}
        >
          <Undo2 className="mr-1 h-3.5 w-3.5" />
          Devolver
        </Button>
      </div>
      {current > 0 && (
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo de esta devolución (opcional)"
          className="h-8 text-xs"
        />
      )}
    </div>
  );
}

/** Lista de productos de la orden. Si canReturn, cada línea se devuelve por separado. */
export function OrderProductLines({
  orderId,
  products,
  canReturn,
}: {
  orderId: string;
  products: ReturnRow[];
  canReturn: boolean;
}) {
  if (products.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Productos</p>
      {canReturn && (
        <p className="mt-1 text-xs text-muted-foreground">
          Devolución por producto: indica la cantidad de esa línea y pulsa Devolver. No anula la orden.
        </p>
      )}
      <div className="mt-2 flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
        {products.map((p) => (
          <div key={String(p.id)} className="px-3 py-2.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  x{p.max} · {formatCLP(p.unitPrice ?? 0)} c/u
                </p>
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {formatCLP(p.lineTotal ?? 0)}
              </p>
            </div>
            {canReturn && <LineReturnControls orderId={orderId} product={p} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/** @deprecated usar OrderProductLines */
export function OrderReturnPanel(props: { orderId: string; products: ReturnRow[] }) {
  return <OrderProductLines {...props} canReturn />;
}
