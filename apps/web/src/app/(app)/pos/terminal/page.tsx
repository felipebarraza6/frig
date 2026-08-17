"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  Loader2,
  Receipt,
  ClipboardList,
  X,
  RefreshCcw,
  ArrowRight,
  ArrowLeft,
  Table,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import CartPanel from "@/components/pos/cart-panel";
import { ProductCard } from "@/components/pos/product-card";
import OrderCollectModal from "@/components/orders/order-collect-modal";
import {
  useProducts,
  useCategories,
  useProductModifierGroups,
  useCombos,
  getModifierGroupsForProduct,
  type ComboList,
} from "@/lib/hooks/useCatalog";
import { fetchCombo } from "@/lib/api/combos";
import {
  fetchPublicCatalogs,
  fetchPublicMenuBySlug,
} from "@/lib/api/public-catalog";
import { fetchCashRegisterStations } from "@/lib/api/cash-register-stations";
import { fetchOrders, fetchOrder } from "@/lib/api/orders";
import { useElapsedTime } from "@/lib/hooks/useElapsedTime";
import { fetchPaymentMethods } from "@/lib/api/payments";
import { getCurrentCashRegister } from "@/lib/api/cash-register";
import { fetchTables } from "@/lib/api/tables";
import { useCartStore, type CartItemModifier, cartSubtotal, cartDiscountTotal } from "@/lib/store/cart";
import type { PosProduct, YggdraSchemas } from "@/lib/api/types";
import { formatCLP, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { useRouter } from "next/navigation";

type Order = YggdraSchemas["Order"] & { order_number?: string | null };
type TableItem = YggdraSchemas["Table"];
import {
  useCurrentBranch,
  useCurrentBranchStation,
  useCanViewTables,
  useIsWaiter,
  useSessionStore,
} from "@/lib/store/session";
import { useIsModuleEnabled } from "@/lib/hooks/useBranchModules";
import { branchName } from "@/lib/types";
import ModifierModal from "@/components/pos/modifier-modal";
import { WaiterTablesView } from "@/components/pos/waiter-tables-view";
import { ComboPickerModal } from "@/components/pos/combo-picker-modal";
import { TablesCanvas } from "@/components/tables/tables-canvas";
import type { ProductModifierGroup } from "@/lib/hooks/useCatalog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";

export default function PosPage() {
  const branch = useCurrentBranch();
  const userStation = useCurrentBranchStation();
  const user = useSessionStore((s) => s.user);
  const realIsWaiter = useIsWaiter();
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const queryStationId = searchParams.get("station_id");
  const queryView = searchParams.get("view");
  const queryOrderId = searchParams.get("order_id");
  const queryReturnTo = searchParams.get("return_to");
  const isWaiterSimulation = queryView === "waiter";
  const isWaiter = realIsWaiter || isWaiterSimulation;
  const activeStationId = queryStationId
    ? Number(queryStationId)
    : userStation?.station_id
      ? Number(userStation.station_id)
      : null;

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [modifierProduct, setModifierProduct] = useState<PosProduct | null>(null);
  const [modifierGroups, setModifierGroups] = useState<ProductModifierGroup[]>([]);
  const [showOpenAccounts, setShowOpenAccounts] = useState(false);
  const [showTableMap, setShowTableMap] = useState(false);
  const [showComboPicker, setShowComboPicker] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [collectingOrder, setCollectingOrder] = useState<Order | null>(null);
  // undefined = sin interacción (usa table_id del query param), null = sin mesa, TableItem = mesa elegida
  const [selectedTableState, setSelectedTableState] = useState<TableItem | null | undefined>(undefined);

  function goToWaiterTablesView() {
    setSelectedTableState(undefined);
    const url = new URL("/pos/terminal", window.location.origin);
    url.searchParams.set("view", "waiter");
    if (queryReturnTo) url.searchParams.set("return_to", queryReturnTo);
    if (queryStationId) url.searchParams.set("station_id", queryStationId);
    router.push(url.pathname + url.search);
  }

  const canViewTables = useCanViewTables();
  const tablesEnabled = useIsModuleEnabled("tables");
  const showTables = (canViewTables && tablesEnabled) || isWaiterSimulation;
  const toast = useToast();

  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const cartTotal = useMemo(() => {
    const subtotal = cartSubtotal(cartItems);
    const discounts = cartDiscountTotal(cartItems);
    return Math.max(0, subtotal - discounts);
  }, [cartItems]);

  const { data: products, isLoading: productsLoading, error: productsError } =
    useProducts();
  const { data: categories } = useCategories();
  const { data: productModifierGroups } = useProductModifierGroups();
  const { data: combos } = useCombos();

  const { data: openAccountsPage, isLoading: loadingOpenAccounts } = useQuery({
    queryKey: ["orders", "open-accounts", "pos-terminal"],
    queryFn: () =>
      fetchOrders({
        payment_status: "PENDING",
      }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: paymentMethods } = useQuery({
    queryKey: ["payment-methods", "pos-terminal"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });

  const { data: currentCashRegister } = useQuery({
    queryKey: ["cash-register", "current", activeStationId],
    queryFn: () => getCurrentCashRegister(activeStationId),
    staleTime: 30_000,
    retry: false,
    refetchInterval: 30_000,
  });

  const { data: stations = [] } = useQuery({
    queryKey: ["cash-register-stations", "pos-terminal"],
    queryFn: fetchCashRegisterStations,
    staleTime: 60_000,
  });

  const { data: tablesPage } = useQuery({
    queryKey: ["tables", "pos-terminal"],
    queryFn: () => fetchTables({ is_active: true, page_size: 200 }),
    enabled: showTables,
    staleTime: 30_000,
  });

  const tables = useMemo(() => tablesPage?.results ?? [], [tablesPage]);

  const myTables = useMemo(() => {
    if (!isWaiter || !user) return tables;
    const assigned = tables.filter(
      (t) => t.assigned_waiter != null && String(t.assigned_waiter) === String(user.id),
    );
    // Si el mesero no tiene mesas asignadas, mostramos todas para no bloquearlo,
    // pero idealmente el admin debe asignarle mesas.
    return assigned.length > 0 ? assigned : tables;
  }, [tables, isWaiter, user]);

  const queryTableId = searchParams.get("table_id");
  const queryTable = useMemo(() => {
    if (!queryTableId) return null;
    return tables.find((t) => String(t.id) === String(queryTableId)) ?? null;
  }, [tables, queryTableId]);

  const effectiveOrderId =
    queryOrderId ||
    queryTable?.current_order_id ||
    selectedTableState?.current_order_id ||
    null;

  const {
    data: existingOrder,
    isLoading: loadingExistingOrder,
    error: existingOrderError,
  } = useQuery({
    queryKey: ["order", "pos-terminal", effectiveOrderId],
    queryFn: () => fetchOrder(effectiveOrderId as string),
    enabled: Boolean(effectiveOrderId),
    staleTime: 30_000,
  });

  const existingOrderElapsed = useElapsedTime(existingOrder?.date, {
    enabled: Boolean(effectiveOrderId && existingOrder),
  });

  const isEditingOrder = Boolean(effectiveOrderId);

  const existingTable = useMemo(() => {
    if (!existingOrder?.table || tables.length === 0) return null;
    return (
      tables.find((t) => String(t.id) === String(existingOrder.table)) ?? null
    );
  }, [existingOrder, tables]);

  const selectedTable =
    selectedTableState !== undefined
      ? selectedTableState
      : (queryTable ?? existingTable);
  const setSelectedTable = (t: TableItem | null) => setSelectedTableState(t);

  const activeStation = useMemo(() => {
    if (!activeStationId) return null;
    return stations.find((s) => s.id === activeStationId) ?? null;
  }, [stations, activeStationId]);

  const { data: catalogs } = useQuery({
    queryKey: ["public-catalogs", "pos-terminal"],
    queryFn: () => fetchPublicCatalogs(),
    staleTime: 60_000,
  });

  const assignedCatalog = useMemo(() => {
    if (!activeStationId || !catalogs?.results) return null;
    return catalogs.results.find(
      (c) => c.station_type === "POS" && c.station === activeStationId,
    ) ?? null;
  }, [catalogs, activeStationId]);

  const { data: assignedMenu, isLoading: assignedMenuLoading } = useQuery({
    queryKey: ["public-menu", assignedCatalog?.slug],
    queryFn: () => fetchPublicMenuBySlug(assignedCatalog!.slug),
    enabled: Boolean(assignedCatalog?.slug),
    staleTime: 60_000,
  });

  const allowedProductIds = useMemo(() => {
    if (!assignedMenu?.products) return null;
    return new Set(assignedMenu.products.map((p) => p.id));
  }, [assignedMenu]);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (p.product_type === "RAW_MATERIAL") return false;
      if (allowedProductIds && !allowedProductIds.has(p.id)) return false;
      if (activeCategory !== null && p.categoryId !== activeCategory) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, activeCategory, allowedProductIds]);

  function handleAddProduct(product: PosProduct) {
    const groups = productModifierGroups
      ? getModifierGroupsForProduct(product.id, productModifierGroups)
      : [];
    if (groups.length > 0) {
      setModifierProduct(product);
      setModifierGroups(groups);
    } else {
      addItem(product);
      toast.success(`${product.name} agregado`);
      // En móvil abrir el carrito para que el usuario vea el ítem agregado.
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setCartOpen(true);
      }
    }
  }

  function handleConfirmModifiers(modifiers: CartItemModifier[]) {
    if (modifierProduct) {
      addItem(modifierProduct, { modifiers });
      toast.success(`${modifierProduct.name} agregado`);
      if (typeof window !== "undefined" && window.innerWidth < 768) {
        setCartOpen(true);
      }
    }
    setModifierProduct(null);
    setModifierGroups([]);
  }

  async function handleAddCombo(combo: ComboList) {
    try {
      const detail = await fetchCombo(combo.id);
      const regularTotal = detail.items.reduce(
        (sum: number, item: { product: number; quantity?: number }) => {
          const product = products?.find((p) => p.id === item.product);
          if (!product) return sum;
          return sum + product.price * (item.quantity || 1);
        },
        0,
      );
      const comboPrice = Math.round(parseFloat(detail.combo_price || "0") || 0);
      const ratio = regularTotal > 0 ? comboPrice / regularTotal : 1;

      for (const item of detail.items) {
        const product = products?.find((p) => p.id === item.product);
        if (!product) continue;
        const lineTotal = product.price * (item.quantity || 1);
        const discountedLineTotal = Math.max(0, Math.round(lineTotal * ratio));
        const discountPercentage = lineTotal > 0
          ? Math.max(0, Math.min(100, Math.round(((lineTotal - discountedLineTotal) / lineTotal) * 100 * 100) / 100))
          : 0;
        addItem(product, {
          quantity: item.quantity || 1,
          discountPercentage,
          notes: `Parte de combo: ${combo.name}`,
        });
      }
      toast.success(`Combo "${combo.name}" agregado a la cuenta`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el combo.");
    }
  }

  const visibleOpenAccounts = useMemo(() => {
    if (!isWaiter || !user) return openAccountsPage?.results ?? [];
    const myTableIds = new Set(myTables.map((t) => t.id));
    return (openAccountsPage?.results ?? []).filter(
      (o) => o.table && myTableIds.has(o.table),
    );
  }, [openAccountsPage, isWaiter, user, myTables]);

  const itemCount = useCartStore((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const existingOrderTotal = existingOrder
    ? Math.max(0, parseFloat(existingOrder.total_amount ?? "0"))
    : 0;
  const existingItemCount = useMemo(
    () =>
      existingOrder?.products?.reduce(
        (sum, p) => sum + (p.quantity || 0),
        0,
      ) ?? 0,
    [existingOrder],
  );
  const displayCartTotal = cartTotal + existingOrderTotal;
  const displayItemCount = itemCount + existingItemCount;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-muted/30">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          {queryReturnTo && (
            <Link
              href={decodeURIComponent(queryReturnTo)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Volver"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          )}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Receipt className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight">Terminal</h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {branch ? branchName(branch) : "Sin sucursal"}
              {activeStation && <span className="ml-1.5 text-primary">· {activeStation.name}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {!activeStationId && !isWaiter && (
            <span className="hidden rounded-md bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-700 lg:inline-block">
              Sin estación asignada
            </span>
          )}
          {effectiveOrderId && existingOrder && (
            <span className="hidden rounded-md bg-primary/10 px-2.5 py-1 text-[11px] text-primary sm:inline-block">
              Orden #{existingOrder.id.slice(0, 8)} · {existingOrderElapsed.text} · {formatCLP(parseFloat(existingOrder.total_amount ?? "0"))}
            </span>
          )}

          {!isWaiter && (
            <button
              type="button"
              onClick={() => setShowOpenAccounts(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Cuentas</span>
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                {openAccountsPage?.count ?? 0}
              </span>
            </button>
          )}

          {!(isWaiter && !selectedTable && !isEditingOrder) && (
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-white transition-colors hover:bg-primary/90 md:hidden"
            >
              Cuenta
              {displayItemCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-semibold text-primary">
                  {displayItemCount}
                </span>
              )}
            </button>
          )}

          <div className="relative hidden w-44 sm:block sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-8 rounded-lg border-border/60 bg-background pl-8 text-xs"
              aria-label="Buscar producto"
            />
          </div>
        </div>
      </header>

      {/* Área de trabajo */}
      <div className="flex min-h-0 flex-1 pb-16 md:pb-0">
        {/* Catálogo */}
        <section className="min-w-0 flex-1 overflow-hidden border-r border-border/60 bg-background">
        {isWaiter && !selectedTable && !isEditingOrder ? (
          <WaiterTablesView
            tables={myTables}
            onSelect={(table) => setSelectedTable(table)}
          />

        ) : (
        <div className="flex h-full flex-col">
          {/* Header del catálogo */}
          <div className="flex shrink-0 flex-col gap-1.5 border-b border-border/60 bg-muted/20 p-2">
            {isWaiter && selectedTable && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToWaiterTablesView}
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 bg-background px-2 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
                >
                  ← Volver a mesas
                </button>
                <span className="text-[11px] font-medium text-primary">
                  Mesa {selectedTable.number} {selectedTable.area ? `· ${selectedTable.area}` : ""}
                  {existingOrder && (
                    <span className="ml-1.5 text-emerald-700">
                      · {formatCLP(parseFloat(existingOrder.total_amount ?? "0"))}
                    </span>
                  )}
                </span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {showTables && !isWaiter && (
                <>
                  <div className="relative shrink-0">
                    <Table className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <select
                      value={selectedTable?.id ?? ""}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setSelectedTable(myTables.find((t) => t.id === id) || null);
                      }}
                      className="h-8 appearance-none rounded-lg border border-border/60 bg-background pl-8 pr-7 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label={isWaiter ? "Seleccionar mi mesa" : "Seleccionar mesa"}
                    >
                      <option value="">{isWaiter ? "Mi mesa" : "Sin mesa"}</option>
                      {myTables
                        .filter(
                          (t) =>
                            t.status === "FREE" ||
                            t.status === "RESERVED" ||
                            t.id === selectedTable?.id,
                        )
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            Mesa {t.number} {t.area ? `· ${t.area}` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowTableMap(true)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    Mapa
                  </button>
                  <div className="mx-1 hidden h-5 w-px bg-border sm:block" />
                </>
              )}

              <button
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  activeCategory === null
                    ? "bg-primary text-white"
                    : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                Todos
              </button>
              {categories?.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
                  className={cn(
                    "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                    activeCategory === cat.id
                      ? "bg-primary text-white"
                      : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {combos && combos.length > 0 && (
              <div className="flex items-center gap-1.5 border-t border-border/40 pt-1.5">
                <button
                  type="button"
                  onClick={() => setShowComboPicker(true)}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  Combos
                </button>
                <span className="text-[10px] text-muted-foreground">
                  {combos.length} disponible{combos.length === 1 ? "" : "s"}
                </span>
              </div>
            )}
          </div>

          {/* Productos */}
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {productsError ? (
              <div className="grid h-full place-items-center rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted-foreground">
                  No se pudo cargar el catálogo. Revisa la conexión con Yggdra.
                </p>
              </div>
            ) : productsLoading || assignedMenuLoading ? (
              <div className="grid h-full place-items-center rounded-xl border border-dashed border-border">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="grid h-full place-items-center rounded-xl border border-dashed border-border">
                <p className="text-sm text-muted-foreground">No hay productos que coincidan.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filtered.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onClick={handleAddProduct}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleAddProduct(product);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
        )}
      </section>

        {/* Carrito desktop */}
        <aside className="hidden h-full w-[420px] min-w-0 shrink-0 overflow-hidden bg-background p-3 md:block">
          {isWaiter && !selectedTable && !isEditingOrder ? (
            <div className="grid h-full place-items-center rounded-2xl border border-dashed border-border p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Table className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Selecciona una mesa</p>
                <p className="text-xs text-muted-foreground">
                  Elige la mesa del restaurante para comenzar el pedido.
                </p>
              </div>
            </div>
          ) : (
            <CartPanel
              stationId={activeStationId}
              selectedTable={selectedTable}
              existingOrderId={effectiveOrderId}
              existingOrder={existingOrder}
              existingOrderLoading={loadingExistingOrder}
              existingOrderError={existingOrderError}
              onOrderRegistered={() => {
                if (isWaiter) goToWaiterTablesView();
                else setSelectedTable(null);
              }}
              isWaiter={isWaiter}
            />
          )}
        </aside>
      </div>

      {/* Carrito móvil / bottom sheet */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 md:hidden"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCartOpen(false);
          }}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.2 }}
            className="flex h-[85vh] w-full flex-col rounded-t-2xl bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 justify-center py-2">
              <div className="h-1 w-10 rounded-full bg-muted" />
            </div>
            <CartPanel
              stationId={activeStationId}
              selectedTable={selectedTable}
              existingOrderId={effectiveOrderId}
              existingOrder={existingOrder}
              existingOrderLoading={loadingExistingOrder}
              existingOrderError={existingOrderError}
              onOrderRegistered={() => {
                if (isWaiter) goToWaiterTablesView();
                else setSelectedTable(null);
                setCartOpen(false);
              }}
              onClose={() => setCartOpen(false)}
              isWaiter={isWaiter}
            />
          </motion.div>
        </div>
      )}

      {/* Bottom bar móvil */}
      {!cartOpen && !(isWaiter && !selectedTable && !isEditingOrder) && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between border-t border-border/60 bg-background px-4 py-3 shadow-lg md:hidden"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
              {displayItemCount}
            </span>
            <span className="text-sm font-medium">{isWaiter ? "Ver pedido" : "Ver cuenta"}</span>
          </div>
          <span className="text-base font-bold tabular-nums">{formatCLP(displayCartTotal)}</span>
        </button>
      )}

      {modifierProduct && (
        <ModifierModal
          productName={modifierProduct.name}
          groups={modifierGroups}
          onConfirm={handleConfirmModifiers}
          onCancel={() => {
            setModifierProduct(null);
            setModifierGroups([]);
          }}
        />
      )}

      {showTableMap && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTableMap(false);
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl border border-border/60 bg-card p-4 shadow-xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  {isWaiter ? "Selecciona una de tus mesas" : "Selecciona una mesa"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Toca una mesa libre para asignarla a la cuenta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTableMap(false)}
                aria-label="Cerrar"
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <TablesCanvas
                tables={myTables}
                mode="select"
                selectedTableId={selectedTable?.id ?? null}
                onSelect={(table) => {
                  setSelectedTable(table);
                  setShowTableMap(false);
                }}
              />
            </div>
          </motion.div>
        </div>
      )}

      {showOpenAccounts && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true">
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2 }}
            className="flex h-full w-full max-w-md flex-col bg-card shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">Cuentas abiertas</h2>
                <p className="text-xs text-muted-foreground">
                  {visibleOpenAccounts.length} pedido{visibleOpenAccounts.length === 1 ? "" : "s"} sin pagar
                  {visibleOpenAccounts.length > 0 && (
                    <span className="ml-1">
                      · {formatCLP(visibleOpenAccounts.reduce((sum, o) => sum + parseFloat(o.total_amount ?? "0"), 0))}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["orders", "open-accounts", "pos-terminal"] })}
                  aria-label="Actualizar"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowOpenAccounts(false)}
                  aria-label="Cerrar"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingOpenAccounts ? (
                <div className="grid place-items-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : visibleOpenAccounts.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <ClipboardList className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {isWaiter ? "No tienes cuentas abiertas en tus mesas." : "No hay cuentas abiertas."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {(visibleOpenAccounts as Order[]).map((order) => (
                    <div
                      key={order.id}
                      className="group flex flex-col gap-2 rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/30 hover:bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {order.order_number ?? order.id.slice(0, 8)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {order.client?.name ?? "Sin cliente"}
                            {order.table ? (
                              <span className="ml-1 rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
                                Mesa {tables.find((t) => t.id === order.table)?.number ?? order.table}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatCLP(order.total_amount ?? "0")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.date).toLocaleString()}
                        </p>
                        {!isWaiter && (
                          <button
                            type="button"
                            onClick={() => setCollectingOrder(order)}
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                          >
                            Cobrar
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!isWaiter && (
              <div className="flex shrink-0 items-center justify-between border-t border-border p-3">
                <Link
                  href="/sales?view=open"
                  onClick={() => setShowOpenAccounts(false)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Ver todas en Ventas
                </Link>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {collectingOrder && (
        <OrderCollectModal
          order={collectingOrder}
          paymentMethods={paymentMethods}
          currentCashRegister={currentCashRegister}
          onClose={() => setCollectingOrder(null)}
          onSuccess={() => {
            setCollectingOrder(null);
            queryClient.invalidateQueries({ queryKey: ["orders", "open-accounts", "pos-terminal"] });
          }}
        />
      )}

      {showComboPicker && combos && (
        <ComboPickerModal
          combos={combos}
          onSelect={(combo) => {
            handleAddCombo(combo);
            setShowComboPicker(false);
          }}
          onClose={() => setShowComboPicker(false)}
        />
      )}

    </div>
  );
}
