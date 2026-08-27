"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Loader2,
  Package,
  Plus,
  ArrowRightLeft,
  Pencil,
  X,
  Warehouse,
  ShieldCheck,
  Coins,
  TrendingUp,
  Layers,
  Search,
  ArrowUp,
  ArrowDown,
  FileSpreadsheet,
  SlidersHorizontal,
  LayoutGrid,
  List,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  fetchWarehouses,
  fetchWarehouse,
  fetchWarehouseProducts,
  addProductToWarehouse,
  updateWarehouseProduct,
  updateWarehouseProductQuantity,
  transferStock,
} from "@/lib/api/warehouses";
import { fetchProducts } from "@/lib/api/products";
import { fetchSupplierProductsByBranch } from "@/lib/api/suppliers";
import { formatCLP, cn, stockStatusLabel } from "@/lib/utils";
import { useCurrentBranch } from "@/lib/store/session";
import type { YggdraSchemas } from "@/lib/api/types";

type WarehouseProduct = YggdraSchemas["WarehouseProduct"];

const SORT_OPTIONS = [
  { value: "product_name", label: "Producto" },
  { value: "product_category", label: "Categoría" },
  { value: "current_quantity", label: "Cantidad" },
  { value: "minimum_quantity", label: "Mínima" },
  { value: "maximum_quantity", label: "Máxima" },
  { value: "product_cost", label: "C/Unitario" },
  { value: "total_value", label: "Costo" },
  { value: "sale_price", label: "V/Unitario" },
  { value: "total_sale_value", label: "Venta" },
  { value: "stock_status", label: "Estado" },
];

function numValue(v: string | null | undefined): number {
  return parseFloat(v || "0") || 0;
}

function typeLabel(value?: string | null): string {
  const labels: Record<string, string> = {
    GENERAL: "General",
    TOOLS: "Herramientas",
    RAW_MATERIAL: "Materias primas",
    WASTE: "Residuos",
    CUSTOM: "Personalizada",
  };
  if (!value) return "Bodega";
  return labels[value] ?? value;
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

async function exportWarehouseProductsToExcel(warehouseName: string, warehouseId: number) {
  const allResults: WarehouseProduct[] = [];
  let next: string | null | undefined = undefined;
  let first = true;
  while (first || next) {
    const data = await fetchWarehouseProducts(
      warehouseId,
      first ? { page_size: 1000 } : { next },
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
    Cantidad: wp.current_quantity,
    Mínima: wp.minimum_quantity ?? "",
    "Costo unitario": numValue(wp.product_cost),
    "Costo total": numValue(wp.total_value),
    "Estado": stockStatusLabel(wp.stock_status ?? ""),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Productos");
  const date = new Date().toLocaleDateString("en-CA");
  XLSX.writeFile(wb, `bodega-${warehouseName.toLowerCase().replace(/\s+/g, "-")}_${date}.xlsx`);
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-muted", className)} />
  );
}

function WarehouseProductCard({
  wp,
  supplierName,
  salePrice,
  onConfigure,
  onTransfer,
}: {
  wp: WarehouseProduct;
  supplierName?: string;
  salePrice: number;
  onConfigure: (wp: WarehouseProduct) => void;
  onTransfer: (wp: WarehouseProduct) => void;
}) {
  const totalValue = numValue(wp.total_value);
  const totalSale = salePrice * wp.current_quantity;
  const unitCost = numValue(wp.product_cost);
  const status = wp.stock_status ?? "";
  const isOk = status === "IN_STOCK";
  const isLow = status === "LOW_STOCK";
  const isOut = status === "OUT_OF_STOCK";

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
            <Package className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium leading-tight">{wp.product_name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                  isOk && "bg-success/10 text-success",
                  isLow && "bg-warning/10 text-warning",
                  isOut && "bg-danger/10 text-danger",
                  !isOk && !isLow && !isOut && "bg-muted text-muted-foreground",
                )}
              >
                {stockStatusLabel(status)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {wp.product_measurement_unit}
                {wp.product_code ? ` · ${wp.product_code}` : ""}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Configurar"
            onClick={() => onConfigure(wp)}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Configurar</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            title="Transferir a otra bodega"
            onClick={() => onTransfer(wp)}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span className="sr-only">Mover</span>
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground">Cantidad</p>
          <p className="text-sm font-semibold tabular-nums">{wp.current_quantity}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Rango</p>
          <p className="text-sm font-semibold tabular-nums">
            {wp.minimum_quantity ?? 0}-{wp.maximum_quantity ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Costo total</p>
          <p className="text-sm font-semibold tabular-nums text-success">{formatCLP(totalValue)}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] text-muted-foreground">Venta total</p>
          <p className="text-sm font-semibold tabular-nums text-primary">{formatCLP(totalSale)}</p>
          <p className="text-[10px] text-muted-foreground">{formatCLP(salePrice)} c/u</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Costo unitario</p>
          <p className="text-sm font-semibold tabular-nums text-success">{formatCLP(unitCost)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {wp.product_category && (
          <span className="inline-flex items-center rounded-sm bg-secondary px-2 py-1 text-[10px] font-medium text-foreground">
            {wp.product_category}
          </span>
        )}
        {supplierName && (
          <span
            className="inline-flex max-w-full items-center truncate rounded-sm bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary"
            title={supplierName}
          >
            {supplierName}
          </span>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "default",
  alert,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: "default" | "primary" | "emerald" | "violet" | "amber";
  alert?: React.ReactNode;
}) {
  const tones = {
    default: "bg-muted text-foreground",
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-700",
    violet: "bg-violet-500/10 text-violet-700",
    amber: "bg-amber-500/10 text-amber-700",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
          {alert && <div className="mt-1">{alert}</div>}
        </div>
      </div>
    </div>
  );
}

export default function WarehouseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const warehouseId = Number(params.id);
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [initialQuantity, setInitialQuantity] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [configProduct, setConfigProduct] = useState<WarehouseProduct | null>(null);
  const [configForm, setConfigForm] = useState({
    current_quantity: "",
    minimum_quantity: "",
    maximum_quantity: "",
    reorder_point: "",
    location_in_warehouse: "",
    is_active: true,
    is_preferred_location: false,
  });
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferProduct, setTransferProduct] = useState<WarehouseProduct | null>(null);
  const [transferQuantity, setTransferQuantity] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [view, setView] = useState<"grid" | "list">("grid");

  const [productSearch, setProductSearch] = useState("");
  const [productPageUrl, setProductPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [productSort, setProductSort] = useState<{ field: string; desc: boolean } | null>(null);

  const { data: warehouse, isLoading: loadingWarehouse } = useQuery({
    queryKey: ["warehouses", warehouseId],
    queryFn: () => fetchWarehouse(warehouseId),
    enabled: Boolean(warehouseId),
  });

  const productFilter = useMemo(
    () => ({
      search: productSearch || undefined,
      ordering: productSort ? `${productSort.desc ? "-" : ""}${productSort.field}` : undefined,
      ...productPageUrl,
    }),
    [productSearch, productSort, productPageUrl],
  );

  const { data: productsPage, isLoading: loadingProducts } = useQuery({
    queryKey: ["warehouses", warehouseId, "products", productFilter],
    queryFn: () => fetchWarehouseProducts(warehouseId, productFilter),
    enabled: Boolean(warehouseId),
  });
  const products = productsPage?.results ?? [];
  const totalProductsCount = productsPage?.count ?? 0;

  const { data: catalog = [] } = useQuery({
    queryKey: ["products", "catalog"],
    queryFn: async () => {
      // El catálogo completo alimenta productSalePriceMap y el modal de
      // agregar: sin paginar queda truncado a la primera página.
      const all: YggdraSchemas["ProductList"][] = [];
      let next: string | null | undefined;
      let first = true;
      let pages = 0;
      while ((first || next) && pages < 20) {
        const data = await fetchProducts(first ? { page_size: 2000 } : { next });
        all.push(...(data.results ?? []));
        next = data.next;
        first = false;
        pages++;
      }
      return all;
    },
    staleTime: 60_000,
  });

  const productSalePriceMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of catalog) {
      map.set(p.id, numValue(p.sale_price));
    }
    return map;
  }, [catalog]);

  const { data: warehousesPage } = useQuery({
    queryKey: ["warehouses", "all"],
    queryFn: () => fetchWarehouses({}),
  });
  const targetWarehouses = (warehousesPage?.results ?? []).filter((w) => w.id !== warehouseId);

  const branch = useCurrentBranch();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : undefined;

  const { data: supplierProducts = [] } = useQuery({
    queryKey: ["supplier-products", "by-branch", branchId],
    queryFn: () => fetchSupplierProductsByBranch(branchId!),
    enabled: Boolean(branchId),
    staleTime: 60_000,
  });

  const supplierNameByProduct = useMemo(() => {
    const map = new Map<number, string>();
    for (const sp of supplierProducts) {
      if (sp.product && !map.has(sp.product)) {
        map.set(sp.product, sp.supplier_name);
      }
    }
    return map;
  }, [supplierProducts]);

  const add = useMutation({
    mutationFn: () =>
      addProductToWarehouse({
        warehouse_id: warehouseId,
        product_id: Number(selectedProduct),
        initial_quantity: Number(initialQuantity),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId, "products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId] });
      setAddOpen(false);
      setSelectedProduct("");
      setInitialQuantity("");
    },
  });

  const config = useMutation({
    mutationFn: async () => {
      if (!configProduct) throw new Error("No hay producto seleccionado");
      const currentQuantity = Number(configForm.current_quantity);
      const configPayload: Partial<YggdraSchemas["PatchedWarehouseProductRequest"]> = {
        minimum_quantity:
          configForm.minimum_quantity === "" ? undefined : Number(configForm.minimum_quantity),
        maximum_quantity:
          configForm.maximum_quantity === "" ? null : Number(configForm.maximum_quantity),
        reorder_point:
          configForm.reorder_point === "" ? undefined : Number(configForm.reorder_point),
        location_in_warehouse: configForm.location_in_warehouse.trim() || null,
        is_active: configForm.is_active,
        is_preferred_location: configForm.is_preferred_location,
      };
      await Promise.all([
        updateWarehouseProductQuantity(Number(configProduct.id), { initial_quantity: currentQuantity }),
        updateWarehouseProduct(Number(configProduct.id), configPayload),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId, "products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId] });
      setConfigOpen(false);
      setConfigProduct(null);
      setConfigForm({
        current_quantity: "",
        minimum_quantity: "",
        maximum_quantity: "",
        reorder_point: "",
        location_in_warehouse: "",
        is_active: true,
        is_preferred_location: false,
      });
    },
  });

  const transfer = useMutation({
    mutationFn: () =>
      transferStock({
        source_warehouse_id: warehouseId,
        target_warehouse_id: Number(transferTarget),
        products: [
          {
            product_id: Number(transferProduct?.product),
            quantity: Number(transferQuantity),
          },
        ],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId, "products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId] });
      setTransferOpen(false);
      setTransferTarget("");
      setTransferProduct(null);
      setTransferQuantity("");
    },
  });

  if (loadingWarehouse) {
    return (
      <div className="flex min-h-full flex-col">
        <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/warehouses")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <SkeletonBlock className="h-6 w-48" />
            <SkeletonBlock className="mt-2 h-4 w-32" />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-24" />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-5 w-40" />
            <SkeletonBlock className="h-9 w-48" />
          </div>
          <SkeletonBlock className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!warehouse) {
    return (
      <div className="flex min-h-full flex-1 flex-col items-center justify-center p-6 text-center">
        <p className="text-muted-foreground">Bodega no encontrada.</p>
        <Button className="mt-4" onClick={() => router.push("/warehouses")}>
          Volver a bodegas
        </Button>
      </div>
    );
  }

  const totalProducts = numValue(warehouse.total_products);
  const totalQuantity = numValue(warehouse.total_quantity);
  const totalCost = numValue(warehouse.total_value);
  const totalSale = numValue(warehouse.total_sale_value);
  const lowStock = numValue(warehouse.low_stock_products);
  const outOfStock = numValue(warehouse.out_of_stock_products);
  const hasAlerts = lowStock > 0 || outOfStock > 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:px-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/warehouses")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold">{warehouse.name}</h1>
              {warehouse.is_default && (
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Principal
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {typeLabel(warehouse.warehouse_type)} · {warehouse.location ?? "Sin ubicación"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 self-start rounded-full border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden text-[10px] font-medium uppercase tracking-wide text-emerald-700 sm:inline">
              Verificado
            </span>
            <span className="text-[10px] text-emerald-600">
              {formatDateTime(warehouse.modified)}
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        {/* Métricas principales */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={Package}
            label="Productos de bodega"
            value={totalProducts}
            alert={
              hasAlerts ? (
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  {lowStock > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-1.5 py-0.5 font-medium text-warning">
                      {lowStock} bajo
                    </span>
                  )}
                  {outOfStock > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-1.5 py-0.5 font-medium text-danger">
                      {outOfStock} sin stock
                    </span>
                  )}
                </div>
              ) : undefined
            }
          />
          <MetricCard icon={Layers} label="Unidades" value={totalQuantity} tone="default" />
          <MetricCard icon={Coins} label="Valor costo" value={formatCLP(totalCost)} tone="emerald" />
          <MetricCard icon={TrendingUp} label="Valor venta" value={formatCLP(totalSale)} tone="violet" />
        </div>

        <div className="flex flex-col gap-3">
          {/* Desktop filters */}
          <div className="hidden flex-wrap items-end justify-between gap-3 md:flex">
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductPageUrl({});
                  }}
                  placeholder="Buscar producto…"
                  className="pl-9"
                  aria-label="Buscar producto"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center rounded-lg border border-border p-0.5">
                <Button
                  variant={view === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setView("grid")}
                  aria-label="Vista tarjetas"
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
                onClick={async () => {
                  setExporting(true);
                  try {
                    await exportWarehouseProductsToExcel(warehouse.name, warehouseId);
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                {exporting ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">Excel</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setTransferOpen(true)}>
                <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Transferir</span>
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                <span className="hidden sm:inline">Agregar</span>
              </Button>
            </div>
          </div>

          {/* Mobile filters */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductPageUrl({});
                  }}
                  placeholder="Buscar producto…"
                  className="pl-9"
                  aria-label="Buscar producto"
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
              <div className="flex items-center rounded-lg border border-border p-0.5">
                <Button
                  variant={view === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setView("grid")}
                  aria-label="Vista tarjetas"
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
            </div>

            <div className={`flex flex-col gap-3 ${showMobileFilters ? "" : "hidden"}`}>
              <div className="flex items-center gap-2">
                <Select
                  value={productSort?.field ?? ""}
                  onChange={(e) => {
                    const field = e.target.value;
                    if (!field) {
                      setProductSort(null);
                    } else {
                      setProductSort((prev) => ({
                        field,
                        desc: prev?.field === field ? !prev.desc : false,
                      }));
                    }
                    setProductPageUrl({});
                  }}
                  className="flex-1"
                >
                  <option value="">Ordenar por…</option>
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2"
                  disabled={!productSort}
                  onClick={() =>
                    setProductSort((prev) =>
                      prev ? { ...prev, desc: !prev.desc } : null
                    )
                  }
                  aria-label="Cambiar dirección"
                >
                  {productSort?.desc ? (
                    <ArrowDown className="h-4 w-4" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  disabled={exporting || products.length === 0}
                  onClick={async () => {
                    setExporting(true);
                    try {
                      await exportWarehouseProductsToExcel(warehouse.name, warehouseId);
                    } finally {
                      setExporting(false);
                    }
                  }}
                >
                  {exporting ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-1 h-3.5 w-3.5" />
                  )}
                  Excel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setTransferOpen(true)}
                >
                  <ArrowRightLeft className="mr-1 h-3.5 w-3.5" />
                  Transferir
                </Button>
                <Button size="sm" className="flex-1" onClick={() => setAddOpen(true)}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        </div>

        {loadingProducts ? (
          view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <SkeletonBlock className="h-10 w-10 shrink-0 rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <SkeletonBlock className="h-4 w-32" />
                      <SkeletonBlock className="mt-2 h-3 w-20" />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <SkeletonBlock className="h-8" />
                    <SkeletonBlock className="h-8" />
                    <SkeletonBlock className="h-8" />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <SkeletonBlock className="h-8" />
                    <SkeletonBlock className="h-8" />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <SkeletonBlock className="h-6 w-16" />
                    <SkeletonBlock className="h-6 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <div className="border-b border-border bg-muted/50 p-4">
                <SkeletonBlock className="h-4 w-48" />
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between border-b border-border p-4 last:border-0">
                  <div className="flex items-center gap-3">
                    <SkeletonBlock className="h-8 w-8" />
                    <div>
                      <SkeletonBlock className="h-4 w-32" />
                      <SkeletonBlock className="mt-1 h-3 w-20" />
                    </div>
                  </div>
                  <div className="flex items-center gap-8">
                    <SkeletonBlock className="h-4 w-12" />
                    <SkeletonBlock className="h-4 w-12" />
                    <SkeletonBlock className="h-6 w-16" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : products.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border p-12">
            <div className="text-center">
              <Warehouse className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">No hay productos en esta bodega</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Agrega productos para comenzar a gestionar su stock.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Agregar producto
              </Button>
            </div>
          </div>
        ) : (
          <>
          {view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {products.map((wp) => (
                <WarehouseProductCard
                  key={wp.id}
                  wp={wp}
                  supplierName={supplierNameByProduct.get(wp.product ?? 0)}
                  salePrice={productSalePriceMap.get(wp.product ?? 0) ?? 0}
                  onConfigure={(wp) => {
                    setConfigProduct(wp);
                    setConfigForm({
                      current_quantity: String(wp.current_quantity ?? 0),
                      minimum_quantity:
                        wp.minimum_quantity === null || wp.minimum_quantity === undefined
                          ? ""
                          : String(wp.minimum_quantity),
                      maximum_quantity:
                        wp.maximum_quantity === null || wp.maximum_quantity === undefined
                          ? ""
                          : String(wp.maximum_quantity),
                      reorder_point:
                        wp.reorder_point === null || wp.reorder_point === undefined
                          ? ""
                          : String(wp.reorder_point),
                      location_in_warehouse: wp.location_in_warehouse ?? "",
                      is_active: wp.is_active ?? true,
                      is_preferred_location: wp.is_preferred_location ?? false,
                    });
                    setConfigOpen(true);
                  }}
                  onTransfer={(wp) => {
                    setTransferProduct(wp);
                    setTransferOpen(true);
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full table-auto min-w-[950px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 text-left">Producto</th>
                    <th className="px-3 py-2 text-left">Proveedor</th>
                    <th className="px-3 py-2 text-right">Cantidad</th>
                    <th className="px-3 py-2 text-right">Rango</th>
                    <th className="px-3 py-2 text-right">Costo</th>
                    <th className="px-3 py-2 text-right">Venta</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((wp) => {
                    const unitCost = numValue(wp.product_cost);
                    const totalValue = numValue(wp.total_value);
                    const salePrice = productSalePriceMap.get(wp.product ?? 0) ?? 0;
                    const totalSale = salePrice * wp.current_quantity;
                    const status = wp.stock_status ?? "";
                    const isOk = status === "IN_STOCK";
                    const isLow = status === "LOW_STOCK";
                    const isOut = status === "OUT_OF_STOCK";
                    const supplierName = supplierNameByProduct.get(wp.product ?? 0);

                    return (
                      <tr key={wp.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2">
                          <div className="min-w-0 max-w-[280px]">
                            <p className="truncate font-medium leading-tight">{wp.product_name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                                  isOk && "bg-success/10 text-success",
                                  isLow && "bg-warning/10 text-warning",
                                  isOut && "bg-danger/10 text-danger",
                                  !isOk && !isLow && !isOut && "bg-muted text-muted-foreground",
                                )}
                              >
                                {stockStatusLabel(status)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {wp.product_measurement_unit}
                                {wp.product_code ? ` · ${wp.product_code}` : ""}
                              </span>
                            </div>
                            {wp.product_category && (
                              <span className="mt-1 inline-flex items-center rounded-sm bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground">
                                {wp.product_category}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {supplierName ? (
                            <span
                              className="inline-flex max-w-full items-center truncate rounded-sm bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary"
                              title={supplierName}
                            >
                              {supplierName}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium whitespace-nowrap">
                          {wp.current_quantity}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          <div className="inline-flex flex-col items-end leading-tight whitespace-nowrap">
                            <span><span className="text-[10px]">mín</span> {wp.minimum_quantity ?? 0}</span>
                            <span><span className="text-[10px]">máx</span> {wp.maximum_quantity ?? "—"}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          <div className="leading-tight">
                            <p className="font-medium text-success">{formatCLP(totalValue)}</p>
                            <p className="text-xs text-muted-foreground">{formatCLP(unitCost)} c/u</p>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                          <div className="leading-tight">
                            <p className="font-medium text-primary">{formatCLP(totalSale)}</p>
                            <p className="text-xs text-muted-foreground">{formatCLP(salePrice)} c/u</p>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Configurar"
                              onClick={() => {
                                setConfigProduct(wp);
                                setConfigForm({
                                  current_quantity: String(wp.current_quantity ?? 0),
                                  minimum_quantity:
                                    wp.minimum_quantity === null || wp.minimum_quantity === undefined
                                      ? ""
                                      : String(wp.minimum_quantity),
                                  maximum_quantity:
                                    wp.maximum_quantity === null || wp.maximum_quantity === undefined
                                      ? ""
                                      : String(wp.maximum_quantity),
                                  reorder_point:
                                    wp.reorder_point === null || wp.reorder_point === undefined
                                      ? ""
                                      : String(wp.reorder_point),
                                  location_in_warehouse: wp.location_in_warehouse ?? "",
                                  is_active: wp.is_active ?? true,
                                  is_preferred_location: wp.is_preferred_location ?? false,
                                });
                                setConfigOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span className="sr-only">Configurar</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              title="Transferir a otra bodega"
                              onClick={() => {
                                setTransferProduct(wp);
                                setTransferOpen(true);
                              }}
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                              <span className="sr-only">Mover</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">
              {totalProductsCount} producto{totalProductsCount === 1 ? "" : "s"} en total
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProductPageUrl({ previous: productsPage?.previous })}
                disabled={!productsPage?.previous}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProductPageUrl({ next: productsPage?.next })}
                disabled={!productsPage?.next}
              >
                Siguiente
              </Button>
            </div>
          </div>
          </>
        )}
      </div>

      {addOpen && (
        <Modal title="Agregar producto a bodega" onClose={() => setAddOpen(false)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Producto</label>
              <Select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
              >
                <option value="">Selecciona un producto</option>
                {catalog.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Cantidad inicial</label>
              <Input
                type="number"
                min="0"
                value={initialQuantity}
                onChange={(e) => setInitialQuantity(e.target.value)}
              />
            </div>
            {add.isError && (
              <p className="text-sm text-danger">
                {add.error instanceof Error ? add.error.message : "Error al agregar"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)} disabled={add.isPending}>
                Cancelar
              </Button>
              <Button
                onClick={() => add.mutate()}
                disabled={add.isPending || !selectedProduct || !initialQuantity}
              >
                {add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Agregar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {configOpen && configProduct && (
        <Modal
          title="Configuración de producto en bodega"
          onClose={() => setConfigOpen(false)}
        >
          <div className="flex flex-col gap-5">
            <p className="text-sm text-muted-foreground">{configProduct.product_name}</p>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Cantidades</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="current_quantity">
                    Cantidad <span className="text-danger">*</span>
                  </label>
                  <Input
                    id="current_quantity"
                    type="number"
                    min="0"
                    value={configForm.current_quantity}
                    onChange={(e) =>
                      setConfigForm((prev) => ({ ...prev, current_quantity: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="minimum_quantity">
                    Cantidad mínima
                  </label>
                  <Input
                    id="minimum_quantity"
                    type="number"
                    min="0"
                    value={configForm.minimum_quantity}
                    onChange={(e) =>
                      setConfigForm((prev) => ({ ...prev, minimum_quantity: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="maximum_quantity">
                    Cantidad máxima
                  </label>
                  <Input
                    id="maximum_quantity"
                    type="number"
                    min="0"
                    value={configForm.maximum_quantity}
                    onChange={(e) =>
                      setConfigForm((prev) => ({ ...prev, maximum_quantity: e.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="reorder_point">
                    Punto de reorden
                  </label>
                  <Input
                    id="reorder_point"
                    type="number"
                    min="0"
                    value={configForm.reorder_point}
                    onChange={(e) =>
                      setConfigForm((prev) => ({ ...prev, reorder_point: e.target.value }))
                    }
                  />
                </div>
              </div>
              {Number(configForm.current_quantity) < 0 && (
                <p className="text-sm text-danger">La cantidad no puede ser negativa.</p>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Ubicación</h3>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" htmlFor="location_in_warehouse">
                  Ubicación en bodega
                </label>
                <Input
                  id="location_in_warehouse"
                  value={configForm.location_in_warehouse}
                  onChange={(e) =>
                    setConfigForm((prev) => ({ ...prev, location_in_warehouse: e.target.value }))
                  }
                  placeholder="Estante, pasillo, etc."
                />
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Estado</h3>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={configForm.is_active}
                    onChange={(e) =>
                      setConfigForm((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  Activo en bodega
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={configForm.is_preferred_location}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        is_preferred_location: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  Ubicación preferida
                </label>
              </div>
            </div>

            {config.isError && (
              <p className="text-sm text-danger">
                {config.error instanceof Error ? config.error.message : "Error al guardar"}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfigOpen(false)}
                disabled={config.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() => config.mutate()}
                disabled={
                  config.isPending ||
                  configForm.current_quantity === "" ||
                  Number(configForm.current_quantity) < 0
                }
              >
                {config.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {transferOpen && (
        <Modal title="Transferir stock" onClose={() => setTransferOpen(false)}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Producto</label>
              <Select
                value={transferProduct?.id ?? ""}
                onChange={(e) => {
                  const wp = products.find((p) => String(p.id) === e.target.value) ?? null;
                  setTransferProduct(wp);
                }}
              >
                <option value="">Selecciona un producto</option>
                {products.map((wp) => (
                  <option key={wp.id} value={wp.id}>{wp.product_name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Bodega destino</label>
              <Select
                value={transferTarget}
                onChange={(e) => setTransferTarget(e.target.value)}
              >
                <option value="">Selecciona bodega</option>
                {targetWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Cantidad</label>
              <Input
                type="number"
                min="0"
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(e.target.value)}
              />
            </div>
            {transfer.isError && (
              <p className="text-sm text-danger">
                {transfer.error instanceof Error ? transfer.error.message : "Error al transferir"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTransferOpen(false)} disabled={transfer.isPending}>
                Cancelar
              </Button>
              <Button
                onClick={() => transfer.mutate()}
                disabled={transfer.isPending || !transferProduct || !transferTarget || !transferQuantity}
              >
                {transfer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Transferir
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/40 p-0 md:items-center md:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
