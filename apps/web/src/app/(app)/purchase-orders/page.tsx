"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Loader2, X, Eye, Ban, CheckCircle2, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  fetchPurchaseOrders,
  fetchSuppliers,
  createPurchaseOrder,
  cancelPurchaseOrder,
  markPurchaseOrderCompleted,
  type PurchaseOrderList,
  type PurchaseOrderCreatePayload,
  type SupplierList,
} from "@/lib/api/suppliers";
import { formatCLP } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "SENT", label: "Enviada" },
  { value: "CONFIRMED", label: "Confirmada" },
  { value: "PARTIAL_RECEIVED", label: "Parcial" },
  { value: "RECEIVED", label: "Recibida" },
  { value: "COMPLETED", label: "Completada" },
  { value: "CANCELLED", label: "Anulada" },
];

function statusLabel(value?: string | null): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

const TODAY = new Date().toISOString().slice(0, 10);
const NEXT_WEEK = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState("");
  const [status, setStatus] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrderList | null>(null);
  const [form, setForm] = useState({
    supplier: "",
    order_date: TODAY,
    expected_delivery_date: NEXT_WEEK,
    notes: "",
    description: "",
    quantity: "1",
    unit_price: "",
  });

  const { data: page, isLoading } = useQuery({
    queryKey: ["purchase-orders", { search, supplier, status, pageUrl }],
    queryFn: () => fetchPurchaseOrders({ search, supplier, status, ...pageUrl }),
  });

  const { data: suppliersPage } = useQuery({
    queryKey: ["suppliers", "select"],
    queryFn: () => fetchSuppliers({}),
  });
  const suppliers: SupplierList[] = suppliersPage?.results ?? [];

  const orders: PurchaseOrderList[] = page?.results ?? [];
  const totalOrders = page?.count ?? 0;

  const create = useMutation({
    mutationFn: () => {
      const items: PurchaseOrderCreatePayload["items"] = [
        {
          description: form.description,
          quantity_ordered: Number(form.quantity) || 1,
          unit_price: form.unit_price || "0",
          notes: form.notes || null,
          create_product_if_not_exists: false,
          measurement_unit: "UN",
        },
      ];
      return createPurchaseOrder({
        supplier: form.supplier || null,
        branch: 0,
        order_date: form.order_date,
        expected_delivery_date: form.expected_delivery_date,
        notes: form.notes || null,
        items,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setModalOpen(false);
      setForm({
        supplier: "",
        order_date: TODAY,
        expected_delivery_date: NEXT_WEEK,
        notes: "",
        description: "",
        quantity: "1",
        unit_price: "",
      });
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) => cancelPurchaseOrder(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });

  const complete = useMutation({
    mutationFn: (id: string) => markPurchaseOrderCompleted(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
  });

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Órdenes de compra</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona compras a proveedores
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Nueva orden
        </Button>
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
            <label htmlFor="filter-supplier" className="text-xs text-muted-foreground">Proveedor</label>
            <Select
              id="filter-supplier"
              value={supplier}
              onChange={(e) => updateFilter(setSupplier, e.target.value)}
            >
              <option value="">Todos</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
            <Select
              id="filter-status"
              value={status}
              onChange={(e) => updateFilter(setStatus, e.target.value)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Número</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3">Entrega esperada</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{order.order_number}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{order.supplier_name ?? "—"}</td>
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
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCLP(order.total_amount ?? "0")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{order.expected_delivery_date}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetail(order)}>
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </Button>
                          {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => complete.mutate(order.id)}
                                disabled={complete.isPending}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Completar
                              </Button>
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
                            </>
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Nueva orden de compra</h2>
              <button onClick={() => setModalOpen(false)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <label htmlFor="po-supplier" className="text-sm font-medium">Proveedor</label>
                <Select
                  id="po-supplier"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                >
                  <option value="">Sin proveedor (gasto común)</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="po-date" className="text-sm font-medium">Fecha</label>
                  <Input
                    id="po-date"
                    type="date"
                    value={form.order_date}
                    onChange={(e) => setForm({ ...form, order_date: e.target.value })}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="po-delivery" className="text-sm font-medium">Entrega esperada</label>
                  <Input
                    id="po-delivery"
                    type="date"
                    value={form.expected_delivery_date}
                    onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="po-description" className="text-sm font-medium">Descripción del ítem</label>
                <Input
                  id="po-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  required
                  placeholder="Ej: Caja de vasos 250cc"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label htmlFor="po-qty" className="text-sm font-medium">Cantidad</label>
                  <Input
                    id="po-qty"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="po-price" className="text-sm font-medium">Precio unitario</label>
                  <Input
                    id="po-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unit_price}
                    onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="po-notes" className="text-sm font-medium">Notas</label>
                <Input
                  id="po-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              {create.isError && (
                <p className="text-sm text-danger">
                  {create.error instanceof Error ? create.error.message : "Error al crear"}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={create.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Crear orden
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Orden {detail.order_number}</h2>
              <button onClick={() => setDetail(null)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-col gap-2 text-sm">
              <p><span className="text-muted-foreground">Proveedor:</span> {detail.supplier_name ?? "—"}</p>
              <p><span className="text-muted-foreground">Estado:</span> {statusLabel(detail.status)}</p>
              <p><span className="text-muted-foreground">Total:</span> {formatCLP(detail.total_amount ?? "0")}</p>
              <p><span className="text-muted-foreground">Pagado:</span> {formatCLP(detail.paid_amount ?? "0")}</p>
              <p><span className="text-muted-foreground">Pendiente:</span> {formatCLP(detail.remaining_amount ?? "0")}</p>
              <p><span className="text-muted-foreground">Entrega esperada:</span> {detail.expected_delivery_date}</p>
              <p><span className="text-muted-foreground">Ítems:</span> {detail.items_count}</p>
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
