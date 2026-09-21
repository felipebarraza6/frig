"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Minus, Package, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { useCategoryOptions } from "@/lib/hooks/useCategoryOptions";
import { searchProductsForSale, type ProductForSale } from "@/lib/api/products";
import { formatCLP } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ProductPickerDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Cantidad ya seleccionada por producto (suma de líneas). */
  quantitiesByProduct: Map<number, number>;
  /** +1 sobre la línea existente o crea una nueva. */
  onAdd: (product: ProductForSale) => void;
  /** −1 sobre la primera línea del producto; la elimina al llegar a 0. */
  onDecrement: (product: ProductForSale) => void;
  /** Z-index del overlay; debe quedar sobre el modal que lo abre. */
  zIndex?: string;
}

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Drawer de catálogo para venta/orden rápida: explorar productos sin
 * escribir, filtrar por categoría con chips y sumar/restar cantidades al
 * toque. Complementa al buscador del modal (teclado) con selección visual.
 */
export function ProductPickerDrawer({
  open,
  onClose,
  quantitiesByProduct,
  onAdd,
  onDecrement,
  zIndex = "z-[60]",
}: ProductPickerDrawerProps) {
  const { options: categories } = useCategoryOptions();
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [localQuery, setLocalQuery] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "for-sale", "picker-drawer", categoryId],
    queryFn: () =>
      searchProductsForSale({ category_id: categoryId ?? undefined }),
    enabled: open,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = localQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code ?? "").toLowerCase().includes(q),
    );
  }, [products, localQuery]);

  function close() {
    setLocalQuery("");
    setCategoryId(null);
    onClose();
  }

  return (
    <AnimatedOverlay
      open={open}
      onClose={close}
      zIndex={zIndex}
      className="bg-black/50"
      panelClassName="flex justify-end p-0"
    >
      <div className="flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Productos</h2>
            <p className="text-xs text-muted-foreground">
              Toca un producto para sumarlo; usa − / + para ajustar.
            </p>
          </div>
          <button
            onClick={close}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Chips de categoría */}
        <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border px-4 py-2.5 scrollbar-hide">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              categoryId === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/50",
            )}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                categoryId === c.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Búsqueda local (filtra la lista cargada, al instante) */}
        <div className="shrink-0 px-4 pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Filtrar por nombre o código…"
              className="pl-9"
              aria-label="Filtrar productos"
            />
          </div>
        </div>

        {/* Grilla de productos */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-border py-12 text-center">
              <div>
                <Package className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-muted-foreground">
                  Sin productos en esta categoría
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((p) => {
                const qty = quantitiesByProduct.get(Number(p.id)) ?? 0;
                return (
                  <div
                    key={String(p.id)}
                    role="button"
                    tabIndex={0}
                    onClick={() => onAdd(p)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onAdd(p);
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer flex-col justify-between gap-2 rounded-xl border p-2.5 text-left transition-colors",
                      qty > 0
                        ? "border-primary/50 bg-primary/5"
                        : "border-border bg-background hover:border-primary/40 hover:bg-muted/40",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-medium leading-snug">{p.name}</p>
                      <p className="mt-1 text-xs font-semibold tabular-nums text-muted-foreground">
                        {formatCLP(toNum(p.price))}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      {qty > 0 ? (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-primary">
                          {qty} en la venta
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">toca para sumar</span>
                      )}
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {qty > 0 && (
                          <button
                            type="button"
                            onClick={() => onDecrement(p)}
                            className="flex h-6 w-6 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:text-foreground"
                            aria-label={`Quitar un ${p.name}`}
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onAdd(p)}
                          className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
                          aria-label={`Agregar ${p.name}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AnimatedOverlay>
  );
}
