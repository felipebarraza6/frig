"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Power, Loader2, Package, AlertTriangle, FileSpreadsheet, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCLP } from "@/lib/utils";
import {
  fetchProducts,
  fetchProduct,
  createProduct,
  updateProduct,
  setProductActive,
  deleteProduct,
  exportProducts,
  type ProductPayload,
  type ProductsFilter,
} from "@/lib/api/products";
import { ProductForm } from "@/components/products/product-form";
import { ProductWarehousesModal } from "@/components/products/product-warehouses-modal";
import { ProductActionsMenu } from "@/components/products/product-actions-menu";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { useBranchProductTypes } from "@/lib/hooks/useBranchProductTypes";
import { useCategoryOptions } from "@/lib/hooks/useCategoryOptions";
import { useToast } from "@/lib/store/toast";
import { useCurrentBranch } from "@/lib/store/session";
import type { YggdraProduct } from "@/lib/api/types";

function isLowStock(p: YggdraProduct): boolean {
  if (p.minimum_stock === undefined || p.minimum_stock === null) return false;
  return (p.quantity ?? 0) <= p.minimum_stock;
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const branch = useCurrentBranch();
  const { download: downloadFile, isLoading: isExporting } = useDownloadFile();
  const { options: productTypeOptions, labelFor: productTypeLabel } = useBranchProductTypes();
  const { options: categoryOptions, isLoading: loadingCategories, error: categoriesError, refetch: refetchCategories } = useCategoryOptions();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [productType, setProductType] = useState("");
  const [forSale, setForSale] = useState("");
  const [active, setActive] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [creating, setCreating] = useState(false);
  // Para editar se carga el detalle completo: el listado (ProductList) no trae
  // is_public ni nutrición y re-guardar desde ahí borra esos datos.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<YggdraProduct | null>(null);
  const [viewingWarehouses, setViewingWarehouses] = useState<YggdraProduct | null>(null);

  const { data: editingProduct, isLoading: loadingEditing } = useQuery({
    queryKey: ["products", "detail", editingId],
    queryFn: () => fetchProduct(editingId!),
    enabled: !!editingId,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Estado actualizado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo actualizar el estado.");
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setConfirmDelete(null);
      toast.success("Producto eliminado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo eliminar el producto.");
    },
  });

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    remove.mutate(confirmDelete.id);
  }

  const onSubmit = async (payload: ProductPayload, id?: number): Promise<YggdraProduct> => {
    const product = id
      ? await updateProduct(id, payload)
      : await createProduct(payload);
    queryClient.invalidateQueries({ queryKey: ["products"] });
    toast.success(id ? "Producto actualizado" : "Producto creado");
    return product;
  };

  async function handleDuplicate(product: YggdraProduct) {
    try {
      const detail = await fetchProduct(product.id);
      const { id, ...payload } = detail;
      void id;
      await createProduct({
        ...payload,
        name: `${detail.name} (copia)`,
        code: detail.code ? `${detail.code}-copia` : null,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Producto duplicado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar el producto.");
    }
  }

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
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
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
            className="h-9 w-9 px-0 sm:h-9 sm:w-auto sm:px-3"
            title="Exportar Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("pdf")}
            disabled={isExporting}
            className="h-9 w-9 px-0 sm:h-9 sm:w-auto sm:px-3"
            title="Exportar PDF"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button onClick={() => setCreating(true)} className="h-9 px-2 sm:px-3">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo producto</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => updateFilter(setSearch, e.target.value)}
              placeholder="Buscar por nombre…"
              className="pl-9"
              aria-label="Buscar producto"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-category" className="text-xs text-muted-foreground">Categoría</label>
              <Select
                id="filter-category"
                value={category}
                disabled={loadingCategories}
                onChange={(e) => updateFilter(setCategory, e.target.value)}
              >
                <option value="">Todas</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              {!loadingCategories && categoryOptions.length === 0 && (
                <div className="flex flex-col gap-1 text-xs text-amber-700">
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>Sin categorías para <strong>{branch?.branch_name ?? "esta sucursal"}</strong>.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => refetchCategories()}
                    className="w-fit underline hover:text-amber-800"
                  >
                    Reintentar
                  </button>
                </div>
              )}
              {categoriesError && (
                <p className="text-xs text-danger">
                  Error: {categoriesError.message || "No se pudieron cargar las categorías."}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-type" className="text-xs text-muted-foreground">Tipo</label>
              <Select
                id="filter-type"
                value={productType}
                onChange={(e) => updateFilter(setProductType, e.target.value)}
              >
                <option value="">Todos</option>
                {productTypeOptions.map((t) => (
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
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudo cargar el catálogo.</p>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {products.length === 0 ? (
              <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted-foreground">
                  {search || category || productType || forSale || active
                    ? "No se encontraron productos con esos filtros."
                    : "Aún no hay productos creados."}
                </p>
              </div>
            ) : (
              <>
                {/* Vista de tabla para desktop */}
                <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
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
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary">
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
                            <ProductActionsMenu
                              product={p}
                              onEdit={() => setEditingId(p.id)}
                              onViewWarehouses={() => setViewingWarehouses(p)}
                              onDuplicate={() => handleDuplicate(p)}
                              onDelete={() => setConfirmDelete(p)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Vista de cards para móvil */}
                <div className="grid gap-3 sm:hidden">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.name}</p>
                            {p.code && <p className="text-xs text-muted-foreground">{p.code}</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => toggleActive.mutate({ id: p.id, isActive: !p.is_active })}
                          aria-label={`${p.is_active ? "Desactivar" : "Activar"} ${p.name}`}
                          className={`shrink-0 rounded-full p-2 ${
                            p.is_active
                              ? "text-emerald-600 hover:bg-emerald-500/10"
                              : "text-muted-foreground hover:bg-muted hover:text-danger"
                          }`}
                        >
                          <Power className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Categoría</p>
                          <p className="truncate">{p.category && typeof p.category === "object" ? p.category.name : "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Tipo</p>
                          <p className="truncate">{productTypeLabel(p.product_type)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Precio</p>
                          <p className="tabular-nums">{formatCLP(p.sale_price ?? p.price ?? "0")}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Stock</p>
                          <div className="flex items-center gap-1">
                            <span className="tabular-nums">{p.quantity ?? 0}</span>
                            {isLowStock(p) && (
                              <span title="Stock bajo">
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span
                          className={
                            p.is_for_sale
                              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          }
                        >
                          Venta: {p.is_for_sale ? "Sí" : "No"}
                        </span>
                        <span
                          className={
                            p.is_active
                              ? "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700"
                              : "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {p.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                        <ProductActionsMenu
                          product={p}
                          onEdit={() => setEditingId(p.id)}
                          onViewWarehouses={() => setViewingWarehouses(p)}
                          onDuplicate={() => handleDuplicate(p)}
                          onDelete={() => setConfirmDelete(p)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">
                {totalProducts} producto{totalProducts === 1 ? "" : "s"} en total
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1 sm:h-9 sm:flex-none"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  <span className="sm:hidden">Ant.</span>
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1 sm:h-9 sm:flex-none"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  <span className="sm:hidden">Sig.</span>
                  <span className="hidden sm:inline">Siguiente</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {viewingWarehouses && (
        <ProductWarehousesModal
          product={viewingWarehouses}
          onClose={() => setViewingWarehouses(null)}
        />
      )}

      {loadingEditing && editingId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        </div>
      )}

      {creating && (
        <ProductForm
          onClose={() => setCreating(false)}
          onSubmit={onSubmit}
        />
      )}

      {editingProduct && (
        <ProductForm
          product={editingProduct}
          onClose={() => {
            if (editingId) queryClient.removeQueries({ queryKey: ["products", "detail", editingId] });
            setEditingId(null);
          }}
          onSubmit={onSubmit}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h2 className="text-base font-semibold">Eliminar producto</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              ¿Seguro que quieres eliminar <strong>{confirmDelete.name}</strong>? El producto
              quedará desactivado (soft-delete) y se ocultará del catálogo y del POS.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(null)}
                disabled={remove.isPending}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={remove.isPending}
              >
                {remove.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Eliminar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
