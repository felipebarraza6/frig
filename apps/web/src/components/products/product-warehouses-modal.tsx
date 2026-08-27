"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Warehouse, History, Package, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchProductWarehouses } from "@/lib/api/warehouses";
import { fetchAllInventoryMovements } from "@/lib/api/inventory";
import type { YggdraSchemas } from "@/lib/api/types";

type WarehouseProduct = YggdraSchemas["WarehouseProduct"];
type InventoryHistory = YggdraSchemas["InventoryHistory"];
type YggdraProduct = YggdraSchemas["ProductList"];

interface ProductWarehousesModalProps {
  product: YggdraProduct;
  onClose: () => void;
}

const WAREHOUSE_TYPE_LABELS: Record<string, string> = {
  GENERAL: "General",
  TOOLS: "Herramientas",
  RAW_MATERIAL: "Materias primas",
  WASTE: "Residuos",
  CUSTOM: "Personalizada",
};

const MOVEMENT_LABELS: Record<string, string> = {
  IN: "Entrada",
  OUT: "Salida",
  ADJUSTMENT: "Ajuste",
  RETURN: "Devolución",
  CANCELLATION: "Anulación",
  TRANSFER: "Transferencia",
  LOSS: "Pérdida",
  DAMAGE: "Daño",
  EXPIRY: "Vencimiento",
};

const MOVEMENT_COLORS: Record<string, string> = {
  IN: "text-emerald-600 bg-emerald-500/10",
  OUT: "text-blue-600 bg-blue-500/10",
  ADJUSTMENT: "text-amber-600 bg-amber-500/10",
  RETURN: "text-purple-600 bg-purple-500/10",
  CANCELLATION: "text-gray-600 bg-gray-500/10",
  TRANSFER: "text-cyan-600 bg-cyan-500/10",
  LOSS: "text-orange-600 bg-orange-500/10",
  DAMAGE: "text-red-600 bg-red-500/10",
  EXPIRY: "text-rose-600 bg-rose-500/10",
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month:"short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value?: number | null): string {
  if (value === undefined || value === null) return "—";
  return Number(value).toLocaleString("es-CL");
}

function groupWarehousesByWarehouse(items: WarehouseProduct[]): WarehouseProduct[] {
  const groups = new Map<string, WarehouseProduct[]>();
  for (const item of items) {
    // Algunos backends devuelven registros duplicados de la misma bodega con
    // IDs distintos. Agrupamos por nombre normalizado para no mostrar la misma
    // bodega varias veces; el primer objeto de warehouse se conserva.
    const key = String(item.warehouse.name ?? item.warehouse.id ?? "").trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return Array.from(groups.values()).map((group) => {
    const first = group[0];
    let currentQuantity = 0;
    let totalValue = 0;
    let minimumQuantity: number | undefined;
    let maximumQuantity: number | null = null;
    let reorderPoint: number | undefined;
    let location = first.location_in_warehouse ?? null;
    let earliestCreated = first.created;

    for (const w of group) {
      currentQuantity += w.current_quantity ?? 0;
      totalValue += parseFloat(w.total_value ?? "0") || 0;

      if (w.minimum_quantity != null) {
        minimumQuantity =
          minimumQuantity === undefined ? w.minimum_quantity : Math.min(minimumQuantity, w.minimum_quantity);
      }
      if (w.maximum_quantity != null) {
        maximumQuantity =
          maximumQuantity === null ? w.maximum_quantity : Math.max(maximumQuantity, w.maximum_quantity);
      }
      if (w.reorder_point != null) {
        reorderPoint =
          reorderPoint === undefined ? w.reorder_point : Math.min(reorderPoint, w.reorder_point);
      }
      if (!location && w.location_in_warehouse) {
        location = w.location_in_warehouse;
      }
      if (w.created < earliestCreated) {
        earliestCreated = w.created;
      }
    }

    let stockStatus = "IN_STOCK";
    if (currentQuantity <= 0) {
      stockStatus = "OUT_OF_STOCK";
    } else if (minimumQuantity != null && currentQuantity <= minimumQuantity) {
      stockStatus = "LOW_STOCK";
    }

    return {
      ...first,
      id: first.id,
      current_quantity: currentQuantity,
      total_value: String(totalValue),
      minimum_quantity: minimumQuantity,
      maximum_quantity: maximumQuantity,
      reorder_point: reorderPoint,
      location_in_warehouse: location,
      stock_status: stockStatus,
      created: earliestCreated,
    } as WarehouseProduct;
  });
}

function stockStatusColor(status?: string): string {
  const s = (status ?? "").toLowerCase();
  if (s.includes("out") || s.includes("agotado")) return "bg-red-500/10 text-red-700";
  if (s.includes("low") || s.includes("bajo")) return "bg-amber-500/10 text-amber-700";
  if (s.includes("ok") || s.includes("normal")) return "bg-emerald-500/10 text-emerald-700";
  return "bg-muted text-muted-foreground";
}

export function ProductWarehousesModal({ product, onClose }: ProductWarehousesModalProps) {
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseProduct | null>(null);

  const { data: warehouses = [], isLoading } = useQuery({
    queryKey: ["products", product.id, "warehouses"],
    queryFn: () => fetchProductWarehouses(product.id),
  });

  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ["inventory", "movements", product.id, selectedWarehouse?.warehouse.id],
    queryFn: () =>
      fetchAllInventoryMovements({
        product: product.id,
        warehouse: selectedWarehouse?.warehouse.id,
      }),
    enabled: !!selectedWarehouse,
  });
  const groupedWarehouses = useMemo(() => groupWarehousesByWarehouse(warehouses), [warehouses]);

  const totalStock = groupedWarehouses.reduce((sum, w) => sum + (w.current_quantity ?? 0), 0);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center overflow-hidden bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-xl sm:border">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">
              {selectedWarehouse ? (
                <span className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWarehouse(null)}
                    className="rounded-lg p-1 hover:bg-muted"
                    aria-label="Volver"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  {selectedWarehouse.warehouse.name}
                </span>
              ) : (
                <>Bodegas de {product.name}</>
              )}
            </h2>
            {!selectedWarehouse && (
              <p className="text-xs text-muted-foreground">
                {groupedWarehouses.length} bodega{groupedWarehouses.length === 1 ? "" : "s"} · Stock total: {formatNumber(totalStock)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="grid flex-1 place-items-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : selectedWarehouse ? (
            <div className="flex flex-col gap-4">
              {/* Resumen de la bodega seleccionada */}
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                      <Warehouse className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{selectedWarehouse.warehouse.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {WAREHOUSE_TYPE_LABELS[selectedWarehouse.warehouse.warehouse_type ?? "GENERAL"] ?? "Bodega"}
                        {selectedWarehouse.warehouse.location ? ` · ${selectedWarehouse.warehouse.location}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[10px] text-muted-foreground">Stock actual</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${stockStatusColor(
                        selectedWarehouse.stock_status,
                      )}`}
                    >
                      {formatNumber(selectedWarehouse.current_quantity)} {selectedWarehouse.product_measurement_unit}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Mínimo</p>
                    <p>{formatNumber(selectedWarehouse.minimum_quantity)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Máximo</p>
                    <p>{formatNumber(selectedWarehouse.maximum_quantity)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Punto de reorden</p>
                    <p>{formatNumber(selectedWarehouse.reorder_point)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor total</p>
                    <p>${formatNumber(Number(selectedWarehouse.total_value))}</p>
                  </div>
                </div>

                {selectedWarehouse.location_in_warehouse && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Ubicación: {selectedWarehouse.location_in_warehouse}
                  </p>
                )}
              </div>

              {/* Historial */}
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <History className="h-4 w-4" />
                  Historial de movimientos
                </h3>

                {loadingMovements ? (
                  <div className="grid place-items-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : movements.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                    No hay movimientos registrados en esta bodega.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {movements.map((m) => (
                      <MovementItem key={m.id} movement={m} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : groupedWarehouses.length === 0 ? (
            <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border py-12">
              <div className="text-center">
                <Package className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Sin asignación a bodegas</p>
                <p className="text-xs text-muted-foreground">
                  Este producto no está asignado a ninguna bodega.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {groupedWarehouses.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWarehouse(w)}
                  className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary">
                      <Warehouse className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{w.warehouse.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {WAREHOUSE_TYPE_LABELS[w.warehouse.warehouse_type ?? "GENERAL"] ?? "Bodega"}
                        {w.location_in_warehouse ? ` · ${w.location_in_warehouse}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Agregado el {formatDate(w.created)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${stockStatusColor(
                        w.stock_status,
                      )}`}
                    >
                      {w.current_quantity} {w.product_measurement_unit}
                    </span>
                    {w.minimum_quantity !== undefined && w.minimum_quantity !== null && w.current_quantity <= w.minimum_quantity && (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        Stock bajo
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end border-t border-border px-4 py-3 sm:px-6">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}

function MovementItem({ movement }: { movement: InventoryHistory }) {
  const isPositive = movement.quantity > 0;
  const config = MOVEMENT_COLORS[movement.movement_type] ?? "bg-muted text-muted-foreground";
  const label = MOVEMENT_LABELS[movement.movement_type] ?? movement.movement_type;

  return (
    <div className="rounded-lg border border-border p-3 text-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${config}`}>{label}</span>
          <span className="text-xs text-muted-foreground">{movement.source_type_display}</span>
        </div>
        <span className={`shrink-0 font-medium ${isPositive ? "text-emerald-600" : "text-blue-600"}`}>
          {isPositive ? "+" : ""}
          {formatNumber(movement.quantity)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
        <div>
          <p>Anterior</p>
          <p className="font-medium text-foreground">{formatNumber(movement.previous_quantity)}</p>
        </div>
        <div>
          <p>Actual</p>
          <p className="font-medium text-foreground">{formatNumber(movement.current_quantity)}</p>
        </div>
        <div>
          <p>Fecha</p>
          <p className="font-medium text-foreground">{formatDate(movement.created)}</p>
        </div>
      </div>

      {movement.user_name && (
        <p className="mt-2 text-xs text-muted-foreground">Por: {movement.user_name}</p>
      )}
      {movement.notes && (
        <p className="mt-1 text-xs text-muted-foreground">Nota: {movement.notes}</p>
      )}
    </div>
  );
}
