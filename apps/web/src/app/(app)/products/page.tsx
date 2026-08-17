"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Power, Loader2, Package, AlertTriangle, Warehouse, X, FileSpreadsheet, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCLP } from "@/lib/utils";
import {
  fetchProducts,
  createProduct,
  updateProduct,
  setProductActive,
  deleteProduct,
  exportProducts,
  type ProductPayload,
  type ProductsFilter,
} from "@/lib/api/products";
import { fetchCategoryList } from "@/lib/api/categories";
import { fetchProductWarehouses } from "@/lib/api/warehouses";
import { ProductForm } from "@/components/products/product-form";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import type { YggdraProduct } from "@/lib/api/types";

const PRODUCT_TYPES = [
  { value: "DIRECT_SALE", label: "Simple" },
  { value: "RECIPE_BASED", label: "Compuesto" },
  { value: "RAW_MATERIAL", label: "Ingrediente" },
] as const;

function productTypeLabel(value?: string | null): string {
  return PRODUCT_TYPES.find((t) => t.value === value)?.label ?? (value ?? "—");
}

function isLowStock(p: YggdraProduct): boolean {
  if (p.minimum_stock === undefined || p.minimum_stock === null) return false;
  return (p.quantity ?? 0) <= p.minimum_stock;
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const { download: downloadFile, isLoading: isExporting } = useDownloadFile();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("");
  const [forSale, setForSale] = useState("");
  const [active, setActive] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [editing, setEditing] = useState<YggdraProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [viewingWarehouses, setViewingWarehouses] = useState<YggdraProduct | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "list"],
    queryFn: fetchCategoryList,
  });

  const { data: productWarehouses = [], isLoading: loadingProductWarehouses } = useQuery({
    queryKey: ["products", viewingWarehouses?.id, "warehouses"],
    queryFn: () => fetchProductWarehouses(viewingWarehouses!.id),
    enabled: Boolean(viewingWarehouses),
  });

  const filter = useMemo<ProductsFilter>(
    () => ({
      search: search || undefined,
      category: category ? Number(category) : undefined,
      product_type: productType || undefined,
      is_for_sale: forSale ? forSale === "true" : undefined,
      is_active: active ? active === "true" : undefined,
      ...pageUrl,
    }),
    [search, category, productType, forSale, active, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["products", "manage", filter],
    queryFn: () => fetchProducts(filter),
  });

  const products = page?.results ?? [];
  const totalProducts = page?.count ?? 0;

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      setProductActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const onSubmit = async (payload: ProductPayload, id?: number): Promise<YggdraProduct> => {
    const product = id
      ? await updateProduct(id, payload)
      : await createProduct(payload);
    queryClient.invalidateQueries({ queryKey: ["products"] });
    return product;
  };

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function handleExport(format: "excel" | "pdf") {
    downloadFile(() => exportProducts(filter, format), {
      filename: exportFilename("productos", format === "excel" ? "xlsx" : "pdf"),
    });
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Productos</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona el catálogo de la sucursal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("excel")}
            disabled={isExporting}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={isExporting}
          >
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            Nuevo producto
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="Buscar por nombre…"
              className="pl-9"
              aria-label="Buscar producto"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-category" className="text-xs text-muted-foreground">Categoría</label>
            <Select
              id="filter-category"
              value={category}
              onChange={(e) => updateFilter(setCategory, e.target.value)}
            >
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
            <Select
              id="filter-type"
              value={productType}
              onChange={(e) => updateFilter(setProductType, e.target.value)}
            >
              <option value="">Todos</option>
              {PRODUCT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-sale" className="text-xs text-muted-foreground">Venta</label>
            <Select
              id="filter-sale"
              value={forSale}
              onChange={(e) => updateFilter(setForSale, e.target.value)}
            >
              <option value="">Todos</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-active" className="text-xs text-muted-foreground">Activo</label>
            <Select
              id="filter-active"
              value={active}
              onChange={(e) => updateFilter(setActive, e.target.value)}
            >
              <option value="">Todos</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </Select>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudo cargar el catálogo.</p>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Precio</th>
                    <th className="px-4 py-3 text-center">Stock</th>
                    <th className="px-4 py-3 text-center">Venta</th>
                    <th className="px-4 py-3 text-center">Activo</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary">
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.name}</p>
                            {p.code && (
                              <p className="text-xs text-muted-foreground">{p.code}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.category && typeof p.category === "object" ? p.category.name : "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {productTypeLabel(p.product_type)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatCLP(p.sale_price ?? p.price ?? "0")}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="tabular-nums">{p.quantity ?? 0}</span>
                          {isLowStock(p) && (
                            <span title="Stock bajo">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={
                            p.is_for_sale
                              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {p.is_for_sale ? "Sí" : "No"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            toggleActive.mutate({ id: p.id, isActive: !p.is_active })
                          }
                          aria-label={`${p.is_active ? "Desactivar" : "Activar"} ${p.name}`}
                          className={
                            p.is_active
                              ? "text-emerald-600 hover:text-emerald-700"
                              : "text-muted-foreground hover:text-danger"
                          }
                        >
                          <Power className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(p)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingWarehouses(p)}
                          >
                            <Warehouse className="h-3.5 w-3.5" />
                            Bodegas
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-danger hover:text-danger"
                            onClick={() => remove.mutate(p.id)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                {totalProducts} producto{totalProducts === 1 ? "" : "s"} en total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {viewingWarehouses && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">
                Bodegas de {viewingWarehouses.name}
              </h2>
              <button
                onClick={() => setViewingWarehouses(null)}
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {loadingProductWarehouses ? (
              <div className="grid place-items-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : productWarehouses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este producto no está asignado a ninguna bodega. Ve a <strong>Bodegas</strong> para asignarlo.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {productWarehouses.map((wp) => (
                  <div
                    key={wp.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{wp.warehouse?.name ?? `Bodega #${wp.warehouse}`}</p>
                      <p className="text-xs text-muted-foreground">Cantidad: {wp.current_quantity}</p>
                    </div>
                    <Warehouse className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setViewingWarehouses(null)}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {(creating || editing) && (
        <ProductForm
          product={editing ?? undefined}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={onSubmit}
        />
      )}
    </div>
  );
}
