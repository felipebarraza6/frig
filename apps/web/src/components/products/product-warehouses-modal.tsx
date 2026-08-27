"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Warehouse,
  History,
  Package,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Truck,
  Save,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchProductWarehouses, updateWarehouseProduct } from "@/lib/api/warehouses";
import { fetchAllInventoryMovements } from "@/lib/api/inventory";
import {
  fetchSuppliers,
  fetchSupplierProductsByProduct,
  createSupplierProduct,
  updateSupplierProduct,
  type SupplierList,
} from "@/lib/api/suppliers";
import { useCurrentBranch } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import type { YggdraSchemas } from "@/lib/api/types";

type WarehouseProduct = YggdraSchemas["WarehouseProduct"];
type InventoryHistory = YggdraSchemas["InventoryHistory"];
type YggdraProduct = YggdraSchemas["ProductList"];
type SupplierProduct = YggdraSchemas["SupplierProduct"];

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
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value?: number | null): string {
  if (value === undefined || value === null) return "—";
  return Number(value).toLocaleString("es-CL");
}

function numberValue(v: string): string {
  const cleaned = v.replace(/[^0-9]/g, "");
  return cleaned ? (parseInt(cleaned, 10) || 0).toString() : "";
}

function groupWarehousesByWarehouse(items: WarehouseProduct[]): WarehouseProduct[] {
  const groups = new Map<string, WarehouseProduct[]>();
  for (const item of items) {
    const key = String(item.warehouse.id ?? item.warehouse.name ?? "").trim().toLowerCase();
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
    let recordId = first.id;

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
        recordId = w.id;
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
      id: recordId,
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
                {groupedWarehouses.length} bodega{groupedWarehouses.length === 1 ? "" : "s"} · Stock total:{" "}
                {formatNumber(totalStock)}
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
            <WarehouseDetail
              product={product}
              warehouseProduct={selectedWarehouse}
              movements={movements}
              loadingMovements={loadingMovements}
              onBack={() => setSelectedWarehouse(null)}
            />
          ) : groupedWarehouses.length === 0 ? (
            <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border py-12">
              <div className="text-center">
                <Package className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Sin asignación a bodegas</p>
                <p className="text-xs text-muted-foreground">Este producto no está asignado a ninguna bodega.</p>
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
                      <p className="mt-0.5 text-xs text-muted-foreground">Agregado el {formatDate(w.created)}</p>
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
                    {w.minimum_quantity !== undefined &&
                      w.minimum_quantity !== null &&
                      w.current_quantity <= w.minimum_quantity && (
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

function WarehouseDetail({
  product,
  warehouseProduct,
  movements,
  loadingMovements,
  onBack,
}: {
  product: YggdraProduct;
  warehouseProduct: WarehouseProduct;
  movements: InventoryHistory[];
  loadingMovements: boolean;
  onBack: () => void;
}) {
  const branch = useCurrentBranch();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [minQty, setMinQty] = useState<string>(
    warehouseProduct.minimum_quantity !== undefined && warehouseProduct.minimum_quantity !== null
      ? String(warehouseProduct.minimum_quantity)
      : "",
  );
  const [maxQty, setMaxQty] = useState<string>(
    warehouseProduct.maximum_quantity !== undefined && warehouseProduct.maximum_quantity !== null
      ? String(warehouseProduct.maximum_quantity)
      : "",
  );
  const [reorderPoint, setReorderPoint] = useState<string>(
    warehouseProduct.reorder_point !== undefined && warehouseProduct.reorder_point !== null
      ? String(warehouseProduct.reorder_point)
      : "",
  );
  const [location, setLocation] = useState(warehouseProduct.location_in_warehouse ?? "");

  const { data: supplierProducts = [] } = useQuery({
    queryKey: ["supplier-products", "by-product", product.id],
    queryFn: () => fetchSupplierProductsByProduct(product.id),
    enabled: !!product?.id,
  });

  const supplierProduct = useMemo(() => {
    return (
      (supplierProducts as SupplierProduct[]).find((sp) => {
        return sp.product != null && String(sp.product) === String(product.id);
      }) ?? null
    );
  }, [supplierProducts, product.id]);

  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierOptions, setSupplierOptions] = useState<SupplierList[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(() => supplierProduct?.supplier ?? null);
  const [costPrice, setCostPrice] = useState<string>(() => supplierProduct?.cost_price ?? "");
  const [supplierProductName, setSupplierProductName] = useState<string>(
    () => supplierProduct?.supplier_product_name ?? product.name ?? "",
  );

  useEffect(() => {
    const term = supplierSearch.trim();
    const t = setTimeout(async () => {
      try {
        const data = await fetchSuppliers({ search: term, status: "ACTIVE" });
        setSupplierOptions(data.results ?? []);
      } catch {
        setSupplierOptions([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [supplierSearch]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!branch?.branch_id) throw new Error("No hay sucursal seleccionada");

      await updateWarehouseProduct(Number(warehouseProduct.id), {
        minimum_quantity: minQty === "" ? undefined : Number(minQty),
        maximum_quantity: maxQty === "" ? undefined : Number(maxQty),
        reorder_point: reorderPoint === "" ? undefined : Number(reorderPoint),
        location_in_warehouse: location.trim() || undefined,
      });

      if (selectedSupplierId) {
        const payload = {
          supplier: selectedSupplierId,
          product: product.id,
          cost_price: costPrice || "0",
          supplier_product_name: supplierProductName.trim() || product.name,
          branch: Number(branch.branch_id),
          is_active: true,
          create_inventory_product: false,
          measurement_unit: (product as unknown as { measurement_unit?: string }).measurement_unit || "UN",
        };
        if (supplierProduct) {
          await updateSupplierProduct(supplierProduct.id, payload);
        } else {
          await createSupplierProduct(payload);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products", product.id, "warehouses"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-products", "by-product", product.id] });
      toast.success("Configuración guardada");
      onBack();
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo guardar la configuración");
    },
  });

  const selectedSupplier = supplierOptions.find((s) => s.id === selectedSupplierId);

  return (
    <div className="flex flex-col gap-4">
      {/* Resumen */}
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
              <Warehouse className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{warehouseProduct.warehouse.name}</p>
              <p className="text-xs text-muted-foreground">
                {WAREHOUSE_TYPE_LABELS[warehouseProduct.warehouse.warehouse_type ?? "GENERAL"] ?? "Bodega"}
                {warehouseProduct.warehouse.location ? ` · ${warehouseProduct.warehouse.location}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-[10px] text-muted-foreground">Stock actual</span>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${stockStatusColor(
                warehouseProduct.stock_status,
              )}`}
            >
              {formatNumber(warehouseProduct.current_quantity)} {warehouseProduct.product_measurement_unit}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Mínimo</p>
            <p>{formatNumber(warehouseProduct.minimum_quantity)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Máximo</p>
            <p>{formatNumber(warehouseProduct.maximum_quantity)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Punto de reorden</p>
            <p>{formatNumber(warehouseProduct.reorder_point)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valor total</p>
            <p>${formatNumber(Number(warehouseProduct.total_value))}</p>
          </div>
        </div>

        {warehouseProduct.location_in_warehouse && (
          <p className="mt-3 text-xs text-muted-foreground">
            Ubicación: {warehouseProduct.location_in_warehouse}
          </p>
        )}
      </div>

      {/* Configuración editable */}
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Pencil className="h-4 w-4" />
          Configuración de bodega
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Mínimo</label>
            <Input
              type="number"
              min={0}
              value={minQty}
              onChange={(e) => setMinQty(numberValue(e.target.value))}
              className="h-9 text-xs tabular-nums"
              placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Máximo</label>
            <Input
              type="number"
              min={0}
              value={maxQty}
              onChange={(e) => setMaxQty(numberValue(e.target.value))}
              className="h-9 text-xs tabular-nums"
              placeholder="Sin máximo"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Punto de reorden</label>
            <Input
              type="number"
              min={0}
              value={reorderPoint}
              onChange={(e) => setReorderPoint(numberValue(e.target.value))}
              className="h-9 text-xs tabular-nums"
              placeholder="0"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Ubicación</label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-9 text-xs"
              placeholder="Estante A3"
            />
          </div>
        </div>
      </div>

      {/* Proveedor */}
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Truck className="h-4 w-4" />
          Proveedor del producto
        </h3>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <label className="mb-1 block text-xs text-muted-foreground">Proveedor</label>
            <Input
              value={selectedSupplier ? selectedSupplier.name : supplierSearch}
              onChange={(e) => {
                if (selectedSupplierId) {
                  setSelectedSupplierId(null);
                }
                setSupplierSearch(e.target.value);
              }}
              placeholder="Buscar proveedor..."
              className="h-9 text-xs"
            />
            {supplierOptions.length > 0 && !selectedSupplierId && (
              <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-md border border-border bg-card shadow-md">
                {supplierOptions.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedSupplierId(s.id);
                      setSupplierSearch(s.name);
                      setSupplierOptions([]);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Precio de costo</label>
              <Input
                value={costPrice ? formatNumber(Number(costPrice)) : ""}
                onChange={(e) => setCostPrice(numberValue(e.target.value))}
                placeholder="0"
                className="h-9 text-xs tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Nombre del producto en proveedor</label>
              <Input
                value={supplierProductName}
                onChange={(e) => setSupplierProductName(e.target.value)}
                placeholder={product.name}
                className="h-9 text-xs"
              />
            </div>
          </div>
        </div>
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

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>
          Volver
        </Button>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Save className="mr-1.5 h-4 w-4" />
          Guardar
        </Button>
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

      {movement.user_name && <p className="mt-2 text-xs text-muted-foreground">Por: {movement.user_name}</p>}
      {movement.notes && <p className="mt-1 text-xs text-muted-foreground">Nota: {movement.notes}</p>}
    </div>
  );
}
