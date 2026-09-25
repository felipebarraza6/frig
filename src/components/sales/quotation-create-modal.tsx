"use client";

import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, Trash2, History, Package, PackageSearch, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { ProductPickerDrawer } from "@/components/sales/product-picker-drawer";
import { formatCLP } from "@/lib/utils";
import { isValidRUT, isPositiveAmount, isNonNegativeNumber } from "@/lib/validation";
import { useToast } from "@/lib/store/toast";
import { createQuotation, updateQuotation, type Quotation } from "@/lib/api/quotations";
import { searchCustomers, createCustomer } from "@/lib/api/customers";
import { fetchOrders } from "@/lib/api/orders";
import { searchProductsForSale } from "@/lib/api/products";
import { useCurrentBranch } from "@/lib/store/session";
import { useRecentPickerSuggestions } from "@/lib/hooks/useRecentPickerSuggestions";
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
  // Drawer de catálogo: selección visual por categoría sin escribir.
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientDni, setNewClientDni] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newClientError, setNewClientError] = useState<string | null>(null);

  const branch = useCurrentBranch();
  const branchId = branch?.branch_id !== undefined && branch?.branch_id !== null ? Number(branch.branch_id) : undefined;

  const [debouncedClient, setDebouncedClient] = useState(clientSearch);
  const [debouncedProduct, setDebouncedProduct] = useState(productSearch);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedClient(clientSearch), 150);
    return () => window.clearTimeout(t);
  }, [clientSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedProduct(productSearch), 150);
    return () => window.clearTimeout(t);
  }, [productSearch]);

  // Al abrir: primeros 20. Al escribir: search del API (nombre, RUT, teléfono).
  const { recentClients, recentProducts } = useRecentPickerSuggestions(true);

  const customersQuery = useQuery({
    queryKey: ["customers", "search", debouncedClient, branchId],
    queryFn: () => searchCustomers(debouncedClient, branchId),
    enabled: debouncedClient.trim().length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const clientOptions = useMemo(() => {
    const recents = recentClients.map((c) => ({
      value: String(c.id),
      label: c.name,
      description:
        [c.dni, c.phone_number].filter(Boolean).join(" · ") || "Reciente",
    }));
    const q = debouncedClient.trim();
    if (!q) {
      const options = recents;
      if (client && !options.some((o) => o.value === String(client.id))) {
        return [
          { value: String(client.id), label: client.name ?? "Sin nombre" },
          ...options,
        ];
      }
      return options;
    }
    const found = (customersQuery.data ?? []).map((c) => ({
      value: String(c.id),
      label: c.name ?? "Sin nombre",
      description: [c.dni, c.phone_number].filter(Boolean).join(" · ") || undefined,
    }));
    const merged = [...found];
    for (const r of recents) {
      if (!merged.some((o) => o.value === r.value)) merged.push(r);
    }
    if (client && !merged.some((o) => o.value === String(client.id))) {
      merged.unshift({
        value: String(client.id),
        label: client.name ?? "Sin nombre",
        description: undefined,
      });
    }
    return merged;
  }, [customersQuery.data, recentClients, client, debouncedClient]);

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
    queryKey: ["quotation-create", "products-for-sale", debouncedProduct],
    queryFn: () => searchProductsForSale({ search: debouncedProduct.trim() }),
    enabled: debouncedProduct.trim().length > 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const productResults = productsQuery.data ?? [];
  const productOptions = useMemo(() => {
    const recents = recentProducts.map((p) => ({
      value: String(p.id),
      label: p.name,
      description: [p.code, formatCLP(p.price)].filter(Boolean).join(" · ") || "Más usado",
    }));
    const q = debouncedProduct.trim();
    if (!q) return recents;
    const found = productResults.map((p) => ({
      value: String(p.id),
      label: p.name,
      description: [p.code, formatCLP(Number(p.price ?? 0) || 0)].filter(Boolean).join(" · "),
    }));
    const merged = [...found];
    for (const r of recents) {
      if (!merged.some((o) => o.value === r.value)) merged.push(r);
    }
    return merged;
  }, [productResults, recentProducts, debouncedProduct]);

  const createClientMutation = useMutation({
    mutationFn: () =>
      createCustomer({
        name: newClientName.trim(),
        dni: newClientDni.trim() || undefined,
        phone_number: newClientPhone.trim() || undefined,
        is_active: true,
      }),
    onSuccess: (created) => {
      setClient(created);
      setShowCreateClient(false);
      setNewClientName("");
      setNewClientDni("");
      setNewClientPhone("");
      toast.success("Cliente creado");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo crear el cliente"),
  });

  function handleCreateClient() {
    setNewClientError(null);
    const dni = newClientDni.trim();
    if (dni && !isValidRUT(dni)) {
      setNewClientError("El RUT ingresado no es válido.");
      return;
    }
    createClientMutation.mutate();
  }

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

  // Cantidad total por producto para el drawer de catálogo.
  const quantitiesByProduct = useMemo(() => {
    const map = new Map<number, number>();
    for (const i of items) {
      const qty = Number.parseInt(i.quantity, 10) || 0;
      map.set(i.productId, (map.get(i.productId) ?? 0) + qty);
    }
    return map;
  }, [items]);

  function decrementProduct(p: { id: number }) {
    setItems((prev) => {
      const line = prev.find((i) => i.productId === p.id);
      if (!line) return prev;
      const qty = (Number.parseInt(line.quantity, 10) || 0) - 1;
      if (qty <= 0) return prev.filter((i) => i.productId !== p.id);
      return prev.map((i) =>
        i.productId === p.id ? { ...i, quantity: String(qty) } : i,
      );
    });
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
      return isPositiveAmount(qty) && isNonNegativeNumber(price);
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
      if (!isPositiveAmount(qty)) {
        setFormError(`La cantidad de "${item.name}" debe ser mayor a 0.`);
        return;
      }
      const price = Number.parseFloat(item.unitPrice);
      if (!isNonNegativeNumber(price)) {
        setFormError(`El precio unitario de "${item.name}" debe ser mayor o igual a 0.`);
        return;
      }
    }
    save.mutate();
  }

  return (
    <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-xl md:border">
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
            <SearchableSelect
              options={clientOptions}
              value={client ? String(client.id) : ""}
              onChange={(value) => {
                if (!value) {
                  setClient(null);
                  return;
                }
                const found = (customersQuery.data ?? []).find((c) => String(c.id) === value);
                if (found) {
                  setClient(found);
                  return;
                }
                const opt = clientOptions.find((o) => o.value === value);
                setClient(opt ? ({ id: Number(opt.value), name: opt.label } as Client) : null);
              }}
              onQueryChange={setClientSearch}
              minChars={0}
              loading={customersQuery.isFetching}
              clearable
              selectedOption={
                client ? { value: String(client.id), label: client.name ?? "Sin nombre" } : null
              }
              placeholder="Buscar cliente por nombre, RUT o teléfono…"
              searchPlaceholder="Nombre, RUT o teléfono…"
              emptyMessage="Sin coincidencias"
            />
            {!showCreateClient ? (
              <button
                type="button"
                onClick={() => {
                  setShowCreateClient(true);
                  setNewClientName(clientSearch.trim());
                }}
                className="self-start text-xs font-medium text-primary hover:underline"
              >
                + Crear cliente nuevo
              </button>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Nuevo cliente</span>
                  <button
                    type="button"
                    onClick={() => setShowCreateClient(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </div>
                <Input
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Nombre *"
                  className="h-9"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={newClientDni}
                    onChange={(e) => setNewClientDni(e.target.value)}
                    placeholder="RUT / DNI"
                    className="h-9"
                  />
                  <Input
                    value={newClientPhone}
                    onChange={(e) => setNewClientPhone(e.target.value)}
                    placeholder="Teléfono"
                    className="h-9"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="self-end"
                  disabled={!newClientName.trim()}
                  isLoading={createClientMutation.isPending}
                  onClick={handleCreateClient}
                >
                  Guardar cliente
                </Button>
                {newClientError && <p className="text-xs text-danger">{newClientError}</p>}
              </div>
            )}
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
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-left text-xs shadow-sm transition-colors hover:border-primary/40"
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
            <div className="flex items-center gap-2">
              <SearchableSelect
                options={productOptions}
                value=""
                onChange={(value) => {
                  const fromSearch = productResults.find((x) => String(x.id) === value);
                  const fromRecent = recentProducts.find((x) => String(x.id) === value);
                  const p = fromSearch ?? fromRecent;
                  if (!p) return;
                  addProduct({ id: p.id, name: p.name, price: p.price, sale_price: p.price });
                  setProductSearch("");
                  setDebouncedProduct("");
                }}
                onQueryChange={setProductSearch}
                minChars={0}
                loading={productsQuery.isFetching}
                placeholder="Buscar producto por nombre o código…"
                searchPlaceholder="Nombre o SKU…"
                emptyMessage={
                  productsQuery.isError ? "No se pudo buscar productos" : "Sin coincidencias"
                }
              />
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                title="Ver catálogo por categoría"
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Package className="h-4 w-4 text-primary" />
                Catálogo
              </button>
            </div>

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
                      className="rounded-xl border border-border/60 bg-background p-3"
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
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-[border-color,box-shadow] duration-150 placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
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

      <ProductPickerDrawer
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        quantitiesByProduct={quantitiesByProduct}
        onAdd={addProduct}
        onDecrement={decrementProduct}
        zIndex="z-[80]"
      />
    </div>
  );
}
