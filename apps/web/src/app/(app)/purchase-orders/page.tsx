"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Loader2, X, Eye, Ban, CheckCircle2, FileText, SlidersHorizontal } from "lucide-react";
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

function statusBadgeClass(status?: string | null) {
  if (status === "COMPLETED") {
    return "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700";
  }
  if (status === "CANCELLED") {
    return "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger";
  }
  return "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700";
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
  const [showMobileFilters, setShowMobileFilters] = useState(false);
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

  function closeModal() {
    setModalOpen(false);
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Órdenes de compra</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona compras a proveedores
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            onClick={() => setModalOpen(true)}
            className="sm:hidden"
            title="Nueva orden"
            aria-label="Nueva orden"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => setModalOpen(true)}
            className="hidden sm:flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva orden
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-col gap-3">
          {/* Desktop filters */}
          <div className="hidden flex-wrap items-end gap-3 md:flex">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => updateFilter(setSearch, e.target.value)}
                placeholder="Buscar orden…"
                className="pl-9"
                aria-label="Buscar orden"
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

          {/* Mobile filters */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => updateFilter(setSearch, e.target.value)}
                  placeholder="Buscar orden…"
                  className="pl-9"
                  aria-label="Buscar orden"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3"
                onClick={() => setShowMobileFilters((v) => !v)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="ml-2">Filtros</span>
              </Button>
            </div>

            <div className={`flex flex-col gap-3 ${showMobileFilters ? "" : "hidden"}`}>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-supplier-mobile" className="text-xs text-muted-foreground">Proveedor</label>
                <Select
                  id="filter-supplier-mobile"
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
                <label htmlFor="filter-status-mobile" className="text-xs text-muted-foreground">Estado</label>
                <Select
                  id="filter-status-mobile"
                  value={status}
                  onChange={(e) => updateFilter(setStatus, e.target.value)}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : orders.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No se encontraron órdenes</p>
              <p className="text-xs text-muted-foreground">
                Prueba con otros filtros o crea una nueva orden de compra.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
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
                        <span className={statusBadgeClass(order.status)}>
                          {statusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{formatCLP(order.total_amount ?? "0")}</td>
                      <td className="px-4 py-3 text-muted-foreground">{order.expected_delivery_date}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setDetail(order)}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
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
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                Completar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-danger hover:text-danger"
                                onClick={() => cancel.mutate(order.id)}
                                disabled={cancel.isPending}
                              >
                                <Ban className="mr-1.5 h-3.5 w-3.5" />
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

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">{order.supplier_name ?? "Sin proveedor"}</p>
                        <span className={`mt-1 inline-flex ${statusBadgeClass(order.status)}`}>
                          {statusLabel(order.status)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Ver"
                        aria-label="Ver"
                        onClick={() => setDetail(order)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span className="sr-only">Ver</span>
                      </Button>
                      {order.status !== "CANCELLED" && order.status !== "COMPLETED" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Completar"
                            aria-label="Completar"
                            onClick={() => complete.mutate(order.id)}
                            disabled={complete.isPending}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span className="sr-only">Completar</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-danger hover:text-danger"
                            title="Anular"
                            aria-label="Anular"
                            onClick={() => cancel.mutate(order.id)}
                            disabled={cancel.isPending}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            <span className="sr-only">Anular</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Total</span>
                      <span className="font-medium tabular-nums text-foreground">{formatCLP(order.total_amount ?? "0")}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Entrega esperada</span>
                      <span className="font-medium text-foreground">{order.expected_delivery_date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
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
                  <span className="sm:hidden">Ant.</span>
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  <span className="sm:hidden">Sig.</span>
                  <span className="hidden sm:inline">Siguiente</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Nueva orden de compra</h2>
              <button onClick={closeModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate();
              }}
              className="flex flex-1 flex-col overflow-hidden"
              id="po-form"
            >
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-4">
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
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
                <Button type="button" variant="outline" onClick={closeModal} disabled={create.isPending}>
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
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">Orden {detail.order_number}</h2>
              <button onClick={() => setDetail(null)} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-2 text-sm">
                <p><span className="text-muted-foreground">Proveedor:</span> {detail.supplier_name ?? "—"}</p>
                <p><span className="text-muted-foreground">Estado:</span> {statusLabel(detail.status)}</p>
                <p><span className="text-muted-foreground">Total:</span> {formatCLP(detail.total_amount ?? "0")}</p>
                <p><span className="text-muted-foreground">Pagado:</span> {formatCLP(detail.paid_amount ?? "0")}</p>
                <p><span className="text-muted-foreground">Pendiente:</span> {formatCLP(detail.remaining_amount ?? "0")}</p>
                <p><span className="text-muted-foreground">Entrega esperada:</span> {detail.expected_delivery_date}</p>
                <p><span className="text-muted-foreground">Ítems:</span> {detail.items_count}</p>
              </div>
            </div>
            <div className="flex shrink-0 justify-end border-t border-border px-4 py-3">
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
