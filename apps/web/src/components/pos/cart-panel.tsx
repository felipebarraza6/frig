"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  CheckCircle2,
  Loader2,
  Banknote,
  User,
  X,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useCartStore, cartTotal } from "@/lib/store/cart";
import { formatCLP, cn } from "@/lib/utils";
import { createOrder, cartToOrderItems } from "@/lib/api/orders";
import { fetchPaymentMethods, createPayment } from "@/lib/api/payments";
import { searchCustomers, createCustomer, type CustomerPayload } from "@/lib/api/customers";
import type { YggdraSchemas } from "@/lib/api/types";

type Customer = YggdraSchemas["Client"];

function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function CartPanel() {
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const clear = useCartStore((s) => s.clear);

  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [showClientResults, setShowClientResults] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const debouncedClientQuery = useDebounce(clientQuery, 300);

  const { data: paymentMethods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  const { data: customerResults = [], isLoading: searchingCustomers } = useQuery({
    queryKey: ["customers", "search", debouncedClientQuery],
    queryFn: () => searchCustomers(debouncedClientQuery),
    enabled: debouncedClientQuery.trim().length >= 2,
  });

  const createCustomerMutation = useMutation({
    mutationFn: (payload: CustomerPayload) => createCustomer(payload),
    onSuccess: (customer) => {
      setSelectedClient(customer);
      setCreateModalOpen(false);
      setClientQuery("");
      setShowClientResults(false);
    },
  });

  const total = cartTotal(items);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  async function handleRegister() {
    if (items.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    setDone(null);
    try {
      const order = await createOrder({
        items: cartToOrderItems(items),
        client_id: selectedClient?.id ?? null,
      });
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
      setSelectedClient(null);
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
                <User className="h-3.5 w-3.5" />
                Cliente
              </label>
              {selectedClient ? (
                <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{selectedClient.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {selectedClient.dni ?? selectedClient.phone_number ?? selectedClient.email ?? "Sin datos adicionales"}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    aria-label="Quitar cliente"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={clientQuery}
                    onChange={(e) => {
                      setClientQuery(e.target.value);
                      setShowClientResults(true);
                    }}
                    onFocus={() => setShowClientResults(true)}
                    placeholder="Buscar cliente…"
                    className="pl-9 pr-16"
                    aria-label="Buscar cliente"
                  />
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-primary hover:underline"
                  >
                    + Nuevo
                  </button>
                  <AnimatePresence>
                    {showClientResults && clientQuery.trim().length >= 2 && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg"
                      >
                        {searchingCustomers ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>
                        ) : customerResults.length === 0 ? (
                          <p className="px-3 py-2 text-xs text-muted-foreground">No se encontraron clientes.</p>
                        ) : (
                          customerResults.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedClient(c);
                                setClientQuery("");
                                setShowClientResults(false);
                              }}
                              className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted"
                            >
                              <span className="text-sm font-medium">{c.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {c.dni ?? c.phone_number ?? c.email ?? "—"}
                              </span>
                            </button>
                          ))
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 px-3 pb-3">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Banknote className="h-3.5 w-3.5" />
                Método de pago
              </label>
              <Select
                value={paymentMethodId ?? ""}
                onChange={(e) => setPaymentMethodId(e.target.value || null)}
                aria-label="Método de pago"
              >
                <option value="">Cuenta abierta (sin cobrar)</option>
                {paymentMethods?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name ?? m.name}
                  </option>
                ))}
              </Select>
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

      {createModalOpen && (
        <CustomerCreateModal
          onClose={() => setCreateModalOpen(false)}
          onSubmit={(payload) => createCustomerMutation.mutate(payload)}
          isPending={createCustomerMutation.isPending}
          error={createCustomerMutation.error}
        />
      )}
    </aside>
  );
}

function CustomerCreateModal({
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  onClose: () => void;
  onSubmit: (payload: CustomerPayload) => void;
  isPending: boolean;
  error: Error | null;
}) {
  const [form, setForm] = useState<CustomerPayload>({
    name: "",
    dni: "",
    phone_number: "",
    email: "",
    commercial_business: "",
    address: "",
    is_active: true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Nuevo cliente rápido</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="quick-customer-name" className="text-sm font-medium">Nombre</label>
            <Input
              id="quick-customer-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Ej: Juan Pérez"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="quick-customer-dni" className="text-sm font-medium">RUT/DNI</label>
            <Input
              id="quick-customer-dni"
              value={form.dni ?? ""}
              onChange={(e) => setForm({ ...form, dni: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="quick-customer-phone" className="text-sm font-medium">Teléfono</label>
            <Input
              id="quick-customer-phone"
              value={form.phone_number ?? ""}
              onChange={(e) => setForm({ ...form, phone_number: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <label htmlFor="quick-customer-email" className="text-sm font-medium">Email</label>
            <Input
              id="quick-customer-email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          {error && (
            <p className="text-sm text-danger sm:col-span-2">
              {error instanceof Error ? error.message : "Error al crear el cliente"}
            </p>
          )}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear y seleccionar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
