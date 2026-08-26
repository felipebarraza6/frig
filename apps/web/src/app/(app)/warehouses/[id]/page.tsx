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
  ArrowUpDown,
  FileSpreadsheet,
  SlidersHorizontal,
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
  updateWarehouseProductQuantity,
  transferStock,
} from "@/lib/api/warehouses";
import { fetchProducts } from "@/lib/api/products";
import { formatCLP, cn, stockStatusLabel } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";

type WarehouseProduct = YggdraSchemas["WarehouseProduct"];

const SORT_OPTIONS = [
  { value: "product_name", label: "Producto" },
  { value: "product_category", label: "Categoría" },
  { value: "current_quantity", label: "Cantidad" },
  { value: "minimum_quantity", label: "Mínima" },
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

function SortIcon({
  field,
  sort,
}: {
  field: string;
  sort: { field: string; desc: boolean } | null;
}) {
  if (sort?.field !== field) {
    return (
      <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground" />
    );
  }
  return sort.desc ? (
    <ArrowDown className="ml-1 inline h-3 w-3 text-primary" />
  ) : (
    <ArrowUp className="ml-1 inline h-3 w-3 text-primary" />
  );
}

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl bg-muted", className)} />
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: "default" | "primary" | "emerald" | "violet" | "amber";
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
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums">{value}</p>
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
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<WarehouseProduct | null>(null);
  const [newQuantity, setNewQuantity] = useState("");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [transferProduct, setTransferProduct] = useState<WarehouseProduct | null>(null);
  const [transferQuantity, setTransferQuantity] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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

  const { data: catalogPage } = useQuery({
    queryKey: ["products", "catalog"],
    queryFn: () => fetchProducts({}),
  });
  const catalog = catalogPage?.results ?? [];

  const productSalePriceMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const p of catalogPage?.results ?? []) {
      map.set(p.id, numValue(p.sale_price));
    }
    return map;
  }, [catalogPage?.results]);

  const { data: warehousesPage } = useQuery({
    queryKey: ["warehouses", "all"],
    queryFn: () => fetchWarehouses({}),
  });
  const targetWarehouses = (warehousesPage?.results ?? []).filter((w) => w.id !== warehouseId);

  const handleSort = (field: string) => {
    setProductSort((prev) => {
      if (prev?.field === field) {
        return { field, desc: !prev.desc };
      }
      return { field, desc: false };
    });
    setProductPageUrl({});
  };

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

  const adjust = useMutation({
    mutationFn: () =>
      updateWarehouseProductQuantity(Number(adjustingProduct?.id), {
        initial_quantity: Number(newQuantity),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId, "products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouses", warehouseId] });
      setAdjustOpen(false);
      setAdjustingProduct(null);
      setNewQuantity("");
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
          <MetricCard icon={Package} label="Productos" value={totalProducts} />
          <MetricCard icon={Layers} label="Unidades" value={totalQuantity} tone="default" />
          <MetricCard icon={Coins} label="Valor costo" value={formatCLP(totalCost)} tone="emerald" />
          <MetricCard icon={TrendingUp} label="Valor venta" value={formatCLP(totalSale)} tone="violet" />
        </div>

        <div className="flex flex-col gap-3">
          {/* Desktop filters */}
          <div className="hidden flex-wrap items-end justify-between gap-3 md:flex">
            <div className="flex flex-wrap items-end gap-3">
              {hasAlerts && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/5 px-2.5 py-1">
                  {lowStock > 0 && (
                    <span className="text-xs text-amber-700">
                      {lowStock} stock bajo
                    </span>
                  )}
                  {lowStock > 0 && outOfStock > 0 && (
                    <span className="text-xs text-amber-400">·</span>
                  )}
                  {outOfStock > 0 && (
                    <span className="text-xs text-amber-700">
                      {outOfStock} sin stock
                    </span>
                  )}
                </div>
              )}
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
            </div>

            <div className={`flex flex-col gap-3 ${showMobileFilters ? "" : "hidden"}`}>
              {hasAlerts && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/5 px-2.5 py-1">
                  {lowStock > 0 && (
                    <span className="text-xs text-amber-700">
                      {lowStock} stock bajo
                    </span>
                  )}
                  {lowStock > 0 && outOfStock > 0 && (
                    <span className="text-xs text-amber-400">·</span>
                  )}
                  {outOfStock > 0 && (
                    <span className="text-xs text-amber-700">
                      {outOfStock} sin stock
                    </span>
                  )}
                </div>
              )}
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
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border">
            <table className="w-full table-fixed min-w-[840px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th
                    className="group w-auto min-w-[160px] cursor-pointer select-none px-3 py-2 text-left hover:bg-muted/50"
                    onClick={() => handleSort("product_name")}
                  >
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      Producto <SortIcon sort={productSort} field="product_name" />
                    </span>
                  </th>
                  <th
                    className="group w-28 cursor-pointer select-none px-3 py-2 text-left hover:bg-muted/50"
                    onClick={() => handleSort("product_category")}
                  >
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      Categoría <SortIcon sort={productSort} field="product_category" />
                    </span>
                  </th>
                  <th
                    className="group w-20 cursor-pointer select-none px-3 py-2 text-right hover:bg-muted/50"
                    onClick={() => handleSort("current_quantity")}
                  >
                    <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
                      Cantidad <SortIcon sort={productSort} field="current_quantity" />
                    </span>
                  </th>
                  <th
                    className="group w-20 cursor-pointer select-none px-3 py-2 text-right hover:bg-muted/50"
                    onClick={() => handleSort("minimum_quantity")}
                  >
                    <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
                      Mínima <SortIcon sort={productSort} field="minimum_quantity" />
                    </span>
                  </th>
                  <th
                    className="group w-28 cursor-pointer select-none px-3 py-2 text-right hover:bg-muted/50"
                    onClick={() => handleSort("total_value")}
                  >
                    <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
                      Costo <SortIcon sort={productSort} field="total_value" />
                    </span>
                  </th>
                  <th
                    className="group w-28 cursor-pointer select-none px-3 py-2 text-right hover:bg-muted/50"
                    onClick={() => handleSort("total_sale_value")}
                  >
                    <span className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
                      Venta <SortIcon sort={productSort} field="total_sale_value" />
                    </span>
                  </th>
                  <th
                    className="group w-24 cursor-pointer select-none px-3 py-2 text-center hover:bg-muted/50"
                    onClick={() => handleSort("stock_status")}
                  >
                    <span className="inline-flex items-center justify-center gap-1 whitespace-nowrap">
                      Estado <SortIcon sort={productSort} field="stock_status" />
                    </span>
                  </th>
                  <th className="w-20 px-3 py-2 text-right">Acciones</th>
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

                  return (
                    <tr key={wp.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium leading-tight">{wp.product_name}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1">
                              <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                {wp.product_measurement_unit}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{wp.product_code}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {wp.product_category ? (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {wp.product_category}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">
                        {wp.current_quantity}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {wp.minimum_quantity ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <div className="leading-tight">
                          <p className="font-medium text-emerald-700">{formatCLP(totalValue)}</p>
                          <p className="text-xs text-muted-foreground">{formatCLP(unitCost)} c/u</p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <div className="leading-tight">
                          <p className="font-medium text-primary">{formatCLP(totalSale)}</p>
                          <p className="text-xs text-muted-foreground">{formatCLP(salePrice)} c/u</p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                            isOk && "bg-success/10 text-success",
                            isLow && "bg-warning/10 text-warning",
                            isOut && "bg-danger/10 text-danger",
                            !isOk && !isLow && !isOut && "bg-muted text-muted-foreground",
                          )}
                        >
                          {stockStatusLabel(status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Ajustar cantidad"
                            onClick={() => {
                              setAdjustingProduct(wp);
                              setNewQuantity(String(wp.current_quantity));
                              setAdjustOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span className="sr-only">Ajustar</span>
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

          {/* Vista móvil de productos */}
          <div className="grid gap-3 sm:hidden">
            {products.map((wp) => {
              const unitCost = numValue(wp.product_cost);
              const totalValue = numValue(wp.total_value);
              const salePrice = productSalePriceMap.get(wp.product ?? 0) ?? 0;
              const totalSale = salePrice * wp.current_quantity;
              const status = wp.stock_status ?? "";
              const isOk = status === "IN_STOCK";
              const isLow = status === "LOW_STOCK";
              const isOut = status === "OUT_OF_STOCK";

              return (
                <div
                  key={wp.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-tight">{wp.product_name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                            {wp.product_measurement_unit}
                          </span>
                          {wp.product_category && (
                            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {wp.product_category}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground">{wp.product_code}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                        isOk && "bg-success/10 text-success",
                        isLow && "bg-warning/10 text-warning",
                        isOut && "bg-danger/10 text-danger",
                        !isOk && !isLow && !isOut && "bg-muted text-muted-foreground",
                      )}
                    >
                      {stockStatusLabel(status)}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-muted/50 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Cantidad</p>
                      <p className="text-sm font-semibold tabular-nums">{wp.current_quantity}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Mínima</p>
                      <p className="text-sm font-semibold tabular-nums">{wp.minimum_quantity ?? "—"}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">C/Unitario</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCLP(unitCost)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Costo</p>
                      <p className="text-sm font-semibold tabular-nums text-emerald-700">{formatCLP(totalValue)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">V/Unitario</p>
                      <p className="text-sm font-semibold tabular-nums">{formatCLP(salePrice)}</p>
                    </div>
                    <div className="rounded-xl bg-muted/50 p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Venta</p>
                      <p className="text-sm font-semibold tabular-nums text-primary">{formatCLP(totalSale)}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Ajustar cantidad"
                      onClick={() => {
                        setAdjustingProduct(wp);
                        setNewQuantity(String(wp.current_quantity));
                        setAdjustOpen(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span className="sr-only">Ajustar</span>
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
                </div>
              );
            })}
          </div>

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

      {adjustOpen && adjustingProduct && (
        <Modal title="Ajustar cantidad" onClose={() => setAdjustOpen(false)}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">{adjustingProduct.product_name}</p>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Nueva cantidad</label>
              <Input
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
              />
            </div>
            {adjust.isError && (
              <p className="text-sm text-danger">
                {adjust.error instanceof Error ? adjust.error.message : "Error al ajustar"}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAdjustOpen(false)} disabled={adjust.isPending}>
                Cancelar
              </Button>
              <Button onClick={() => adjust.mutate()} disabled={adjust.isPending || !newQuantity}>
                {adjust.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
