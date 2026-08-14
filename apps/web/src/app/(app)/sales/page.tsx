"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, ShoppingBag, X, Eye, Ban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { fetchOrders, cancelOrder, type OrdersFilter } from "@/lib/api/orders";
import { formatCLP } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";

type Order = YggdraSchemas["Order"];

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_PROGRESS", label: "En progreso" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Cancelada" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendiente" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "PAID", label: "Pagada" },
  { value: "REFUNDED", label: "Reembolsada" },
];

const ORDER_TYPE_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "SALE", label: "Venta" },
  { value: "ORDER", label: "Pedido" },
  { value: "AGREEMENT", label: "Convenio" },
];

function statusLabel(value?: string | null): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

function paymentStatusLabel(value?: string | null): string {
  return PAYMENT_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

export default function SalesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [orderType, setOrderType] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [detail, setDetail] = useState<Order | null>(null);

  const filter = useMemo<OrdersFilter>(
    () => ({
      search: search || undefined,
      status: status || undefined,
      payment_status: paymentStatus || undefined,
      order_type: orderType || undefined,
      ...pageUrl,
    }),
    [search, status, paymentStatus, orderType, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["orders", filter],
    queryFn: () => fetchOrders(filter),
  });

  const orders = page?.results ?? [];
  const totalOrders = page?.count ?? 0;

  const cancel = useMutation({
    mutationFn: (id: string) => cancelOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
  });

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Ventas y órdenes</h1>
          <p className="text-xs text-muted-foreground">
            Historial de ventas, pedidos y convenios
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="Buscar orden…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
            <Select id="filter-status" value={status} onChange={(e) => updateFilter(setStatus, e.target.value)}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-payment" className="text-xs text-muted-foreground">Pago</label>
            <Select id="filter-payment" value={paymentStatus} onChange={(e) => updateFilter(setPaymentStatus, e.target.value)}>
              {PAYMENT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
            <Select id="filter-type" value={orderType} onChange={(e) => updateFilter(setOrderType, e.target.value)}>
              {ORDER_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar las órdenes.</p>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Pago</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{order.id.slice(0, 8)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {order.client?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {order.order_type === "SALE" ? "Venta" : order.order_type === "ORDER" ? "Pedido" : "Convenio"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            order.status === "COMPLETED"
                              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : order.status === "CANCELLED"
                                ? "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger"
                                : "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700"
                          }
                        >
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {paymentStatusLabel(order.payment_status)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {formatCLP(order.total_amount ?? "0")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(order.date).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetail(order)}>
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </Button>
                          {order.status !== "CANCELLED" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-danger hover:text-danger"
                              onClick={() => cancel.mutate(order.id)}
                              disabled={cancel.isPending}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              Anular
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {totalOrders} orden{totalOrders === 1 ? "" : "es"} en total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Orden {detail.id.slice(0, 8)}</h2>
              <button onClick={() => setDetail(null)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <p><span className="text-muted-foreground">Cliente:</span> {detail.client?.name ?? "—"}</p>
              <p><span className="text-muted-foreground">Tipo:</span> {detail.order_type}</p>
              <p><span className="text-muted-foreground">Estado:</span> {statusLabel(detail.status)}</p>
              <p><span className="text-muted-foreground">Pago:</span> {paymentStatusLabel(detail.payment_status)}</p>
              <p><span className="text-muted-foreground">Total:</span> {formatCLP(detail.total_amount ?? "0")}</p>
              <p><span className="text-muted-foreground">Fecha:</span> {new Date(detail.date).toLocaleString()}</p>
              {detail.observation && (
                <p><span className="text-muted-foreground">Observación:</span> {detail.observation}</p>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setDetail(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
