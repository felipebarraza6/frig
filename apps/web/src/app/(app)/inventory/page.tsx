"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, Plus, X, AlertTriangle, Package, AlertCircle, PackageX, TrendingDown, FileSpreadsheet, FileText, SlidersHorizontal, ArrowRightLeft, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  fetchInventoryMovements,
  createInventoryMovement,
  fetchLowStock,
  fetchOutOfStock,
  exportInventoryMovements,
  type MovementsFilter,
} from "@/lib/api/inventory";
import { fetchProducts } from "@/lib/api/products";
import { fetchWarehouses } from "@/lib/api/warehouses";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { cn } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";

type InventoryHistory = YggdraSchemas["InventoryHistory"];
type ProductInventorySummary = YggdraSchemas["ProductInventorySummary"];

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

function movementBadgeClass(movementType?: string | null) {
  switch (movementType) {
    case "IN":
    case "RETURN":
      return "bg-emerald-500/10 text-emerald-700";
    case "OUT":
    case "LOSS":
    case "DAMAGE":
      return "bg-danger/10 text-danger";
    case "TRANSFER":
      return "bg-blue-500/10 text-blue-700";
    case "ADJUSTMENT":
      return "bg-amber-500/10 text-amber-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function formatDateTime(v: string | null | undefined): string {
  if (!v) return "—";
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { download: downloadFile, isLoading: isExporting } = useDownloadFile();
  const [tab, setTab] = useState<"movements" | "alerts">("movements");
  const [search, setSearch] = useState("");
  const [movementType, setMovementType] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [alertSearch, setAlertSearch] = useState("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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
      product: productFilter ? Number(productFilter) : undefined,
      warehouse: warehouseFilter ? Number(warehouseFilter) : undefined,
      ...pageUrl,
    }),
    [search, movementType, productFilter, warehouseFilter, pageUrl],
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

  const alertMatches = (p: ProductInventorySummary, term: string) => {
    if (!term) return true;
    const t = term.toLowerCase();
    return (
      p.name?.toLowerCase().includes(t) ||
      p.code?.toLowerCase().includes(t) ||
      p.category_name?.toLowerCase().includes(t)
    );
  };

  const filteredLowStock = useMemo(
    () => lowStock.filter((p) => alertMatches(p, alertSearch)),
    [lowStock, alertSearch]
  );

  const filteredOutOfStock = useMemo(
    () => outOfStock.filter((p) => alertMatches(p, alertSearch)),
    [outOfStock, alertSearch]
  );

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

  function handleExport(format: "excel" | "pdf") {
    downloadFile(() => exportInventoryMovements(filter, format), {
      filename: exportFilename("movimientos_inventario", format === "excel" ? "xlsx" : "pdf"),
    });
  }

  function updateFilter<T>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Inventario</h1>
          <p className="text-xs text-muted-foreground">
            Movimientos y alertas de stock
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("excel")}
            disabled={isExporting}
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            title="Exportar Excel"
            aria-label="Exportar Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={isExporting}
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            title="Exportar PDF"
            aria-label="Exportar PDF"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button
            onClick={() => setModalOpen(true)}
            className="h-9 w-9 px-0 sm:w-auto sm:px-3"
            title="Registrar movimiento"
            aria-label="Registrar movimiento"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Registrar movimiento</span>
          </Button>
        </div>
      </header>

      <div className="border-b border-border px-4 sm:px-6">
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

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {tab === "movements" && (
          <>
            <div className="flex flex-col gap-3">
              {/* Desktop filters */}
              <div className="hidden flex-wrap items-end gap-3 md:flex">
                <div className="relative w-full max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => updateFilter(setSearch, e.target.value)}
                    placeholder="Buscar movimiento…"
                    className="pl-9"
                    aria-label="Buscar movimiento"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-movement" className="text-xs text-muted-foreground">Tipo</label>
                  <Select
                    id="filter-movement"
                    value={movementType}
                    onChange={(e) => updateFilter(setMovementType, e.target.value)}
                  >
                    <option value="">Todos</option>
                    {MOVEMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-product" className="text-xs text-muted-foreground">Producto</label>
                  <Select
                    id="filter-product"
                    value={productFilter}
                    onChange={(e) => updateFilter(setProductFilter, e.target.value)}
                  >
                    <option value="">Todos</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="filter-warehouse" className="text-xs text-muted-foreground">Bodega</label>
                  <Select
                    id="filter-warehouse"
                    value={warehouseFilter}
                    onChange={(e) => updateFilter(setWarehouseFilter, e.target.value)}
                  >
                    <option value="">Todas</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
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
                      placeholder="Buscar movimiento…"
                      className="pl-9"
                      aria-label="Buscar movimiento"
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
                    <label htmlFor="filter-movement-mobile" className="text-xs text-muted-foreground">Tipo</label>
                    <Select
                      id="filter-movement-mobile"
                      value={movementType}
                      onChange={(e) => updateFilter(setMovementType, e.target.value)}
                    >
                      <option value="">Todos</option>
                      {MOVEMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="filter-product-mobile" className="text-xs text-muted-foreground">Producto</label>
                    <Select
                      id="filter-product-mobile"
                      value={productFilter}
                      onChange={(e) => updateFilter(setProductFilter, e.target.value)}
                    >
                      <option value="">Todos</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="filter-warehouse-mobile" className="text-xs text-muted-foreground">Bodega</label>
                    <Select
                      id="filter-warehouse-mobile"
                      value={warehouseFilter}
                      onChange={(e) => updateFilter(setWarehouseFilter, e.target.value)}
                    >
                      <option value="">Todas</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {loadingMovements ? (
              <div className="grid flex-1 place-items-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : movements.length === 0 ? (
              <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
                <div>
                  <ArrowRightLeft className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-sm font-medium">No se encontraron movimientos</p>
                  <p className="text-xs text-muted-foreground">
                    Prueba con otros filtros o registra un nuevo movimiento.
                  </p>
                  <Button className="mt-4" size="sm" onClick={() => setModalOpen(true)}>
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Registrar movimiento
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
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
                          <td className="px-4 py-3">
                            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", movementBadgeClass(m.movement_type))}>
                              {movementLabel(m.movement_type)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">{m.quantity}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{m.previous_quantity}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{m.current_quantity}</td>
                          <td className="px-4 py-3 text-muted-foreground">{m.user_name ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {formatDateTime(m.created)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="grid gap-3 md:hidden">
                  {movements.map((m: InventoryHistory) => (
                    <div
                      key={m.id}
                      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                            <Package className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{m.product_name}</p>
                            <span className={cn("mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium", movementBadgeClass(m.movement_type))}>
                              {movementLabel(m.movement_type)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="text-muted-foreground">
                          <span className="block text-[10px] uppercase tracking-wide">Cantidad</span>
                          <span className="font-medium tabular-nums text-foreground">{m.quantity}</span>
                        </div>
                        <div className="text-muted-foreground">
                          <span className="block text-[10px] uppercase tracking-wide">Stock actual</span>
                          <span className="font-medium tabular-nums text-foreground">{m.current_quantity}</span>
                        </div>
                        <div className="text-muted-foreground">
                          <span className="block text-[10px] uppercase tracking-wide">Stock previo</span>
                          <span className="font-medium tabular-nums text-foreground">{m.previous_quantity}</span>
                        </div>
                        <div className="text-muted-foreground">
                          <span className="block text-[10px] uppercase tracking-wide">Usuario</span>
                          <span className="font-medium text-foreground">{m.user_name ?? "—"}</span>
                        </div>
                        <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDateTime(m.created)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
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
                      <span className="sm:hidden">Ant.</span>
                      <span className="hidden sm:inline">Anterior</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPageUrl({ next: movementsPage?.next })}
                      disabled={!movementsPage?.next}
                    >
                      <span className="sm:hidden">Sig.</span>
                      <span className="hidden sm:inline">Siguiente</span>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {tab === "alerts" && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4 text-danger" />
                  Sin stock
                </div>
                <p className="mt-1 text-2xl font-semibold">{outOfStock.length}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingDown className="h-4 w-4 text-amber-500" />
                  Stock bajo
                </div>
                <p className="mt-1 text-2xl font-semibold">{lowStock.length}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4 text-primary" />
                  Total alertas
                </div>
                <p className="mt-1 text-2xl font-semibold">{totalAlerts}</p>
              </div>
            </div>

            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={alertSearch}
                onChange={(e) => setAlertSearch(e.target.value)}
                placeholder="Buscar en alertas…"
                className="pl-9"
              />
            </div>

            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <PackageX className="h-4 w-4 text-danger" />
                Productos sin stock
              </h2>
              {filteredOutOfStock.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
                  <PackageX className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Sin productos sin stock</p>
                  <p className="text-xs text-muted-foreground">
                    {outOfStock.length === 0
                      ? "No hay productos sin stock."
                      : "Ningún producto sin stock coincide con la búsqueda."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3">Categoría</th>
                        <th className="px-4 py-3 text-right">Cantidad</th>
                        <th className="px-4 py-3 text-right">Stock mínimo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOutOfStock.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-danger/10 p-1">
                                <AlertTriangle className="h-3.5 w-3.5 text-danger" />
                              </span>
                              <div>
                                <p className="font-medium">{p.name}</p>
                                {p.code && <p className="text-xs text-muted-foreground">{p.code}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.category_name || "—"}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-danger">{p.quantity ?? 0}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{p.minimum_stock ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <TrendingDown className="h-4 w-4 text-amber-500" />
                Stock bajo
              </h2>
              {filteredLowStock.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
                  <TrendingDown className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Sin productos con stock bajo</p>
                  <p className="text-xs text-muted-foreground">
                    {lowStock.length === 0
                      ? "No hay productos con stock bajo."
                      : "Ningún producto con stock bajo coincide con la búsqueda."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-3">Producto</th>
                        <th className="px-4 py-3">Categoría</th>
                        <th className="px-4 py-3 text-right">Cantidad</th>
                        <th className="px-4 py-3 text-right">Stock mínimo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLowStock.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="rounded-full bg-amber-500/10 p-1">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              </span>
                              <div>
                                <p className="font-medium">{p.name}</p>
                                {p.code && <p className="text-xs text-muted-foreground">{p.code}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.category_name || "—"}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-amber-600">{p.quantity ?? 0}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{p.minimum_stock ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">Registrar movimiento</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="relative flex min-h-0 flex-1 flex-col">
          <div className="relative flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-4">
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
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
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
