"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, Plus, X, AlertTriangle, Package } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  fetchInventoryMovements,
  createInventoryMovement,
  fetchLowStock,
  fetchOutOfStock,
  type MovementsFilter,
} from "@/lib/api/inventory";
import { fetchProducts } from "@/lib/api/products";
import { fetchWarehouses } from "@/lib/api/warehouses";
import type { YggdraSchemas } from "@/lib/api/types";

type InventoryHistory = YggdraSchemas["InventoryHistory"];

const MOVEMENT_TYPES = [
  { value: "IN", label: "Entrada" },
  { value: "OUT", label: "Salida" },
  { value: "ADJUSTMENT", label: "Ajuste" },
  { value: "RETURN", label: "Devolución" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "LOSS", label: "Pérdida" },
  { value: "DAMAGE", label: "Daño" },
] as const;

const SOURCE_TYPES = [
  { value: "MANUAL", label: "Manual" },
  { value: "PURCHASE", label: "Compra" },
  { value: "SALE", label: "Venta" },
  { value: "INTERNAL_USE", label: "Uso interno" },
  { value: "PRODUCTION", label: "Producción" },
] as const;

function movementLabel(value?: string | null): string {
  return MOVEMENT_TYPES.find((t) => t.value === value)?.label ?? (value ?? "—");
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"movements" | "alerts">("movements");
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);

  const { data: productsPage } = useQuery({
    queryKey: ["products", "catalog"],
    queryFn: () => fetchProducts({}),
  });
  const products = productsPage?.results ?? [];

  const { data: warehousesPage } = useQuery({
    queryKey: ["warehouses", "all"],
    queryFn: () => fetchWarehouses({}),
  });
  const warehouses = warehousesPage?.results ?? [];

  const filter = useMemo<MovementsFilter>(
    () => ({
      search: search || undefined,
      movement_type: movementType || undefined,
      ...pageUrl,
    }),
    [search, movementType, pageUrl],
  );

  const { data: movementsPage, isLoading: loadingMovements } = useQuery({
    queryKey: ["inventory", "movements", filter],
    queryFn: () => fetchInventoryMovements(filter),
  });

  const { data: lowStock = [] } = useQuery({
    queryKey: ["inventory", "low-stock"],
    queryFn: fetchLowStock,
  });

  const { data: outOfStock = [] } = useQuery({
    queryKey: ["inventory", "out-of-stock"],
    queryFn: fetchOutOfStock,
  });

  const totalAlerts = lowStock.length + outOfStock.length;

  const create = useMutation({
    mutationFn: createInventoryMovement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setModalOpen(false);
    },
  });

  const movements = movementsPage?.results ?? [];
  const totalMovements = movementsPage?.count ?? 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Inventario</h1>
          <p className="text-xs text-muted-foreground">
            Movimientos y alertas de stock
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" />
          Registrar movimiento
        </Button>
      </header>

      <div className="border-b border-border px-6">
        <div className="flex gap-4">
          <button
            onClick={() => setTab("movements")}
            className={`border-b-2 px-2 py-3 text-sm font-medium transition ${
              tab === "movements"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Movimientos
          </button>
          <button
            onClick={() => setTab("alerts")}
            className={`flex items-center gap-2 border-b-2 px-2 py-3 text-sm font-medium transition ${
              tab === "alerts"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Alertas
            {totalAlerts > 0 && (
              <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                {totalAlerts}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-6">
        {tab === "movements" && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPageUrl({});
                  }}
                  placeholder="Buscar movimiento…"
                  className="pl-9"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-movement" className="text-xs text-muted-foreground">Tipo</label>
                <Select
                  id="filter-movement"
                  value={movementType}
                  onChange={(e) => {
                    setMovementType(e.target.value);
                    setPageUrl({});
                  }}
                >
                  <option value="">Todos</option>
                  {MOVEMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
            </div>

            {loadingMovements ? (
              <div className="grid flex-1 place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3 text-right">Cantidad</th>
                        <th className="px-4 py-3 text-right">Stock previo</th>
                        <th className="px-4 py-3 text-right">Stock actual</th>
                        <th className="px-4 py-3">Usuario</th>
                        <th className="px-4 py-3">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m: InventoryHistory) => (
                        <tr key={m.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Package className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-medium">{m.product_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {movementLabel(m.movement_type)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{m.quantity}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{m.previous_quantity}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{m.current_quantity}</td>
                          <td className="px-4 py-3 text-muted-foreground">{m.user_name ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {new Date(m.created).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <p className="text-muted-foreground">
                    {totalMovements} movimiento{totalMovements === 1 ? "" : "s"} en total
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageUrl({ previous: movementsPage?.previous })}
                      disabled={!movementsPage?.previous}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageUrl({ next: movementsPage?.next })}
                      disabled={!movementsPage?.next}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {tab === "alerts" && (
          <>
            <h2 className="text-sm font-semibold">Productos sin stock</h2>
            {outOfStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay productos sin stock.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-right">Cantidad</th>
                      <th className="px-4 py-3 text-right">Stock mínimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outOfStock.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                            <span className="font-medium">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{p.quantity ?? 0}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{p.minimum_stock ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h2 className="mt-4 text-sm font-semibold">Stock bajo</h2>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay productos con stock bajo.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-right">Cantidad</th>
                      <th className="px-4 py-3 text-right">Stock mínimo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.map((p) => (
                      <tr key={p.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            <span className="font-medium">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{p.quantity ?? 0}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{p.minimum_stock ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <MovementModal
          products={products}
          warehouses={warehouses}
          onClose={() => setModalOpen(false)}
          onSubmit={(payload) => create.mutate(payload as Parameters<typeof createInventoryMovement>[0])}
          isPending={create.isPending}
          error={create.error instanceof Error ? create.error.message : null}
        />
      )}
    </div>
  );
}

function MovementModal({
  products,
  warehouses,
  onClose,
  onSubmit,
  isPending,
  error,
}: {
  products: { id: number; name: string }[];
  warehouses: { id: number; name: string }[];
  onClose: () => void;
  onSubmit: (payload: {
    product: number;
    warehouse: number | null;
    movement_type: string;
    source_type: string;
    quantity: number;
    notes?: string;
  }) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState({
    product: "",
    warehouse: "",
    movement_type: "IN",
    source_type: "MANUAL",
    quantity: "",
    notes: "",
  });

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      product: Number(form.product),
      warehouse: form.warehouse ? Number(form.warehouse) : null,
      movement_type: form.movement_type as "IN" | "OUT" | "ADJUSTMENT" | "RETURN" | "TRANSFER" | "LOSS" | "DAMAGE" | "CANCELLATION" | "EXPIRY",
      source_type: form.source_type as "SALE" | "ORDER" | "MANUAL" | "PURCHASE" | "TRANSFER" | "ADJUSTMENT" | "INTERNAL_USE" | "MAINTENANCE" | "TOOL_USAGE" | "RAW_MATERIAL" | "PRODUCTION" | "QUALITY_CONTROL" | "RETURN_CUSTOMER" | "RETURN_SUPPLIER",
      quantity: Number(form.quantity),
      notes: form.notes || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Registrar movimiento</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Producto</label>
              <Select
                value={form.product}
                onChange={(e) => updateField("product", e.target.value)}
                required
              >
                <option value="">Selecciona</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Bodega</label>
              <Select
                value={form.warehouse}
                onChange={(e) => updateField("warehouse", e.target.value)}
              >
                <option value="">Ninguna</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select
                value={form.movement_type}
                onChange={(e) => updateField("movement_type", e.target.value)}
              >
                {MOVEMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Origen</label>
              <Select
                value={form.source_type}
                onChange={(e) => updateField("source_type", e.target.value)}
              >
                {SOURCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Cantidad</label>
            <Input
              type="number"
              min="0"
              value={form.quantity}
              onChange={(e) => updateField("quantity", e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Notas</label>
            <Input
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              placeholder="Opcional"
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !form.product || !form.quantity}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
