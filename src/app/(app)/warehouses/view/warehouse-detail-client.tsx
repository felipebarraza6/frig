"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRightLeft,
  Coins,
  FileSpreadsheet,
  LayoutGrid,
  List,
  MapPin,
  Package,
  Plus,
  Search,
  TrendingUp,
  Warehouse,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBody, PageShell } from "@/components/page-shell";
import { WarehouseProductBin } from "@/components/warehouses/warehouse-product-bin";
import { WarehouseInspector } from "@/components/warehouses/warehouse-inspector";
import {
  addProductToWarehouse,
  fetchWarehouse,
  fetchWarehouseProducts,
  fetchWarehouses,
  transferStock,
  type WarehouseProduct,
} from "@/lib/api/warehouses";
import { fetchProducts } from "@/lib/api/products";
import { formatCLP, cn, stockStatusLabel } from "@/lib/utils";
import { statusBadge } from "@/lib/status-styles";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useToast } from "@/lib/store/toast";
import {
  formatQty,
  groupWarehouseProductsByLocation,
  numValue,
  warehouseOccupancy,
  warehouseTypeAccent,
  warehouseTypeIcon,
  warehouseTypeLabel,
} from "@/lib/warehouses-ui";

const NO_INVENTORY_TYPES = new Set(["RECIPE_BASED", "SERVICE", "CERTIFICATE", "IOT"]);

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "glass-chip inline-flex h-7 shrink-0 items-center justify-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-foreground/10 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

async function exportWarehouseProductsToExcel(warehouseName: string, warehouseId: number) {
  const XLSX = await import("xlsx");
  const allResults: WarehouseProduct[] = [];
  let next: string | null | undefined;
  let first = true;
  while (first || next) {
    const data = await fetchWarehouseProducts(
      warehouseId,
      first ? { page_size: 100 } : { next },
    );
    allResults.push(...(data.results ?? []));
    next = data.next;
    first = false;
  }

  const rows = allResults.map((wp) => ({
    Producto: wp.product_name,
    Código: wp.product_code,
    Categoría: wp.product_category,
    Unidad: wp.product_measurement_unit,
    Ubicación: wp.location_in_warehouse ?? "",
    Cantidad: wp.current_quantity,
    Mínima: wp.minimum_quantity ?? "",
    Máxima: wp.maximum_quantity ?? "",
    Reorden: wp.reorder_point ?? "",
    "Costo unitario": numValue(wp.product_cost),
    "Costo total": numValue(wp.total_value),
    Estado: stockStatusLabel(wp.stock_status ?? ""),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Productos");
  const date = new Date().toLocaleDateString("en-CA");
  XLSX.writeFile(wb, `bodega-${warehouseName.toLowerCase().replace(/\s+/g, "-")}_${date}.xlsx`);
}

export default function WarehouseDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();

  const warehouseId = useMemo(() => {
    if (typeof window === "undefined") return 0;
    const fromQuery = searchParams.get("id");
    const fromPath = window.location.pathname.match(/\/warehouses\/(\d+)/)?.[1];
    return Number(fromQuery ?? fromPath ?? 0) || 0;
  }, [searchParams]);

  const alertParam = searchParams.get("alert");
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out" | "reorder">(
    alertParam === "out" ? "out" : alertParam === "low" ? "low" : "all",
  );
  const [view, setView] = useState<"zones" | "list">("zones");
  const [searchInput, setSearchInput] = useState("");
  const productSearch = useDebouncedValue(searchInput, 300);
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [inspected, setInspected] = useState<WarehouseProduct | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (alertParam === "out") setStockFilter("out");
    if (alertParam === "low") setStockFilter("low");
  }, [alertParam]);

  useEffect(() => {
    setPageUrl({});
  }, [productSearch, stockFilter]);

  const { data: warehouse, isLoading: loadingWarehouse } = useQuery({
    queryKey: ["warehouses", warehouseId],
    queryFn: () => fetchWarehouse(warehouseId),
    enabled: Boolean(warehouseId),
  });

  const productFilter = useMemo(
    () => ({
      search: productSearch || undefined,
      low_stock: stockFilter === "low" || undefined,
      out_of_stock: stockFilter === "out" || undefined,
      page_size: 50,
      ...pageUrl,
    }),
    [productSearch, stockFilter, pageUrl],
  );

  const { data: productsPage, isLoading: loadingProducts } = useQuery({
    queryKey: ["warehouses", warehouseId, "products", productFilter],
    queryFn: () => fetchWarehouseProducts(warehouseId, productFilter),
    enabled: Boolean(warehouseId),
  });

  const products = useMemo(() => {
    const rows = productsPage?.results ?? [];
    if (stockFilter === "reorder") {
      return rows.filter((wp) => wp.stock_status === "NEEDS_REORDER");
    }
    return rows;
  }, [productsPage, stockFilter]);

  const zones = useMemo(() => groupWarehouseProductsByLocation(products), [products]);

  const { data: warehousesPage } = useQuery({
    queryKey: ["warehouses", "list", { page_size: 100 }],
    queryFn: () => fetchWarehouses({ page_size: 100 }),
  });
  const targetWarehouses = (warehousesPage?.results ?? []).filter((w) => w.id !== warehouseId);

  type PendingAdd = { id: number; name: string; code?: string; quantity: string };
  const [pendingAdds, setPendingAdds] = useState<PendingAdd[]>([]);
  const [addProductQuery, setAddProductQuery] = useState("");
  const debouncedAddQuery = useDebouncedValue(addProductQuery, 300);
  const [addMin, setAddMin] = useState("");
  const [addReorder, setAddReorder] = useState("");
  const [addLocation, setAddLocation] = useState("");
  const [pickerValue, setPickerValue] = useState("");

  const addProductSearch = useQuery({
    queryKey: ["products", "warehouse-add", debouncedAddQuery],
    queryFn: () =>
      fetchProducts({
        search: debouncedAddQuery.trim() || undefined,
        page_size: 30,
        is_active: true,
      }),
    enabled: addOpen,
    staleTime: 30_000,
  });

  const addProductOptions = useMemo(() => {
    const inWarehouse = new Set(products.map((p) => Number(p.product)));
    const pendingIds = new Set(pendingAdds.map((p) => p.id));
    return (addProductSearch.data?.results ?? [])
      .filter(
        (p) =>
          !NO_INVENTORY_TYPES.has(p.product_type ?? "") &&
          !inWarehouse.has(p.id) &&
          !pendingIds.has(p.id),
      )
      .map((p) => ({
        value: String(p.id),
        label: p.name,
        description: [p.code, p.product_type].filter(Boolean).join(" · ") || undefined,
      }));
  }, [addProductSearch.data, products, pendingAdds]);

  function resetAddForm() {
    setPendingAdds([]);
    setAddProductQuery("");
    setPickerValue("");
    setAddMin("");
    setAddReorder("");
    setAddLocation("");
  }

  function queueProduct(value: string) {
    if (!value) return;
    const opt = addProductOptions.find((o) => o.value === value);
    const id = Number(value);
    if (!Number.isFinite(id) || pendingAdds.some((p) => p.id === id)) {
      setPickerValue("");
      return;
    }
    setPendingAdds((prev) => [
      ...prev,
      {
        id,
        name: opt?.label ?? `Producto #${id}`,
        code: opt?.description,
        quantity: "0",
      },
    ]);
    setPickerValue("");
    setAddProductQuery("");
  }

  const add = useMutation({
    mutationFn: async () => {
      if (pendingAdds.length === 0) throw new Error("Elige al menos un producto");
      const results = await Promise.allSettled(
        pendingAdds.map((item) =>
          addProductToWarehouse({
            warehouse_id: warehouseId,
            product_id: item.id,
            initial_quantity: Number(item.quantity) || 0,
            minimum_quantity: addMin === "" ? undefined : Number(addMin),
            reorder_point: addReorder === "" ? undefined : Number(addReorder),
            location_in_warehouse: addLocation.trim() || undefined,
          }),
        ),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      if (ok === 0) {
        const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        throw new Error(
          first?.reason instanceof Error
            ? first.reason.message
            : "No se pudo agregar ningún producto",
        );
      }
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }) => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId] });
      if (fail > 0) {
        toast.warning(`${ok} agregados, ${fail} con error`);
      } else {
        toast.success(ok === 1 ? "Producto agregado al recinto" : `${ok} productos agregados`);
      }
      setAddOpen(false);
      resetAddForm();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo agregar"),
  });

  const [transferRows, setTransferRows] = useState<Record<number, string>>({});
  const [transferTarget, setTransferTarget] = useState("");

  const transfer = useMutation({
    mutationFn: () => {
      const items = products
        .filter((wp) => Number(transferRows[wp.id] ?? 0) > 0 && wp.product)
        .map((wp) => ({
          product_id: Number(wp.product),
          quantity: Number(transferRows[wp.id]),
        }));
      if (items.length === 0) throw new Error("Indica al menos una cantidad");
      return transferStock({
        source_warehouse_id: warehouseId,
        target_warehouse_id: Number(transferTarget),
        products: items,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success(res.message || "Transferencia lista");
      setTransferOpen(false);
      setTransferRows({});
      setTransferTarget("");
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo transferir"),
  });

  if (loadingWarehouse || !warehouseId) {
    return (
      <PageShell>
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/warehouses")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Skeleton className="h-6 w-48" />
        </header>
        <PageBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </PageBody>
      </PageShell>
    );
  }

  if (!warehouse) {
    return (
      <PageShell>
        <EmptyState
          icon={Warehouse}
          title="Bodega no encontrada"
          action={
            <Button onClick={() => router.push("/warehouses")}>Volver a bodegas</Button>
          }
        />
      </PageShell>
    );
  }

  const Icon = warehouseTypeIcon(warehouse.warehouse_type);
  const occupancy = warehouseOccupancy(warehouse.capacity, warehouse.total_quantity);
  const lowStock = numValue(warehouse.low_stock_products);
  const outOfStock = numValue(warehouse.out_of_stock_products);
  const hasFilter = Boolean(productSearch) || stockFilter !== "all";

  return (
    <PageShell>
      <header className="glass-strong flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:px-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/warehouses")} aria-label="Volver">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
              warehouseTypeAccent(warehouse.warehouse_type),
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-lg font-semibold tracking-tight">{warehouse.name}</h1>
              {warehouse.is_default && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Principal
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {warehouseTypeLabel(warehouse.warehouse_type)}
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              {warehouse.location ? (
                <>
                  <MapPin className="h-3 w-3" />
                  {warehouse.location}
                </>
              ) : (
                "Sin ubicación física"
              )}
              {occupancy != null ? ` · ${Math.round(occupancy)}% ocupación` : ""}
            </p>
          </div>
        </div>
      </header>

      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={Package}
            label="Productos"
            value={formatQty(warehouse.total_products)}
            delta={
              lowStock > 0 || outOfStock > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {lowStock > 0 && (
                    <button
                      type="button"
                      className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning"
                      onClick={() => setStockFilter("low")}
                    >
                      {lowStock} bajo
                    </button>
                  )}
                  {outOfStock > 0 && (
                    <button
                      type="button"
                      className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[10px] font-medium text-danger"
                      onClick={() => setStockFilter("out")}
                    >
                      {outOfStock} sin stock
                    </button>
                  )}
                </div>
              ) : undefined
            }
          />
          <StatCard icon={Package} label="Unidades" value={formatQty(warehouse.total_quantity)} tone="muted" />
          <StatCard
            icon={Coins}
            label="Valor costo"
            value={formatCLP(numValue(warehouse.total_value))}
            tone="success"
          />
          <StatCard
            icon={TrendingUp}
            label="Valor venta"
            value={formatCLP(numValue(warehouse.total_sale_value))}
            tone="primary"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar producto o código…"
                className="pl-9"
                aria-label="Buscar producto"
              />
            </div>
            <div className="flex items-center rounded-lg border border-border p-0.5">
              <Button
                variant={view === "zones" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setView("zones")}
                aria-label="Vista zonas"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setView("list")}
                aria-label="Vista lista"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={exporting || products.length === 0}
              isLoading={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await exportWarehouseProductsToExcel(warehouse.name, warehouseId);
                } finally {
                  setExporting(false);
                }
              }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Transferir</span>
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Agregar</span>
            </Button>
          </div>
          <div className="flex gap-1 overflow-x-auto">
            <FilterChip active={stockFilter === "all"} onClick={() => setStockFilter("all")}>
              Todos
            </FilterChip>
            <FilterChip active={stockFilter === "low"} onClick={() => setStockFilter("low")}>
              Stock bajo
            </FilterChip>
            <FilterChip active={stockFilter === "out"} onClick={() => setStockFilter("out")}>
              Sin stock
            </FilterChip>
            <FilterChip active={stockFilter === "reorder"} onClick={() => setStockFilter("reorder")}>
              Reorden
            </FilterChip>
          </div>
        </div>

        {loadingProducts ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title={hasFilter ? "Nada coincide con el filtro" : "Este recinto está vacío"}
            description={
              hasFilter
                ? "Prueba otra búsqueda o limpia el filtro de alertas."
                : "Agrega el primer producto con cantidad inicial y, si quieres, una ubicación (estante, pasillo)."
            }
            action={
              hasFilter ? undefined : (
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Agregar producto
                </Button>
              )
            }
          />
        ) : view === "zones" ? (
          <div className="flex flex-col gap-6">
            {zones.map((zone) => (
              <section key={zone.location ?? "__none"} className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">
                    {zone.location ?? "General"}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {zone.items.length}
                    </span>
                  </h2>
                  {!zone.location ? (
                    <p className="text-[11px] text-muted-foreground">Asigna un estante desde la ficha</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {zone.items.map((wp) => (
                    <WarehouseProductBin key={wp.id} wp={wp} onOpen={() => setInspected(wp)} />
                  ))}
                </div>
              </section>
            ))}
            <p className="text-xs text-muted-foreground">Zonas de esta página</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Zona</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2 text-right">Rango</th>
                  <th className="px-3 py-2 text-right">Costo</th>
                </tr>
              </thead>
              <tbody>
                {products.map((wp) => (
                  <tr
                    key={wp.id}
                    className="cursor-pointer border-b border-border last:border-0 hover:bg-muted/40"
                    onClick={() => setInspected(wp)}
                  >
                    <td className="px-3 py-2">
                      <p className="font-medium">{wp.product_name}</p>
                      <span
                        className={cn(
                          "mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          statusBadge(wp.stock_status),
                        )}
                      >
                        {stockStatusLabel(wp.stock_status)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {wp.location_in_warehouse || "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatQty(wp.current_quantity)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                      {wp.minimum_quantity ?? 0} – {wp.maximum_quantity ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-success">
                      {formatCLP(numValue(wp.total_value))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(productsPage?.next || productsPage?.previous) && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">
              {productsPage?.count ?? products.length} producto
              {(productsPage?.count ?? products.length) === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!productsPage?.previous}
                onClick={() => setPageUrl({ previous: productsPage?.previous })}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!productsPage?.next}
                onClick={() => setPageUrl({ next: productsPage?.next })}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </PageBody>

      <WarehouseInspector
        open={Boolean(inspected)}
        wp={inspected}
        warehouseId={warehouseId}
        targets={targetWarehouses}
        onClose={() => setInspected(null)}
      />

      <AnimatedOverlay
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          resetAddForm();
        }}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
        <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <h2 className="text-base font-semibold">Agregar productos</h2>
              <p className="text-xs text-muted-foreground">
                Busca y elige uno o varios. Cada ítem puede tener su cantidad.
              </p>
            </div>
            <button
              onClick={() => {
                setAddOpen(false);
                resetAddForm();
              }}
              aria-label="Cerrar"
              className="text-muted-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <Field label="Buscar y elegir" required>
              <SearchableSelect
                options={addProductOptions}
                value={pickerValue}
                onChange={queueProduct}
                onQueryChange={setAddProductQuery}
                minChars={0}
                loading={addProductSearch.isFetching}
                clearable
                placeholder="Toca para buscar o elegir…"
                searchPlaceholder="Nombre o código…"
                emptyMessage={
                  debouncedAddQuery.trim().length === 0
                    ? "Escribe para filtrar el catálogo"
                    : "Sin coincidencias o ya están en la lista"
                }
              />
            </Field>

            {pendingAdds.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
                <Package className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Ningún producto en cola</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Busca arriba y selecciona para ir armando la lista.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Para agregar ({pendingAdds.length})
                  </p>
                  <button
                    type="button"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                    onClick={() => setPendingAdds([])}
                  >
                    Vaciar lista
                  </button>
                </div>
                <ul className="space-y-2">
                  {pendingAdds.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        {item.code && (
                          <p className="truncate text-[11px] text-muted-foreground">{item.code}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="sr-only" htmlFor={`qty-${item.id}`}>
                          Cantidad {item.name}
                        </label>
                        <Input
                          id={`qty-${item.id}`}
                          type="number"
                          min="0"
                          className="h-9 w-20 text-center tabular-nums"
                          value={item.quantity}
                          onChange={(e) =>
                            setPendingAdds((prev) =>
                              prev.map((p) =>
                                p.id === item.id ? { ...p, quantity: e.target.value } : p,
                              ),
                            )
                          }
                          placeholder="0"
                        />
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-danger"
                          aria-label={`Quitar ${item.name}`}
                          onClick={() =>
                            setPendingAdds((prev) => prev.filter((p) => p.id !== item.id))
                          }
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-border/70 bg-muted/15 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Opciones para todos
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ubicación" htmlFor="add-loc">
                  <Input
                    id="add-loc"
                    value={addLocation}
                    onChange={(e) => setAddLocation(e.target.value)}
                    placeholder="Estante A"
                  />
                </Field>
                <Field label="Mínima" htmlFor="add-min">
                  <Input
                    id="add-min"
                    type="number"
                    min="0"
                    value={addMin}
                    onChange={(e) => setAddMin(e.target.value)}
                  />
                </Field>
                <Field label="Reorden" htmlFor="add-re" className="col-span-2 sm:col-span-1">
                  <Input
                    id="add-re"
                    type="number"
                    min="0"
                    value={addReorder}
                    onChange={(e) => setAddReorder(e.target.value)}
                  />
                </Field>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <Button
              variant="outline"
              onClick={() => {
                setAddOpen(false);
                resetAddForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => add.mutate()}
              isLoading={add.isPending}
              disabled={pendingAdds.length === 0}
            >
              {pendingAdds.length <= 1
                ? "Agregar"
                : `Agregar ${pendingAdds.length} productos`}
            </Button>
          </div>
        </div>
      </AnimatedOverlay>

      <AnimatedOverlay
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
        <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg md:h-auto md:max-h-[90vh] md:max-w-lg md:rounded-xl md:border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">Transferir stock</h2>
            <button onClick={() => setTransferOpen(false)} aria-label="Cerrar" className="text-muted-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <Field label="Bodega destino" htmlFor="xfer-target" required>
              <Select
                id="xfer-target"
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
              >
                <option value="">Selecciona</option>
                {targetWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            </Field>
            <p className="text-xs text-muted-foreground">
              Cantidades de esta página. Un solo envío mueve todos los ítems con cantidad.
            </p>
            <div className="space-y-2">
              {products.map((wp) => (
                <div key={wp.id} className="flex items-center gap-3 rounded-xl border border-border/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{wp.product_name}</p>
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      Disponible {formatQty(wp.current_quantity)}
                    </p>
                  </div>
                  <Input
                    className="w-24"
                    type="number"
                    min="0"
                    value={transferRows[wp.id] ?? ""}
                    onChange={(e) =>
                      setTransferRows((prev) => ({ ...prev, [wp.id]: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <Button variant="outline" onClick={() => setTransferOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => transfer.mutate()}
              isLoading={transfer.isPending}
              disabled={!transferTarget}
            >
              Transferir
            </Button>
          </div>
        </div>
      </AnimatedOverlay>
    </PageShell>
  );
}
