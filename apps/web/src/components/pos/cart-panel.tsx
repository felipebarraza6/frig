"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  CheckCircle2,
  Loader2,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore, cartTotal } from "@/lib/store/cart";
import { formatCLP, cn } from "@/lib/utils";
import { createOrder, cartToOrderItems } from "@/lib/api/orders";
import { fetchPaymentMethods, createPayment } from "@/lib/api/payments";

export default function CartPanel() {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const { data: paymentMethods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  const total = cartTotal(items);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  async function handleRegister() {
    if (items.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    setDone(null);
    try {
      const order = await createOrder({ items: cartToOrderItems(items) });
      if (paymentMethodId) {
        await createPayment({
          payment_method_id: paymentMethodId,
          order_id: order.id,
          amount: total.toFixed(2),
          status: "COMPLETED",
        });
      }
      clear();
      setPaymentMethodId(null);
      setDone(`Venta registrada (orden ${order.id.slice(0, 8)})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar la venta");
    } finally {
      setSaving(false);
    }
  }

  const selectedMethod = paymentMethods?.find((m) => m.id === paymentMethodId);

  return (
    <aside className="flex w-96 flex-col border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <ShoppingCart className="h-4 w-4" />
        <h2 className="text-sm font-semibold">Cuenta</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {itemCount} {itemCount === 1 ? "ítem" : "ítems"}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {items.length === 0 ? (
          <div className="grid flex-1 place-items-center p-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">Carrito vacío</p>
              <p className="max-w-56 text-xs text-muted-foreground">
                Agrega productos tocando el catálogo para armar la cuenta.
              </p>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2 p-3 pb-2">
              {items.map((item) => (
                <motion.li
                  key={item.product.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCLP(item.product.price)} c/u
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.product.id)}
                      aria-label={`Quitar ${item.product.name}`}
                      className="text-muted-foreground transition-colors hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity - 1)
                        }
                        aria-label="Disminuir cantidad"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.product.id, item.quantity + 1)
                        }
                        aria-label="Aumentar cantidad"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border transition-colors hover:bg-muted"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCLP(item.product.price * item.quantity)}
                    </span>
                  </div>
                </motion.li>
              ))}
            </ul>

            <div className="flex flex-col gap-2 px-3 pb-3">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Banknote className="h-3.5 w-3.5" />
                Método de pago
              </label>
              <select
                value={paymentMethodId ?? ""}
                onChange={(e) => setPaymentMethodId(e.target.value || null)}
                className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Método de pago"
              >
                <option value="">Cuenta abierta (sin cobrar)</option>
                {paymentMethods?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name ?? m.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border p-4">
        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
        )}
        {done && (
          <p
            className={cn(
              "flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700",
            )}
          >
            <CheckCircle2 className="h-4 w-4" />
            {done}
          </p>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total</span>
          <span className="text-lg font-semibold tabular-nums">{formatCLP(total)}</span>
        </div>
        <Button size="lg" disabled={items.length === 0 || saving} onClick={handleRegister}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {selectedMethod ? "Cobrando…" : "Registrando…"}
            </>
          ) : selectedMethod ? (
            `Cobrar ${formatCLP(total)}`
          ) : (
            "Registrar venta"
          )}
        </Button>
      </div>
    </aside>
  );
}
