"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import CartPanel from "@/components/pos/cart-panel";
import { useProducts, useCategories } from "@/lib/hooks/useCatalog";
import { useCartStore } from "@/lib/store/cart";
import { formatCLP, cn } from "@/lib/utils";
import { useCurrentBranch } from "@/lib/store/session";
import { branchName } from "@/lib/types";

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
                    className="group flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-left transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-medium leading-tight">
                        {product.name}
                      </p>
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <Plus className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    {product.categoryName && (
                      <p className="truncate text-xs text-muted-foreground">
                        {product.categoryName}
                      </p>
                    )}
                    <p className="mt-auto text-base font-semibold tabular-nums">
                      {formatCLP(product.price)}
                    </p>
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
