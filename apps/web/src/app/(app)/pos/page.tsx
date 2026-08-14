"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Loader2, Box, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import CartPanel from "@/components/pos/cart-panel";
import { useProducts, useCategories } from "@/lib/hooks/useCatalog";
import { useCartStore } from "@/lib/store/cart";
import type { PosProduct } from "@/lib/api/types";
import { formatCLP, cn } from "@/lib/utils";
import { useCurrentBranch } from "@/lib/store/session";
import { branchName } from "@/lib/types";

function productTypeLabel(type?: string): string {
  if (type === "DIRECT_SALE") return "Simple";
  if (type === "RECIPE_BASED") return "Compuesto";
  return type ?? "—";
}

function stockStatus(product: PosProduct): { text: string; variant: "ok" | "low" | "empty" } {
  const qty = product.quantity ?? 0;
  const min = product.minimum_stock ?? 0;
  if (qty === 0) return { text: "Sin stock", variant: "empty" };
  if (min > 0 && qty <= min) return { text: "Stock bajo", variant: "low" };
  return { text: `${qty} disp.`, variant: "ok" };
}

function StockBadge({ product }: { product: PosProduct }) {
  const status = stockStatus(product);
  if (status.variant === "ok") {
    return <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">{status.text}</span>;
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
      <AlertTriangle className="h-3 w-3" />
      {status.text}
    </span>
  );
}

export default function PosPage() {
  const branch = useCurrentBranch();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

  const addItem = useCartStore((s) => s.addItem);

  const { data: products, isLoading: productsLoading, error: productsError } =
    useProducts();
  const { data: categories } = useCategories();

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory !== null && p.categoryId !== activeCategory) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, activeCategory]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold">Punto de venta</h1>
          <p className="text-xs text-muted-foreground">
            {branch ? `Sucursal: ${branchName(branch)}` : "Sin sucursal seleccionada"}
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto…"
            className="w-64 pl-9"
            aria-label="Buscar producto"
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col gap-4 p-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-[transform,opacity,background-color] duration-150",
                activeCategory === null
                  ? "border-primary bg-primary text-white"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              Todos
            </button>
            {categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setActiveCategory(activeCategory === cat.id ? null : cat.id)
                }
                className={cn(
                  "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-[transform,opacity,background-color] duration-150",
                  activeCategory === cat.id
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {productsError ? (
            <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">
                No se pudo cargar el catálogo. Revisa la conexión con Yggdra.
              </p>
            </div>
          ) : productsLoading ? (
            <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">
                No hay productos que coincidan.
              </p>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 overflow-y-auto pr-1">
              <AnimatePresence>
                {filtered.map((product, i) => (
                  <motion.button
                    key={product.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(i * 0.02, 0.3) }}
                    onClick={() => addItem(product)}
                    disabled={(product.quantity ?? 0) === 0}
                    className="group flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-left transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-medium leading-tight">
                        {product.name}
                      </p>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 disabled:group-hover:opacity-0">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    {product.categoryName && (
                      <p className="truncate text-xs text-muted-foreground">
                        {product.categoryName}
                      </p>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <Box className="h-3 w-3" />
                          {productTypeLabel(product.product_type)}
                        </span>
                        <StockBadge product={product} />
                      </div>
                      <p className="text-base font-semibold tabular-nums">
                        {formatCLP(product.price)}
                      </p>
                    </div>
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        <CartPanel />
      </div>
    </div>
  );
}
