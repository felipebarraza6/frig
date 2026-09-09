"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Trash2, History, Package, Search, PackageSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { formatCLP } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { createQuotation, updateQuotation, type Quotation } from "@/lib/api/quotations";
import { searchCustomers } from "@/lib/api/customers";
import { fetchOrders } from "@/lib/api/orders";
import { fetchProducts } from "@/lib/api/products";
import { useCurrentBranch } from "@/lib/store/session";
import type { YggdraSchemas } from "@/lib/api/types";

type Client = YggdraSchemas["Client"];

interface DraftItem {
  productId: number;
  name: string;
  unitPrice: string;
  quantity: string;
}

/** Producto con el último precio vendido, derivado del historial del cliente. */
interface HistoryProduct {
  productId: number;
  name: string;
  unitPrice: number;
}

function priceOf(p: { sale_price?: unknown; price?: unknown }): string {
  const sale = Number.parseFloat(String(p.sale_price ?? "")) || 0;
  const base = sale > 0 ? sale : Number.parseFloat(String(p.price ?? "0")) || 0;
  return base.toFixed(2);
}

export function QuotationCreateModal({
  open,
  onClose,
  quotation,
}: {
  open: boolean;
  onClose: () => void;
  /** Si viene, el modal funciona en modo edición de esa cotización. */
  quotation?: Quotation | null;
}) {
  return (
    <AnimatedOverlay open={open} onClose={onClose} zIndex="z-[70]" panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4">
      {/* El formulario se remonta al abrir/cerrar o cambiar de cotización, así
          el estado inicial siempre refleja el modo (crear vs editar) sin
          necesidad de effects. */}
      <QuotationForm
        key={`${open}-${quotation?.id ?? "new"}`}
        quotation={quotation ?? null}
        onClose={onClose}
      />
    </AnimatedOverlay>
  );
}

function QuotationForm({
  quotation,
  onClose,
}: {
  quotation: Quotation | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const editingId = quotation?.id ?? null;

  const [client, setClient] = useState<Client | null>(
    quotation?.client
      ? ({ id: quotation.client.id, name: quotation.client.name } as Client)
      : null,
  );
  const [clientSearch, setClientSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [items, setItems] = useState<DraftItem[]>(() =>
    (quotation?.products ?? []).map((p) => ({
      productId: p.product,
      name: p.product_name,
      unitPrice: (Number(p.unit_price ?? 0) || 0).toFixed(2),
      quantity: String(p.quantity ?? 1),
    })),
  );
  const [observation, setObservation] = useState(quotation?.observation ?? "");
  /** Fecha de vencimiento en formato yyyy-mm-dd (input type="date"). */
  const [expiration, setExpiration] = useState(quotation?.expiration_date?.slice(0, 10) ?? "");
  const [formError, setFormError] = useState<string | null>(null);

  const branch = useCurrentBranch();
  const branchId = branch?.branch_id !== undefined && branch?.branch_id !== null ? Number(branch.branch_id) : undefined;

  const [debouncedClient, setDebouncedClient] = useState(clientSearch);
  const [debouncedProduct, setDebouncedProduct] = useState(productSearch);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedClient(clientSearch), 300);
    return () => window.clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedProduct(productSearch), 300);
    return () => window.clearTimeout(t);
  }, [productSearch]);

  // Clientes: búsqueda server-side con debounce; el seleccionado se inyecta
  // al inicio de las opciones para que el select nunca quede sin etiqueta.
  const customersQuery = useQuery({
    queryKey: ["customers", "search", debouncedClient, branchId],
    queryFn: () => searchCustomers(debouncedClient, branchId),
    enabled: debouncedClient.trim().length >= 2,
    staleTime: 30_000,
  });

  const clientOptions = useMemo(() => {
    const found = customersQuery.data ?? [];
    const options = found.map((c) => ({ value: String(c.id), label: c.name ?? "Sin nombre" }));
    if (client && !options.some((o) => o.value === String(client.id))) {
      return [{ value: String(client.id), label: client.name ?? "Sin nombre" }, ...options];
    }
    return options;
  }, [customersQuery.data, client]);

  // Historial del cliente: últimas órdenes completadas, para sugerir productos
  // con su último precio unitario vendido.
  const historyQuery = useQuery({
    queryKey: ["quotation-create", "client-history", client?.id],
    queryFn: () =>
      fetchOrders({
        client__in: String(client!.id),
        status: "COMPLETED",
        page_size: 20,
      }),
    enabled: !!client,
    staleTime: 60_000,
  });

  const historyProducts = useMemo<HistoryProduct[]>(() => {
    const orders = [...(historyQuery.data?.results ?? [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    const seen = new Map<number, HistoryProduct>();
    for (const order of orders) {
      for (const p of order.products ?? []) {
        if (!seen.has(p.product)) {
          seen.set(p.product, {
            productId: p.product,
            name: p.product_name,
            unitPrice: Number(p.unit_price ?? 0) || 0,
          });
        }
      }
    }
    return Array.from(seen.values()).slice(0, 10);
  }, [historyQuery.data]);

  const productsQuery = useQuery({
    queryKey: ["quotation-create", "products", debouncedProduct, branchId],
    queryFn: () => fetchProducts({ search: debouncedProduct, is_for_sale: true, is_active: true, page_size: 10 }),
    enabled: debouncedProduct.trim().length >= 2,
  });

  const productResults = (() => {
    const d = productsQuery.data;
    if (!d) return [];
    if (Array.isArray(d.results)) return d.results;
    return [];
  })();

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        items: items.map((i) => ({
          product: i.productId,
          quantity: Number.parseInt(i.quantity, 10) || 0,
          unit_price: i.unitPrice,
        })),
        observation: observation.trim() || null,
        client_id: client ? Number(client.id) : null,
        expiration_date: expiration || null,
      };
      return editingId ? updateQuotation(editingId, payload) : createQuotation(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      if (editingId) queryClient.invalidateQueries({ queryKey: ["quotation", editingId] });
      toast.success(editingId ? "Cotización actualizada" : "Cotización creada");
      onClose();
    },
    onError: (err: Error) =>
      toast.error(
        err.message || (editingId ? "No se pudo actualizar la cotización" : "No se pudo crear la cotización"),
      ),
  });

  function addProduct(p: { id: number; name: string; sale_price?: unknown; price?: unknown }, suggestedPrice?: number) {
    setItems((prev) => {
      const found = prev.find((i) => i.productId === p.id);
      if (found) {
        const qty = (Number.parseInt(found.quantity, 10) || 0) + 1;
        return prev.map((i) => (i.productId === p.id ? { ...i, quantity: String(qty) } : i));
      }
      const unitPrice = suggestedPrice !== undefined ? suggestedPrice.toFixed(2) : priceOf(p);
      return [...prev, { productId: p.id, name: p.name, unitPrice, quantity: "1" }];
    });
  }

  function updateItem(productId: number, field: "quantity" | "unitPrice", value: string) {
    setItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, [field]: value } : i)),
    );
  }

  function removeItem(productId: number) {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  const total = items.reduce(
    (acc, i) => acc + (Number.parseFloat(i.unitPrice) || 0) * (Number.parseInt(i.quantity, 10) || 0),
    0,
  );

  const isValid =
    !!client &&
    items.length > 0 &&
    items.every((i) => {
      const qty = Number.parseInt(i.quantity, 10);
      const price = Number.parseFloat(i.unitPrice);
      return Number.isFinite(qty) && qty >= 1 && Number.isFinite(price) && price >= 0;
    });

  function handleSubmit() {
    setFormError(null);
    if (!client) {
      setFormError("Selecciona un cliente para la cotización.");
      return;
    }
    if (items.length === 0) {
      setFormError("Agrega al menos un producto a la cotización.");
      return;
    }
    for (const item of items) {
      const qty = Number.parseInt(item.quantity, 10);
      if (!Number.isFinite(qty) || qty < 1) {
        setFormError(`La cantidad de "${item.name}" debe ser mayor o igual a 1.`);
        return;
      }
      const price = Number.parseFloat(item.unitPrice);
      if (!Number.isFinite(price) || price < 0) {
        setFormError(`El precio unitario de "${item.name}" debe ser mayor o igual a 0.`);
        return;
      }
    }
    save.mutate();
  }

  return (
    <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-xl md:border">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold">
          {editingId ? "Editar cotización" : "Nueva cotización"}
        </h2>
        <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              Cliente <span className="text-danger">*</span>
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder="Buscar cliente por nombre…"
                className="pl-9"
                aria-label="Buscar cliente"
              />
            </div>
            <SearchableSelect
              options={clientOptions}
              value={client ? String(client.id) : ""}
              onChange={(value) => {
                const found = clientOptions.find((o) => o.value === value);
                setClient(found ? ({ id: Number(found.value), name: found.label } as Client) : null);
              }}
              placeholder={clientOptions.length === 0 ? "Busca con el campo de arriba…" : "Seleccionar cliente…"}
              searchPlaceholder="Filtrar resultados…"
              emptyMessage={customersQuery.isLoading ? "Buscando…" : "Sin coincidencias"}
            />
            <p className="text-xs text-muted-foreground">
              Escribe al menos 2 caracteres para buscar por nombre.
            </p>
          </div>

          {/* Historial del cliente: sugiere productos ya comprados con su último precio. */}
          {client && (
            <div className="flex flex-col gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Últimos productos del cliente
              </p>
              {historyQuery.isLoading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-36 rounded-lg" />
                  ))}
                </div>
              ) : historyProducts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {historyProducts.map((p) => (
                    <button
                      key={p.productId}
                      type="button"
                      onClick={() => addProduct({ id: p.productId, name: p.name }, p.unitPrice)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-left text-xs shadow-sm transition-colors hover:border-primary/40"
                      title={`Agregar con último precio: ${formatCLP(p.unitPrice)}`}
                    >
                      <Package className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="min-w-0">
                        <span className="block max-w-40 truncate font-medium">{p.name}</span>
                        <span className="block tabular-nums text-muted-foreground">{formatCLP(p.unitPrice)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  <PackageSearch className="h-3.5 w-3.5 shrink-0" />
                  Sin historial: busca productos abajo.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Productos</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Buscar producto…"
                className="pl-9"
              />
            </div>
            {productsQuery.isLoading && debouncedProduct.trim().length >= 2 && (
              <p className="text-xs text-muted-foreground">Buscando productos…</p>
            )}
            {productsQuery.isError && (
              <p className="text-xs text-danger">No se pudo buscar productos.</p>
            )}
            {!productsQuery.isLoading && !productsQuery.isError && debouncedProduct.trim().length >= 2 && (
              <p className="text-xs text-muted-foreground">
                {productResults.length === 0
                  ? "Sin productos en tu sucursal para esa búsqueda."
                  : `${productResults.length} resultado${productResults.length === 1 ? "" : "s"}`}
              </p>
            )}
            {productResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">{formatCLP(priceOf(p))}</span>
              </button>
            ))}

            {items.length > 0 && (
              <div className="mt-1 flex flex-col gap-2">
                <p className="text-xs text-muted-foreground">
                  {items.length} ítem{items.length === 1 ? "" : "s"} en la cotización
                </p>
                {items.map((i) => {
                  const qty = Number.parseInt(i.quantity, 10);
                  const price = Number.parseFloat(i.unitPrice);
                  const lineTotal = (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(price) ? price : 0);
                  return (
                    <div
                      key={i.productId}
                      className="rounded-xl border border-border/60 bg-muted/30 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{i.name}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 shrink-0 p-0 text-danger hover:text-danger"
                          onClick={() => removeItem(i.productId)}
                          aria-label="Quitar ítem"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">Cantidad</label>
                          <Input
                            type="number"
                            min="1"
                            value={i.quantity}
                            onChange={(e) => updateItem(i.productId, "quantity", e.target.value)}
                            aria-invalid={Number.isFinite(qty) && qty >= 1 ? undefined : true}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">Precio unitario</label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={i.unitPrice}
                            onChange={(e) => updateItem(i.productId, "unitPrice", e.target.value)}
                            aria-invalid={Number.isFinite(price) && price >= 0 ? undefined : true}
                          />
                        </div>
                      </div>
                      <p className="mt-2 text-right text-xs tabular-nums text-muted-foreground">
                        Subtotal {formatCLP(lineTotal)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="quotation-observation" className="text-sm font-medium">Observación</label>
            <textarea
              id="quotation-observation"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Opcional"
              rows={3}
              className="flex w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="quotation-expiration" className="text-sm font-medium">
              Vencimiento <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Input
              id="quotation-expiration"
              type="date"
              value={expiration}
              onChange={(e) => setExpiration(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Pasada esta fecha la cotización queda sin efecto.
            </p>
          </div>

          <div className="flex justify-end text-sm">
            <span className="text-muted-foreground">Total estimado:</span>
            <span className="ml-2 font-semibold tabular-nums">{formatCLP(total)}</span>
          </div>

          {formError && (
            <p className="text-sm text-danger">{formError}</p>
          )}
          {save.isError && (
            <p className="text-sm text-danger">
              {save.error instanceof Error ? save.error.message : "Error al guardar"}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={save.isPending}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={!isValid} isLoading={save.isPending}>
          {editingId ? "Guardar cambios" : "Crear cotización"}
        </Button>
      </div>
    </div>
  );
}
