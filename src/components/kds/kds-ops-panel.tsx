"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChefHat,
  ClipboardList,
  Package,
  Search,
  ShoppingBag,
  Warehouse,
  X,
} from "lucide-react";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchProductInventory } from "@/lib/api/inventory";
import { fetchOrders } from "@/lib/api/orders";
import {
  fetchProduct,
  fetchProductsForSalePage,
  type ProductForSale,
} from "@/lib/api/products";
import { fetchRecipe, fetchRecipeSteps } from "@/lib/api/recipes";
import type { KitchenStation } from "@/lib/api/kitchen-stations";
import { useBranchRecipeMaps } from "@/lib/hooks/useBranchRecipeMaps";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { statusBadge } from "@/lib/status-styles";
import { formatCLP, orderStatusLabel, cn } from "@/lib/utils";

export type KdsOpsTab = "inventory" | "orders" | "products";

interface KdsOpsPanelProps {
  open: boolean;
  initialTab?: KdsOpsTab;
  onClose: () => void;
  /** Estación activa: filtra productos por sus categorías cuando aplica. */
  station?: KitchenStation | null;
}

function formatStock(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

const TABS: { key: KdsOpsTab; label: string; icon: typeof Package }[] = [
  { key: "inventory", label: "Inventario", icon: Package },
  { key: "orders", label: "Órdenes", icon: ShoppingBag },
  { key: "products", label: "Productos", icon: ChefHat },
];

export function KdsOpsPanel({
  open,
  initialTab = "inventory",
  onClose,
  station,
}: KdsOpsPanelProps) {
  const [tab, setTab] = useState<KdsOpsTab>(initialTab);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync intencional al montar/cambiar deps (código 3D/KDS recuperado)
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  const ActiveIcon = TABS.find((t) => t.key === tab)?.icon ?? Package;

  return (
    <AnimatedOverlay
      open={open}
      onClose={onClose}
      className="bg-black/55"
      zIndex="z-[80]"
      panelClassName="flex items-end justify-center sm:items-center sm:p-4"
    >
      <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:h-[85vh] sm:max-w-2xl sm:rounded-3xl">
        <div className="relative shrink-0 overflow-hidden border-b border-border bg-gradient-to-br from-primary/15 via-card to-card px-4 pb-3 pt-4">
          <div
            className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/20 blur-2xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-10 left-10 h-20 w-20 rounded-full bg-secondary/30 blur-2xl"
            aria-hidden
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25">
                <ActiveIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                  Consulta
                </p>
                <h2 className="truncate text-lg font-bold tracking-tight">
                  Cocina
                  {station ? (
                    <span className="font-semibold text-muted-foreground">
                      {" "}
                      · {station.name}
                    </span>
                  ) : null}
                </h2>
                <p className="text-xs text-muted-foreground">Solo lectura · apoyo al cocinero</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-xl border-border/80 bg-background/80"
              onClick={onClose}
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="shrink-0 border-b border-border bg-muted/40 px-3 py-2.5">
          <div className="flex gap-1 rounded-2xl border border-border/70 bg-background p-1 shadow-sm">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2.5 text-xs font-semibold transition-all sm:text-sm",
                    active
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-muted/30 to-background">
          {tab === "inventory" && <InventoryPane station={station} />}
          {tab === "orders" && <OrdersPane />}
          {tab === "products" && <ProductsPane station={station} />}
        </div>
      </div>
    </AnimatedOverlay>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="shrink-0 px-4 pt-3">
      <div className="relative rounded-2xl border border-border/80 bg-card shadow-sm">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-11 border-0 bg-transparent pl-10 shadow-none focus-visible:ring-0"
          aria-label={placeholder}
        />
      </div>
    </div>
  );
}

function InventoryPane({ station }: { station?: KitchenStation | null }) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 250);
  const categoryIds = useMemo(
    () => new Set((station?.categories ?? []).map((c) => c.id)),
    [station],
  );

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["kds-ops-inventory", debounced],
    queryFn: () =>
      fetchProductInventory({
        search: debounced.trim() || undefined,
        page_size: 200,
      }),
  });

  const filtered = useMemo(() => {
    if (categoryIds.size === 0) return inventory;
    // product-inventory may not include category id consistently; keep name match via search
    // and soft-filter when category_name matches station categories.
    const names = new Set(
      (station?.categories ?? []).map((c) => c.name.toLowerCase()),
    );
    return inventory.filter((p) => {
      if (!p.category_name) return true;
      return names.has(p.category_name.toLowerCase());
    });
  }, [inventory, categoryIds, station]);

  return (
    <div className="flex h-full flex-col">
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Buscar stock por nombre o código…"
      />
      {station && categoryIds.size > 0 && (
        <p className="px-4 pt-2 text-[11px] text-muted-foreground">
          Prioriza categorías de esta estación cuando aplica
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title="Sin stock para mostrar"
            subtitle="Prueba otra búsqueda o revisa bodega."
          />
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((p) => {
              const qty = Number(p.stock_available);
              const low =
                p.minimum_stock != null && qty <= Number(p.minimum_stock);
              const empty = qty <= 0;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-sm"
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      empty
                        ? "bg-danger/10 text-danger"
                        : low
                          ? "bg-warning/15 text-warning"
                          : "bg-primary/10 text-primary",
                    )}
                  >
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.code, p.category_name].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={cn(
                        "text-base font-bold tabular-nums",
                        empty ? "text-danger" : low ? "text-warning" : "text-foreground",
                      )}
                    >
                      {formatStock(p.stock_available)}
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {empty ? "Sin stock" : low ? "Bajo" : "Stock"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function OrdersPane() {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 250);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["kds-ops-orders", debounced],
    queryFn: () =>
      fetchOrders({
        search: debounced.trim() || undefined,
        status: ["PENDING", "IN_PROGRESS", "COMPLETED"],
        page_size: 40,
        ordering: "-created",
      }),
  });

  const orders = data?.results ?? [];

  return (
    <div className="flex h-full flex-col">
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Buscar orden por número o cliente…"
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-3">
        {isLoading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Sin órdenes recientes"
            subtitle="Las órdenes activas aparecerán aquí."
          />
        ) : (
          <ul className="space-y-2.5">
            {orders.map((o) => {
              const open = selectedId === o.id;
              const code = o.order_number
                ? `#${o.order_number}`
                : `#${o.id.slice(0, 8)}`;
              const clientName =
                o.client && typeof o.client === "object" && "name" in o.client
                  ? String((o.client as { name?: string }).name || "Sin cliente")
                  : "Sin cliente";
              const products = o.products ?? [];
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(open ? null : o.id)}
                    className={cn(
                      "w-full rounded-2xl border bg-card p-3.5 text-left shadow-sm transition-all",
                      open
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border/80 hover:border-primary/40 hover:shadow-md",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/20 text-foreground">
                        <ShoppingBag className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold tabular-nums">
                              {code}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {clientName}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <span
                              className={cn(
                                "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                                statusBadge(o.status),
                              )}
                            >
                              {orderStatusLabel(o.status)}
                            </span>
                            <p className="mt-1 text-xs font-semibold tabular-nums">
                              {formatCLP(o.total_amount ?? 0)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {open && (
                      <div className="mt-3 rounded-xl border border-border/70 bg-muted/40 p-3">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Ítems
                        </p>
                        <ul className="space-y-1.5">
                          {products.length === 0 ? (
                            <li className="text-xs text-muted-foreground">
                              Sin ítems en el listado.
                            </li>
                          ) : (
                            products.map((it) => (
                              <li
                                key={it.id}
                                className="flex justify-between gap-2 text-sm"
                              >
                                <span>
                                  {it.product_name}
                                  {it.notes ? (
                                    <span className="ml-1 text-xs text-warning">
                                      ({it.notes})
                                    </span>
                                  ) : null}
                                </span>
                                <span className="font-semibold tabular-nums text-muted-foreground">
                                  ×{it.quantity ?? 0}
                                </span>
                              </li>
                            ))
                          )}
                        </ul>
                        {o.observation ? (
                          <p className="mt-2 rounded-lg bg-warning/10 px-2 py-1.5 text-xs text-warning">
                            {o.observation}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ProductsPane({ station }: { station?: KitchenStation | null }) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, 300);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<ProductForSale[]>([]);

  const stationCats = station?.categories ?? [];
  const searchQ = debounced.trim() || undefined;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync intencional al montar/cambiar deps (código 3D/KDS recuperado)
    setPage(1);
    setAccumulated([]);
  }, [searchQ, categoryId]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["kds-ops-products", searchQ, categoryId, page],
    queryFn: () =>
      fetchProductsForSalePage({
        search: searchQ,
        category_id: categoryId ?? undefined,
        page_size: 20,
        page,
      }),
  });

  useEffect(() => {
    if (!data?.results) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync intencional al montar/cambiar deps (código 3D/KDS recuperado)
    setAccumulated((prev) => (page === 1 ? data.results : [...prev, ...data.results]));
  }, [data, page]);

  const products = accumulated;
  const hasMore = Boolean(data?.next);
  const total = data?.count ?? products.length;

  const { recipesByProductId, ingredientsByRecipeId, isLoading: recipesLoading } =
    useBranchRecipeMaps(true);

  const listProduct = products.find((p) => p.id === detailId) ?? null;

  if (detailId != null) {
    return (
      <ProductDetailView
        productId={detailId}
        listProduct={listProduct}
        recipe={recipesByProductId.get(detailId)}
        ingredients={
          recipesByProductId.get(detailId)
            ? ingredientsByRecipeId.get(recipesByProductId.get(detailId)!.id) ?? []
            : []
        }
        recipesLoading={recipesLoading}
        onBack={() => setDetailId(null)}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Filtrar por nombre o código…"
      />
      {stationCats.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-2">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-sm transition-colors",
              categoryId == null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/80 bg-card hover:bg-muted",
            )}
          >
            Todas
          </button>
          {stationCats.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-sm transition-colors",
                categoryId === c.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/80 bg-card hover:bg-muted",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <p className="px-4 pt-2 text-[11px] text-muted-foreground">
        {isLoading && page === 1
          ? "Cargando productos…"
          : `${products.length} de ${total} · Ver detalle abre ficha y preparación`}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-2">
        {isLoading && page === 1 ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[4.5rem] w-full rounded-2xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={ChefHat}
            title="Sin productos"
            subtitle={
              searchQ
                ? "No hay coincidencias con ese filtro."
                : "No hay productos de venta en esta sucursal."
            }
          />
        ) : (
          <ul className="space-y-2.5">
            {products.map((p) => {
              const hasRecipe = recipesByProductId.has(p.id);
              const stock =
                "stock_available" in p && p.stock_available != null
                  ? Number(p.stock_available)
                  : p.quantity;
              return (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 shadow-sm"
                >
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                      hasRecipe
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {hasRecipe ? (
                      <BookOpen className="h-5 w-5" />
                    ) : (
                      <ChefHat className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.code, p.category_name].filter(Boolean).join(" · ") ||
                        "Producto"}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {hasRecipe && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Receta
                        </span>
                      )}
                      {stock != null && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                          Stock {formatStock(stock)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="shrink-0 rounded-xl"
                    onClick={() => setDetailId(p.id)}
                  >
                    Detalle
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {hasMore && (
          <div className="pt-3">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl"
              disabled={isFetching}
              isLoading={isFetching && page > 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Ver más productos
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductDetailView({
  productId,
  listProduct,
  recipe,
  ingredients,
  recipesLoading,
  onBack,
}: {
  productId: number;
  listProduct: ProductForSale | null;
  recipe: ReturnType<ReturnType<typeof useBranchRecipeMaps>["recipesByProductId"]["get"]>;
  ingredients: NonNullable<
    ReturnType<ReturnType<typeof useBranchRecipeMaps>["ingredientsByRecipeId"]["get"]>
  >;
  recipesLoading: boolean;
  onBack: () => void;
}) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ["kds-ops-product-detail", productId],
    queryFn: () => fetchProduct(productId),
  });

  const recipeId = recipe?.id ?? null;
  const { data: recipeDetail, isLoading: recipeDetailLoading } = useQuery({
    queryKey: ["kds-ops-recipe-detail", recipeId],
    queryFn: () => fetchRecipe(recipeId!),
    enabled: !!recipeId,
  });

  const { data: stepsFromApi = [] } = useQuery({
    queryKey: ["kds-ops-recipe-steps", recipeId],
    queryFn: () => fetchRecipeSteps(recipeId!),
    enabled: !!recipeId,
  });

  const fullRecipe = recipeDetail ?? recipe;
  const steps = useMemo(() => {
    const nested = fullRecipe && "steps" in fullRecipe ? fullRecipe.steps : undefined;
    const list = (nested && nested.length > 0 ? nested : stepsFromApi) ?? [];
    return [...list].sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0));
  }, [fullRecipe, stepsFromApi]);

  const instructions = (fullRecipe?.instructions ?? "").trim();
  const recipeNotes = (fullRecipe?.notes ?? "").trim();
  const prepMin = fullRecipe?.preparation_time_minutes;
  const cookMin = fullRecipe?.cooking_time_minutes;
  const totalMin = fullRecipe?.total_time_minutes;

  const name = detail?.name ?? listProduct?.name ?? "Producto";
  const code = detail?.code ?? listProduct?.code;
  const categoryName =
    listProduct?.category_name ||
    (detail?.category && typeof detail.category === "object"
      ? (detail.category as { name?: string }).name
      : undefined);
  const stock =
    listProduct && "stock_available" in listProduct && listProduct.stock_available != null
      ? Number(listProduct.stock_available)
      : listProduct?.quantity ?? detail?.quantity;
  const description = detail?.description;

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-muted/30 to-background">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card/80 px-3 py-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={onBack}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Volver
        </Button>
        <span className="text-xs font-medium text-muted-foreground">Ficha de producto</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading && !listProduct ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3 rounded-xl" />
            <Skeleton className="h-4 w-1/2 rounded-xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ChefHat className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold tracking-tight">{name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {[code, categoryName].filter(Boolean).join(" · ") || "Sin código"}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl border border-border/80 bg-card px-3 py-3 shadow-sm">
                <p className="text-[11px] font-medium text-muted-foreground">Stock</p>
                <p className="text-lg font-bold tabular-nums">
                  {stock != null ? formatStock(stock) : "—"}
                </p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-card px-3 py-3 shadow-sm">
                <p className="text-[11px] font-medium text-muted-foreground">Unidad</p>
                <p className="text-lg font-bold">
                  {detail?.measurement_unit || "—"}
                </p>
              </div>
            </div>

            {description ? (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Descripción
                </p>
                <p className="text-sm leading-relaxed text-foreground/90">{description}</p>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ingredientes
              </p>
              {recipesLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : !recipe ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  Este producto no tiene receta asociada.
                </p>
              ) : (
                <div className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-sm">
                  {recipe.name ? (
                    <p className="mb-2 text-sm font-medium">{recipe.name}</p>
                  ) : null}
                  {ingredients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Receta sin ingredientes cargados.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {ingredients
                        .slice()
                        .sort(
                          (a, b) =>
                            (a.order_in_recipe ?? 0) - (b.order_in_recipe ?? 0),
                        )
                        .map((ing) => (
                          <li
                            key={ing.id}
                            className="flex justify-between gap-3 py-2 text-sm first:pt-0 last:pb-0"
                          >
                            <span>
                              {ing.ingredient_name}
                              {ing.is_optional ? (
                                <span className="ml-1 text-[10px] text-muted-foreground">
                                  opcional
                                </span>
                              ) : null}
                              {ing.preparation_notes ? (
                                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                                  {ing.preparation_notes}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                              {formatStock(ing.quantity)} {ing.unit}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {recipe && (
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Preparación
                </p>

                {(prepMin != null || cookMin != null || totalMin != null) && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-border bg-muted/30 px-2 py-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Prep</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {prepMin != null ? `${prepMin} min` : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 px-2 py-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Cocción</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {cookMin != null ? `${cookMin} min` : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/30 px-2 py-2 text-center">
                      <p className="text-[10px] text-muted-foreground">Total</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {totalMin != null
                          ? `${totalMin} min`
                          : prepMin != null || cookMin != null
                            ? `${(Number(prepMin) || 0) + (Number(cookMin) || 0)} min`
                            : "—"}
                      </p>
                    </div>
                  </div>
                )}

                {recipeDetailLoading && !instructions ? (
                  <Skeleton className="h-20 w-full" />
                ) : instructions ? (
                  <div className="rounded-2xl border border-primary/35 bg-primary/10 p-3.5 shadow-sm">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      Instrucciones de preparación
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {instructions}
                    </p>
                  </div>
                ) : (
                  <p className="rounded-2xl border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
                    Sin instrucciones de preparación en la receta.
                  </p>
                )}

                {steps.length > 0 && (
                  <div className="rounded-2xl border border-border/80 bg-card p-3.5 shadow-sm">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Pasos
                    </p>
                    <ol className="space-y-3">
                      {steps.map((step) => (
                        <li key={step.id} className="flex gap-3 text-sm">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                            {step.step_number}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{step.title}</p>
                            <p className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
                              {step.description}
                            </p>
                            {step.estimated_time_minutes != null && (
                              <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                                ~{step.estimated_time_minutes} min
                              </p>
                            )}
                            {step.tips ? (
                              <p className="mt-1 text-[11px] text-primary">Tip: {step.tips}</p>
                            ) : null}
                            {step.warnings ? (
                              <p className="mt-1 text-[11px] text-warning">
                                Atención: {step.warnings}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {recipeNotes ? (
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Notas
                    </p>
                    <p className="whitespace-pre-wrap text-sm">{recipeNotes}</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Package;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-border/70 bg-card text-muted-foreground shadow-sm">
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
