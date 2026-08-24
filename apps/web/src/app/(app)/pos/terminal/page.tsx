"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  ArrowLeftRight,
  Table,
  Eye,
  Trash2,
  Banknote,
  Wallet,
  ShoppingBag,
  Zap,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CartPanel from "@/components/pos/cart-panel";
import { ProductCard } from "@/components/pos/product-card";
import { PostSaleModal } from "@/components/pos/post-sale-modal";
import OrderCollectModal from "@/components/orders/order-collect-modal";
import {
  useProducts,
  useCategories,
  useProductModifierGroups,
  useCombos,
  getModifierGroupsForProduct,
  type ComboList,
  type ProductModifierGroup,
} from "@/lib/hooks/useCatalog";
import { fetchCombo } from "@/lib/api/combos";
import {
  fetchPublicCatalogs,
  fetchPublicMenuBySlug,
} from "@/lib/api/public-catalog";
import { fetchCashRegisterStations } from "@/lib/api/cash-register-stations";
import { fetchOrders, fetchOrder, cancelOrder, deliverOrder, createOrder, downloadOrderTicketPdf } from "@/lib/api/orders";
import { searchCustomers, createCustomer } from "@/lib/api/customers";
import { useElapsedTime } from "@/lib/hooks/useElapsedTime";
import { useDownloadFile } from "@/lib/hooks/useDownloadFile";
import { fetchPaymentMethods } from "@/lib/api/payments";
import { getCurrentCashRegister, openCashRegister, closeCashRegister, getDailySummary } from "@/lib/api/cash-register";
import { fetchTables } from "@/lib/api/tables";
import { useCartStore, type CartItemModifier, type CartItem, cartSubtotal, cartDiscountTotal } from "@/lib/store/cart";
import type { PosProduct, YggdraSchemas } from "@/lib/api/types";
import { formatCLP, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";

type Order = YggdraSchemas["Order"] & {
  order_number?: string | null;
  delivery_address?: string | null;
  delivery_status?: string | null;
};
type TableItem = YggdraSchemas["Table"];
import {
  useCurrentBranch,
  useCurrentBranchStation,
  useCanViewTables,
  useIsWaiter,
  useSessionStore,
} from "@/lib/store/session";
import { useBranchModules } from "@/lib/hooks/useBranchModules";
import { useBranchProductTypes } from "@/lib/hooks/useBranchProductTypes";
import { branchName } from "@/lib/types";
import ModifierModal from "@/components/pos/modifier-modal";
import { WaiterTablesView } from "@/components/pos/waiter-tables-view";
import { ComboPickerModal } from "@/components/pos/combo-picker-modal";
import { TablesCanvas } from "@/components/tables/tables-canvas";

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
  const queryOrderType = searchParams.get("order_type") as "SALE" | "ORDER" | "AGREEMENT" | null;
  const openAccountParam = searchParams.get("open_account") === "1";
  const isWaiterSimulation = queryView === "waiter";
  const isWaiter = realIsWaiter || isWaiterSimulation;

  const { data: stations = [] } = useQuery({
    queryKey: ["cash-register-stations", "pos-terminal"],
    queryFn: fetchCashRegisterStations,
    staleTime: 60_000,
  });

  const activeStationId = useMemo(() => {
    if (queryStationId) return Number(queryStationId);
    if (userStation?.station_id) return Number(userStation.station_id);
    return stations[0]?.id ?? null;
  }, [queryStationId, userStation, stations]);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [modifierProduct, setModifierProduct] = useState<PosProduct | null>(null);
  const [modifierGroups, setModifierGroups] = useState<ProductModifierGroup[]>([]);
  const [showOpenAccounts, setShowOpenAccounts] = useState(false);
  const [showPendingDeliveries, setShowPendingDeliveries] = useState(false);
  const [pendingDeliveryType, setPendingDeliveryType] = useState<"ALL" | "SALE" | "ORDER">("ALL");
  const [pendingDeliveryPayment, setPendingDeliveryPayment] = useState<"ALL" | "PENDING" | "PARTIAL" | "PAID">("ALL");
  const [pendingDeliveriesQuery, setPendingDeliveriesQuery] = useState("");
  const [showTableMap, setShowTableMap] = useState(false);
  const [showComboPicker, setShowComboPicker] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [collectingOrder, setCollectingOrder] = useState<Order | null>(null);
  const [openAccountsQuery, setOpenAccountsQuery] = useState("");
  const [cancelingOrder, setCancelingOrder] = useState<Order | null>(null);
  const [isCanceling, setIsCanceling] = useState(false);
  // undefined = sin interacción (usa table_id del query param), null = sin mesa, TableItem = mesa elegida
  const [selectedTableState, setSelectedTableState] = useState<TableItem | null | undefined>(undefined);
  const [showCashRegisterModal, setShowCashRegisterModal] = useState(false);
  const [cashRegisterAmount, setCashRegisterAmount] = useState("");
  const [posMode, setPosMode] = useState<"SALE" | "ORDER" | null>(null);
  const [rememberPosMode, setRememberPosMode] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [postSaleOrder, setPostSaleOrder] = useState<Order | null>(null);
  const [postSaleItems, setPostSaleItems] = useState<CartItem[]>([]);

  // Modal rápido para abrir cuenta con cliente en el POS.
  const [showAccountClientModal, setShowAccountClientModal] = useState(false);
  const [accountClientQuery, setAccountClientQuery] = useState("");
  const [accountDebouncedQuery, setAccountDebouncedQuery] = useState("");
  const [accountSelectedClient, setAccountSelectedClient] = useState<{ id: number; name: string; email?: string | null } | null>(null);
  const [accountShowResults, setAccountShowResults] = useState(false);
  const [accountCreateName, setAccountCreateName] = useState("");
  const [accountCreating, setAccountCreating] = useState(false);

  // Una cuenta abierta puede venir como SALE + open_account=1 (nuevo flujo) o como
  // ORDER (flujo legacy). Se usa para mostrar labels consistentes en el POS.
  const isOpenAccountMode = useMemo(
    () => openAccountParam || queryOrderType === "ORDER",
    [openAccountParam, queryOrderType],
  );

  function handlePostSaleOrder(order: Order, items: CartItem[]) {
    setPostSaleOrder(order);
    setPostSaleItems(items);
  }

  function handleClosePostSale() {
    setPostSaleOrder(null);
    setPostSaleItems([]);
    clearCart();
    resetPosContext();
  }

  function goToWaiterTablesView() {
    setSelectedTableState(undefined);
    const url = new URL("/pos/terminal", window.location.origin);
    url.searchParams.set("view", "waiter");
    if (queryReturnTo) url.searchParams.set("return_to", queryReturnTo);
    if (queryStationId) url.searchParams.set("station_id", queryStationId);
    router.push(url.pathname + url.search);
  }

  function resetPosContext() {
    setSelectedTableState(undefined);
    const url = new URL("/pos/terminal", window.location.origin);
    if (isWaiterSimulation) url.searchParams.set("view", "waiter");
    if (queryReturnTo) url.searchParams.set("return_to", queryReturnTo);
    if (queryStationId) url.searchParams.set("station_id", queryStationId);
    router.replace(url.pathname + url.search);
  }

  function startNewOrder(orderType: "SALE" | "ORDER", isAccount = false) {
    clearCart();
    setSelectedTableState(undefined);
    const url = new URL("/pos/terminal", window.location.origin);
    url.searchParams.set("order_type", orderType);
    if (isAccount) url.searchParams.set("open_account", "1");
    if (isWaiterSimulation) url.searchParams.set("view", "waiter");
    if (queryReturnTo) url.searchParams.set("return_to", queryReturnTo);
    if (queryStationId) url.searchParams.set("station_id", queryStationId);
    router.replace(url.pathname + url.search);
  }

  function openNewAccount() {
    setShowAccountClientModal(true);
  }

  async function handleCreateAccountFromPos() {
    if (accountCreating) return;
    let clientId = accountSelectedClient?.id ?? null;
    if (!clientId && accountCreateName.trim()) {
      try {
        const newClient = await createCustomer({ name: accountCreateName.trim() });
        clientId = newClient.id;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el cliente.");
        return;
      }
    }
    if (!clientId) {
      toast.error("Debes seleccionar o crear un cliente para abrir una cuenta.");
      return;
    }
    setAccountCreating(true);
    try {
      const order = await createOrder({
        items: [],
        order_type: "SALE",
        client_id: clientId,
      });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setShowAccountClientModal(false);
      setAccountClientQuery("");
      setAccountDebouncedQuery("");
      setAccountSelectedClient(null);
      setAccountCreateName("");
      setAccountShowResults(false);
      router.replace(`/pos/terminal?order_id=${order.id}&open_account=1`);
      setCartOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir la cuenta.");
    } finally {
      setAccountCreating(false);
    }
  }

  function selectPosMode(mode: "SALE" | "ORDER", remember = false) {
    setPosMode(mode);
    if (remember) {
      localStorage.setItem("frig.pos.mode", mode);
    }
    setShowModeSelector(false);
  }

  function clearPosMode() {
    setPosMode(null);
    localStorage.removeItem("frig.pos.mode");
    resetPosContext();
  }

  function handleEditOrder(order: Order) {
    const url = new URL("/pos/terminal", window.location.origin);
    url.searchParams.set("order_id", order.id);
    if (queryReturnTo) url.searchParams.set("return_to", queryReturnTo);
    if (queryStationId) url.searchParams.set("station_id", queryStationId);
    router.push(url.pathname + url.search);
    setShowOpenAccounts(false);
    setShowPendingDeliveries(false);
  }

  async function handleCancelOrder(order: Order) {
    setIsCanceling(true);
    try {
      await cancelOrder(order.id);
      toast.success("Cuenta anulada correctamente");
      queryClient.invalidateQueries({
        queryKey: ["orders", "open-accounts", "pos-terminal"],
      });
      setCancelingOrder(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al anular la cuenta",
      );
    } finally {
      setIsCanceling(false);
    }
  }

  const canViewTables = useCanViewTables();
  const { enabledModules, isLoading: modulesLoading } = useBranchModules();
  const tablesEnabled = !modulesLoading && enabledModules.has("tables");
  const publicCatalogEnabled = !modulesLoading && enabledModules.has("public_catalog");
  const showTables = (canViewTables && tablesEnabled) || isWaiterSimulation;
  const { options: productTypeOptions } = useBranchProductTypes();
  const allowedProductTypes = useMemo(
    () => new Set(productTypeOptions.map((o) => o.value)),
    [productTypeOptions]
  );
  const toast = useToast();
  const { download: downloadFile, isLoading: isDownloadingTicket } = useDownloadFile();

  async function handleDownloadTicket(order: Order) {
    await downloadFile(() => downloadOrderTicketPdf(order.id), {
      filename: `comanda_${order.order_number ?? order.id.slice(0, 8)}.pdf`,
    });
  }

  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clear);
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
        order_type: "SALE",
        payment_status: "PENDING",
      }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: pendingDeliveriesPage, isLoading: loadingPendingDeliveries } = useQuery({
    queryKey: ["orders", "pending-deliveries", "pos-terminal"],
    queryFn: () =>
      fetchOrders({
        delivery_status: "PENDING",
        status: ["PENDING", "IN_PROGRESS", "COMPLETED"],
      }),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const t = setTimeout(() => setAccountDebouncedQuery(accountClientQuery), 250);
    return () => clearTimeout(t);
  }, [accountClientQuery]);

  const { data: accountClientResultsQuery, isLoading: searchingAccountCustomers } = useQuery({
    queryKey: ["customers", "search", accountDebouncedQuery, branch?.branch_id, "pos-terminal"],
    queryFn: () => searchCustomers(accountDebouncedQuery, branch?.branch_id ? Number(branch.branch_id) : undefined),
    enabled: accountDebouncedQuery.trim().length >= 1 && showAccountClientModal,
  });

  const accountClientResults = useMemo(() => {
    const items = (accountClientResultsQuery ?? []) as { id: number; name: string; email?: string | null }[];
    return items.filter((c) => !accountSelectedClient || c.id !== accountSelectedClient.id);
  }, [accountClientResultsQuery, accountSelectedClient]);

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

  const openCashRegisterMutation = useMutation({
    mutationFn: () =>
      openCashRegister({
        branch_id: Number(branch?.branch_id ?? 0),
        station_id: activeStationId ? Number(activeStationId) : undefined,
        opening_amount: Number(cashRegisterAmount || "0").toFixed(2),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      setCashRegisterAmount("");
      setShowCashRegisterModal(false);
      toast.success("Caja abierta correctamente");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo abrir la caja");
    },
  });

  const deliverMutation = useMutation({
    mutationFn: ({ id, items }: { id: string; items?: { order_product_id: string; actual_quantity: number }[] }) =>
      deliverOrder(id, items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Entrega registrada");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo registrar la entrega");
    },
  });

  const { data: dailySummary } = useQuery({
    queryKey: ["cash-register", "daily-summary", activeStationId],
    queryFn: () => getDailySummary(activeStationId),
    enabled: !!currentCashRegister && !!activeStationId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const closeCashRegisterMutation = useMutation({
    mutationFn: () => {
      if (!currentCashRegister) throw new Error("No hay caja abierta");
      return closeCashRegister(currentCashRegister.id, {
        closing_amount: Number(cashRegisterAmount || "0").toFixed(2),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      setCashRegisterAmount("");
      setShowCashRegisterModal(false);
      toast.success("Caja cerrada correctamente");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo cerrar la caja");
    },
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
  } = useQuery<Order>({
    queryKey: ["order", "pos-terminal", effectiveOrderId],
    queryFn: () => fetchOrder(effectiveOrderId as string) as Promise<Order>,
    enabled: Boolean(effectiveOrderId),
    staleTime: 30_000,
  });

  const existingOrderElapsed = useElapsedTime(existingOrder?.date, {
    enabled: Boolean(effectiveOrderId && existingOrder),
  });

  const isEditingOrder = Boolean(effectiveOrderId);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("frig.pos.mode") : null;
    if (queryOrderType === "SALE" || queryOrderType === "ORDER") {
      setPosMode(queryOrderType);
      return;
    }
    if (isEditingOrder) {
      return;
    }
    if (saved === "SALE" || saved === "ORDER") {
      setPosMode(saved);
    } else {
      setShowModeSelector(true);
    }
  }, []);

  const startNewOrderRef = useRef(startNewOrder);
  startNewOrderRef.current = startNewOrder;
  const openNewAccountRef = useRef(openNewAccount);
  openNewAccountRef.current = openNewAccount;

  useEffect(() => {
    if (!posMode || queryOrderType || isEditingOrder) return;
    if (posMode === "ORDER") {
      openNewAccountRef.current();
    } else {
      startNewOrderRef.current("SALE");
    }
  }, [posMode, queryOrderType, isEditingOrder]);

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
    enabled: publicCatalogEnabled,
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
    enabled: Boolean(publicCatalogEnabled && assignedCatalog?.slug),
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
      const productType = p.product_type?.toUpperCase();
      if (productType && allowedProductTypes.size > 0 && !allowedProductTypes.has(productType)) {
        return false;
      }
      if (allowedProductIds && !allowedProductIds.has(p.id)) return false;
      if (activeCategory !== null && p.categoryId !== activeCategory) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, query, activeCategory, allowedProductIds, allowedProductTypes]);

  function handleAddProduct(product: PosProduct) {
    const groups = productModifierGroups
      ? getModifierGroupsForProduct(product.id, productModifierGroups)
      : [];
    if (groups.length > 0) {
      setModifierProduct(product);
      setModifierGroups(groups);
    } else {
      addItem(product);
      // El carrito se mantiene cerrado; el usuario lo abre con el botón de cuenta.
    }
  }

  function handleConfirmModifiers(modifiers: CartItemModifier[]) {
    if (modifierProduct) {
      addItem(modifierProduct, { modifiers });
      // El carrito se mantiene cerrado; el usuario lo abre con el botón de cuenta.
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el combo.");
    }
  }

  const visibleOpenAccounts = useMemo(() => {
    let accounts: Order[] = (openAccountsPage?.results ?? []) as Order[];
    if (isWaiter && user) {
      const myTableIds = new Set(myTables.map((t) => t.id));
      accounts = accounts.filter((o) => o.table && myTableIds.has(o.table));
    }
    const q = openAccountsQuery.trim().toLowerCase();
    if (q) {
      accounts = accounts.filter((o) => {
        const clientName = o.client?.name ?? "";
        const orderNumber = (o.order_number ?? o.id).toLowerCase();
        const table = o.table
          ? tables.find((t) => String(t.id) === String(o.table))
          : null;
        const tableNumber = table?.number ?? String(o.table ?? "");
        return (
          clientName.toLowerCase().includes(q) ||
          orderNumber.includes(q) ||
          tableNumber.toLowerCase().includes(q)
        );
      });
    }
    return accounts;
  }, [openAccountsPage, isWaiter, user, myTables, openAccountsQuery, tables]);

  const pendingDeliveriesCount = useMemo(
    () => (pendingDeliveriesPage?.count ?? (pendingDeliveriesPage?.results ?? []).length),
    [pendingDeliveriesPage],
  );

  const filteredPendingDeliveries = useMemo(() => {
    let orders: Order[] = (pendingDeliveriesPage?.results ?? []) as Order[];
    if (pendingDeliveryType !== "ALL") {
      orders = orders.filter((o) => o.order_type === pendingDeliveryType);
    }
    if (pendingDeliveryPayment !== "ALL") {
      orders = orders.filter((o) => o.payment_status === pendingDeliveryPayment);
    }
    const q = pendingDeliveriesQuery.trim().toLowerCase();
    if (q) {
      orders = orders.filter(
        (o) =>
          (o.order_number ?? "").toLowerCase().includes(q) ||
          (o.client?.name ?? "").toLowerCase().includes(q) ||
          (o.client?.dni ?? "").toLowerCase().includes(q) ||
          (o.delivery_address ?? "").toLowerCase().includes(q) ||
          o.id.slice(0, 8).toLowerCase().includes(q)
      );
    }
    return orders;
  }, [pendingDeliveriesPage, pendingDeliveryType, pendingDeliveryPayment, pendingDeliveriesQuery]);

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
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/95 px-3 backdrop-blur sm:h-12 sm:px-4">
        <div className="flex flex-1 min-w-0 items-center gap-2">
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

        <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
          {!activeStationId && !isWaiter && (
            <span className="hidden rounded-md bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-700 lg:inline-block">
              Sin estación asignada
            </span>
          )}

          {/* Tipo de operación actual */}
          <span
            className={cn(
              "inline-flex min-w-0 max-w-[140px] items-center gap-1 truncate rounded-md px-1.5 py-1 text-[11px] sm:max-w-[220px] sm:px-2",
              effectiveOrderId && existingOrder
                ? "bg-primary/10 text-primary"
                : isOpenAccountMode
                  ? "bg-blue-500/10 text-blue-700"
                  : "bg-emerald-500/10 text-emerald-700"
            )}
            title={
              effectiveOrderId && existingOrder
                ? existingOrder.order_type === "SALE" && !existingOrder.payment_status?.startsWith("PENDING")
                  ? `Editando venta #${existingOrder.order_number ?? ""}`
                  : `Cuenta de ${existingOrder.client?.name ?? "sin cliente"} #${existingOrder.order_number ?? ""}`
                : isOpenAccountMode
                  ? "Abriendo una cuenta sin cobrar"
                  : "Nueva venta al contado"
            }
          >
            {effectiveOrderId && existingOrder ? (
              <>
                <span className="hidden shrink-0 font-medium sm:inline">
                  {existingOrder.order_type === "SALE" && !existingOrder.payment_status?.startsWith("PENDING") ? "Editando venta" : "Cuenta"}
                </span>
                {existingOrder.order_type === "ORDER" || existingOrder.payment_status?.startsWith("PENDING") ? (
                  <span className="truncate font-normal opacity-90">
                    · {existingOrder.client?.name ?? "sin cliente"}
                  </span>
                ) : (
                  <span className="hidden text-primary/60 sm:inline">·</span>
                )}
                <span className="truncate font-semibold tabular-nums">
                  #{existingOrder.order_number ?? ""}
                </span>
              </>
            ) : isOpenAccountMode ? (
              <>
                <ClipboardList className="h-3 w-3 shrink-0" />
                <span className="truncate font-medium">Nueva cuenta</span>
              </>
            ) : (
              <>
                <Receipt className="h-3 w-3 shrink-0" />
                <span className="truncate font-medium">Nueva venta</span>
              </>
            )}
          </span>

          {/* Cambiar modo */}
          {posMode && !isEditingOrder && (
            <button
              type="button"
              onClick={() => {
                setShowModeSelector(true);
                clearPosMode();
              }}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 bg-background px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Cambiar entre venta y orden"
            >
              <ArrowLeftRight className="h-3 w-3" />
              <span className="hidden sm:inline">Cambiar</span>
            </button>
          )}

          {/* Estado de caja */}
          {!isWaiter && (
            <button
              type="button"
              disabled={openCashRegisterMutation.isPending || closeCashRegisterMutation.isPending}
              onClick={() => setShowCashRegisterModal(true)}
              className={cn(
                "inline-flex h-8 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                currentCashRegister
                  ? "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20"
                  : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20"
              )}
              title={currentCashRegister ? "Caja abierta - click para ver resumen o cerrar" : "Caja cerrada - click para abrir"}
            >
              {openCashRegisterMutation.isPending || closeCashRegisterMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : currentCashRegister ? (
                <>
                  <Banknote className="h-3 w-3" />
                  <span className="hidden sm:inline">Caja abierta</span>
                  <span className="hidden text-[10px] text-emerald-600/80 sm:inline">· Cerrar</span>
                </>
              ) : (
                <>
                  <Wallet className="h-3 w-3" />
                  <span className="hidden sm:inline">Abrir caja</span>
                </>
              )}
            </button>
          )}

          {!isWaiter && (
            <>
              <button
                type="button"
                onClick={() => setShowOpenAccounts(true)}
                className="relative hidden h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:inline-flex sm:px-2.5"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Cuentas</span>
                {(openAccountsPage?.count ?? 0) > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                    {openAccountsPage?.count ?? 0}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowPendingDeliveries(true)}
                className="relative hidden h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:inline-flex sm:px-2.5"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Entregas</span>
                {pendingDeliveriesCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-semibold text-white">
                    {pendingDeliveriesCount}
                  </span>
                )}
              </button>
            </>
          )}

        </div>
      </header>

      {/* Selector inicial de modo Venta / Orden */}
      {showModeSelector && !queryOrderType && !isEditingOrder && !isWaiter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mb-5 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Receipt className="h-6 w-6 text-primary" />
              </div>
              <h2 className="mt-3 text-lg font-semibold">¿Qué quieres registrar?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Elige el tipo de operación para comenzar.
              </p>
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => {
                  selectPosMode("SALE", rememberPosMode);
                  setShowModeSelector(false);
                }}
                className="flex items-center gap-4 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                  <Receipt className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Venta</p>
                  <p className="text-xs text-muted-foreground">
                    Venta inmediata al contado. El cliente paga ahora y se entrega el producto.
                  </p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => {
                  selectPosMode("ORDER", rememberPosMode);
                  setShowModeSelector(false);
                }}
                className="flex items-center gap-4 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Orden</p>
                  <p className="text-xs text-muted-foreground">
                    Pedido sin cobrar. Requiere cliente y permite pagos parciales o cuotas.
                  </p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </div>

            <label className="mt-5 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={rememberPosMode}
                onChange={(e) => setRememberPosMode(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary"
              />
              Recordar selección y no volver a preguntar
            </label>
          </div>
        </div>
      )}

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
            <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-1.5">
              <div className="relative min-w-0 flex-1 sm:flex-none sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pos-catalog-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  placeholder="Buscar producto…"
                  className="h-8 w-full rounded-lg border-border/60 bg-background pl-8 text-xs"
                  aria-label="Buscar producto"
                />
              </div>
              {combos && combos.length > 0 && (
                <>
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
                </>
              )}
            </div>
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
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
              defaultOrderType={queryOrderType ?? undefined}
              onOrderRegistered={() => {
                if (isWaiter) goToWaiterTablesView();
                else resetPosContext();
              }}
              onPostSaleOrder={handlePostSaleOrder}
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
              defaultOrderType={queryOrderType ?? undefined}
              onOrderRegistered={() => {
                if (isWaiter) goToWaiterTablesView();
                else resetPosContext();
                setCartOpen(false);
              }}
              onPostSaleOrder={handlePostSaleOrder}
              onClose={() => setCartOpen(false)}
              isWaiter={isWaiter}
            />
          </motion.div>
        </div>
      )}

      {/* Bottom bar móvil */}
      {!cartOpen && !(isWaiter && !selectedTable && !isEditingOrder) && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-2 border-t border-border/60 bg-background px-2 py-2 shadow-lg md:hidden">
          <button
            type="button"
            onClick={() => {
              const el = document.getElementById("pos-catalog-search");
              el?.focus();
            }}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Search className="h-[18px] w-[18px]" />
            <span className="text-[10px] font-medium">Buscar</span>
          </button>

          {!isWaiter && (
            <>
              <button
                type="button"
                onClick={() => setShowCashRegisterModal(true)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition-colors",
                  currentCashRegister
                    ? "text-emerald-700 hover:bg-emerald-500/10"
                    : "text-amber-700 hover:bg-amber-500/10"
                )}
              >
                <Banknote className="h-[18px] w-[18px]" />
                <span>{currentCashRegister ? "Caja" : "Abrir caja"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowOpenAccounts(true)}
                className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ClipboardList className="h-[18px] w-[18px]" />
                <span>Cuentas</span>
                {(openAccountsPage?.count ?? 0) > 0 && (
                  <span className="absolute right-2 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-semibold text-white">
                    {openAccountsPage?.count}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowPendingDeliveries(true)}
                className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Zap className="h-[18px] w-[18px]" />
                <span>Entregas</span>
                {pendingDeliveriesCount > 0 && (
                  <span className="absolute right-2 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[9px] font-semibold text-white">
                    {pendingDeliveriesCount}
                  </span>
                )}
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex min-w-0 flex-[1.5] flex-col items-center justify-center gap-0.5 rounded-lg bg-primary py-1.5 text-[10px] font-medium text-white transition-colors hover:bg-primary/90"
          >
            <span className="inline-flex items-center gap-1">
              <ShoppingBag className="h-[18px] w-[18px]" />
              <span className="font-bold tabular-nums">{formatCLP(displayCartTotal)}</span>
            </span>
            <span>{displayItemCount} ítem{displayItemCount === 1 ? "" : "s"} · {isWaiter ? "Pedido" : "Cuenta"}</span>
          </button>
        </div>
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
                {!isWaiter && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowOpenAccounts(false);
                      openNewAccount();
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Abrir cuenta
                  </button>
                )}
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
            <div className="flex shrink-0 flex-col gap-2 border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={openAccountsQuery}
                  onChange={(e) => setOpenAccountsQuery(e.target.value)}
                  placeholder="Buscar por cliente, n° orden o mesa…"
                  className="h-9 pl-8 text-xs"
                />
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
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditOrder(order)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <Eye className="h-3 w-3" />
                            Ver
                          </button>
                          <button
                            type="button"
                            disabled={isDownloadingTicket}
                            onClick={() => handleDownloadTicket(order)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                          >
                            <Receipt className="h-3 w-3" />
                            Comprobante
                          </button>
                          {!isWaiter && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setCancelingOrder(order);
                                  setShowOpenAccounts(false);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100"
                              >
                                <Trash2 className="h-3 w-3" />
                                Anular
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setCollectingOrder(order);
                                  setShowOpenAccounts(false);
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                              >
                                Cobrar
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal para abrir cuenta con cliente en el POS */}
      {showAccountClientModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Abrir cuenta</h2>
                <p className="text-xs text-muted-foreground">
                  Selecciona o crea un cliente para abrir una cuenta nueva.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAccountClientModal(false);
                  setAccountClientQuery("");
                  setAccountDebouncedQuery("");
                  setAccountSelectedClient(null);
                  setAccountCreateName("");
                  setAccountShowResults(false);
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="pos-account-client" className="text-xs font-medium text-muted-foreground">
                  Cliente <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="pos-account-client"
                    value={accountClientQuery}
                    onChange={(e) => {
                      setAccountClientQuery(e.target.value);
                      setAccountSelectedClient(null);
                      setAccountShowResults(true);
                    }}
                    onFocus={() => setAccountShowResults(true)}
                    placeholder="Buscar cliente..."
                    className="h-10 pl-8 text-sm"
                  />
                  {accountShowResults && accountDebouncedQuery.trim().length === 0 && !accountSelectedClient && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                      Escribe para buscar clientes…
                    </div>
                  )}
                  {accountShowResults && accountDebouncedQuery.trim().length > 0 && searchingAccountCustomers && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                      Buscando…
                    </div>
                  )}
                  {accountShowResults && accountDebouncedQuery.trim().length > 0 && !searchingAccountCustomers && accountClientResults.length > 0 && (
                    <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-border bg-background shadow-md">
                      {accountClientResults.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setAccountSelectedClient(client);
                            setAccountClientQuery(client.name ?? "");
                            setAccountShowResults(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          {client.name}
                          {client.email && <span className="ml-2 text-xs text-muted-foreground">{client.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {accountShowResults && accountDebouncedQuery.trim().length > 0 && !searchingAccountCustomers && accountClientResults.length === 0 && !accountSelectedClient && (
                    <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-background p-2 text-xs text-muted-foreground shadow-md">
                      Sin resultados
                    </div>
                  )}
                </div>
                {!accountCreateName && !accountSelectedClient ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountCreateName(accountClientQuery);
                      setAccountShowResults(false);
                    }}
                    className="self-start text-xs text-primary hover:underline"
                  >
                    + Crear cliente rápido
                  </button>
                ) : accountCreateName ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={accountCreateName}
                      onChange={(e) => setAccountCreateName(e.target.value)}
                      placeholder="Nombre del nuevo cliente"
                      className="h-9 flex-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setAccountCreateName("")}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAccountClientModal(false);
                    setAccountClientQuery("");
                    setAccountDebouncedQuery("");
                    setAccountSelectedClient(null);
                    setAccountCreateName("");
                    setAccountShowResults(false);
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateAccountFromPos}
                  disabled={accountCreating || (!accountSelectedClient && !accountCreateName.trim())}
                >
                  {accountCreating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Abrir cuenta
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showPendingDeliveries && (
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
                <h2 className="text-base font-semibold">Entregas pendientes</h2>
                <p className="text-xs text-muted-foreground">
                  {filteredPendingDeliveries.length} por entregar
                  {filteredPendingDeliveries.length !== (pendingDeliveriesPage?.results ?? []).length && (
                    <span className="ml-1 text-muted-foreground/70">
                      ({(pendingDeliveriesPage?.results ?? []).length} total)
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["orders", "pending-deliveries", "pos-terminal"] })}
                  aria-label="Actualizar"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <RefreshCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setShowPendingDeliveries(false)}
                  aria-label="Cerrar"
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-3 border-b border-border p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={pendingDeliveriesQuery}
                  onChange={(e) => setPendingDeliveriesQuery(e.target.value)}
                  placeholder="Buscar por cliente, n° orden o dirección…"
                  className="h-9 pl-8 text-xs"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
                  {([
                    { key: "ALL", label: "Todos" },
                    { key: "SALE", label: "Venta" },
                    { key: "ORDER", label: "Orden" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPendingDeliveryType(opt.key)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        pendingDeliveryType === opt.key
                          ? "bg-primary text-white"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
                  {([
                    { key: "ALL", label: "Todos" },
                    { key: "PENDING", label: "Pendiente" },
                    { key: "PARTIAL", label: "Parcial" },
                    { key: "PAID", label: "Pagada" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setPendingDeliveryPayment(opt.key)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        pendingDeliveryPayment === opt.key
                          ? "bg-primary text-white"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {loadingPendingDeliveries ? (
                <div className="grid place-items-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPendingDeliveries.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <Zap className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No hay entregas pendientes.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {(filteredPendingDeliveries as Order[]).map((order) => (
                    <div
                      key={order.id}
                      className="group flex flex-col gap-2 rounded-xl border border-border bg-background p-3 transition-colors hover:border-blue-300 hover:bg-blue-50/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {order.order_number ?? order.id.slice(0, 8)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {order.client?.name ?? "Sin cliente"}
                            {order.delivery_address ? ` · ${order.delivery_address}` : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          {formatCLP(order.total_amount ?? "0")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                          {order.payment_status === "PAID" ? "Pagada" : "Pendiente pago"}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditOrder(order)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <Eye className="h-3 w-3" />
                            Ver
                          </button>
                          <button
                            type="button"
                            disabled={deliverMutation.isPending}
                            onClick={() => deliverMutation.mutate({ id: order.id })}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                          >
                            {deliverMutation.isPending && deliverMutation.variables?.id === order.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Zap className="h-3 w-3" />
                            )}
                            Entregado
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

      {cancelingOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCancelingOrder(null);
          }}
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-lg">
            <h3 className="text-base font-semibold">¿Anular cuenta?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Se anulará la cuenta de{" "}
              <strong>{cancelingOrder.client?.name ?? "Sin cliente"}</strong> ({" "}
              {cancelingOrder.order_number ?? cancelingOrder.id.slice(0, 8)} ). Esta acción no se
              puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCancelingOrder(null)}
                disabled={isCanceling}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => handleCancelOrder(cancelingOrder)}
                disabled={isCanceling}
              >
                {isCanceling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Anular
              </Button>
            </div>
          </div>
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

      {showCashRegisterModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCashRegisterModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg">
            <h3 className="text-base font-semibold">
              {currentCashRegister ? "Resumen de caja" : "Abrir caja"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Estación {activeStation?.name ?? "actual"}
            </p>

            {currentCashRegister && dailySummary && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5">
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <TrendingUp className="h-3 w-3" />
                    Ventas
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCLP(parseFloat(String(dailySummary.total_sales || "0")))}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5">
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Banknote className="h-3 w-3" />
                    Efectivo
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCLP(parseFloat(String(dailySummary.cash_sales || "0")))}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5">
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Wallet className="h-3 w-3" />
                    Otros
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCLP(parseFloat(String(dailySummary.other_sales || "0")))}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5">
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ArrowDownLeft className="h-3 w-3" />
                    Ingresos
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCLP(parseFloat(String(dailySummary.cash_in || "0")))}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/40 p-2.5">
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <ArrowUpRight className="h-3 w-3" />
                    Retiros
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCLP(parseFloat(String(dailySummary.cash_out || "0")))}
                  </p>
                </div>
                <div className="rounded-lg border border-border/60 bg-emerald-500/10 p-2.5">
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-emerald-700">
                    <Calculator className="h-3 w-3" />
                    Esperado
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-emerald-700">
                    {formatCLP(parseFloat(String(dailySummary.expected_amount ?? "0")))}
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {currentCashRegister ? "Monto final en caja" : "Monto inicial en caja"}
              </label>
              <Input
                type="number"
                min={0}
                step="1"
                value={cashRegisterAmount}
                onChange={(e) => setCashRegisterAmount(e.target.value)}
                placeholder="Ej: 10000"
                className="h-10 text-sm tabular-nums"
                autoFocus
              />
              {currentCashRegister && cashRegisterAmount && dailySummary?.expected_amount !== undefined && (
                <p className="mt-2 text-xs">
                  Diferencia:{" "}
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      parseFloat(cashRegisterAmount || "0") - parseFloat(String(dailySummary.expected_amount)) === 0
                        ? "text-emerald-600"
                        : "text-amber-600"
                    )}
                  >
                    {formatCLP(
                      parseFloat(cashRegisterAmount || "0") -
                        parseFloat(String(dailySummary.expected_amount))
                    )}
                  </span>
                </p>
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCashRegisterModal(false)}
                disabled={openCashRegisterMutation.isPending || closeCashRegisterMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                onClick={() =>
                  currentCashRegister
                    ? closeCashRegisterMutation.mutate()
                    : openCashRegisterMutation.mutate()
                }
                disabled={openCashRegisterMutation.isPending || closeCashRegisterMutation.isPending}
              >
                {(openCashRegisterMutation.isPending || closeCashRegisterMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {currentCashRegister ? "Cerrar caja" : "Abrir caja"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {postSaleOrder && (
        <PostSaleModal
          order={postSaleOrder}
          items={postSaleItems}
          branchName={branch?.business_name}
          onClose={handleClosePostSale}
        />
      )}
    </div>
  );
}
