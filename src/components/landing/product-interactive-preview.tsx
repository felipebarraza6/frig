"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  ChefHat,
  LayoutGrid,
  Warehouse,
  CheckCircle2,
  Clock,
  Trash2,
  Flame,
  Coffee,
  Beer,
  Utensils,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Banknote,
  Coins,
  ShieldCheck,
  FileText,
  Plus,
  Minus,
  Receipt,
  Check,
  Lock,
  ChevronRight,
  Store,
  User,
  Percent,
  QrCode,
  Layers,
  Bike,
  Truck,
  Package,
  Printer,
  Building2,
  ShoppingBag,
  Landmark,
  Users,
  ChartColumn,
  ChevronDown,
} from "lucide-react";
import { formatCLP } from "@/lib/utils";

type TabKey = "pos" | "kds" | "delivery" | "ventas" | "tables" | "qr" | "finance" | "facturacion" | "bancos" | "stock" | "compras" | "clientes" | "reportes" | "sucursales";

type Role = "cajero" | "owner" | "admin";

/* Vistas por rol, como en la app real: cada perfil ve solo sus módulos. */
const ROLE_TABS: Record<Role, TabKey[]> = {
  cajero: ["pos", "ventas", "facturacion", "finance"],
  owner: ["delivery", "tables", "qr", "ventas", "finance", "facturacion", "bancos", "stock", "compras", "clientes", "reportes", "sucursales"],
  admin: ["pos", "kds", "delivery", "ventas", "tables", "qr", "finance", "facturacion", "bancos", "stock", "compras", "clientes", "reportes", "sucursales"],
};

const ROLES: { key: Role; label: string; user: string }[] = [
  { key: "cajero", label: "POS · Cajero", user: "Sofía L. · Cajera" },
  { key: "owner", label: "PROPIETARIO", user: "Ignacio M. · Propietario" },
  { key: "admin", label: "ADMINISTRADOR", user: "Marcela R. · Administrador" },
];

/* Grupos del sidebar, como en la app real. Se muestran como acordeón:
   solo un grupo abierto a la vez para que nunca rompa la pantalla. */
const SIDEBAR_GROUPS: {
  id: string;
  label: string;
  tabs: { key: TabKey; label: string; icon: typeof Zap }[];
}[] = [
  {
    id: "vender",
    label: "Vender",
    tabs: [
      { key: "pos", label: "Punto de Venta (POS)", icon: Zap },
      { key: "kds", label: "Cocina (KDS)", icon: ChefHat },
      { key: "delivery", label: "Delivery & Retiro", icon: Bike },
      { key: "ventas", label: "Ventas & Cotizaciones", icon: ShoppingBag },
    ],
  },
  {
    id: "local",
    label: "Local",
    tabs: [
      { key: "tables", label: "Mesas & Salón", icon: LayoutGrid },
      { key: "qr", label: "Menú QR", icon: QrCode },
    ],
  },
  {
    id: "dinero",
    label: "Dinero",
    tabs: [
      { key: "finance", label: "Caja & Arqueo", icon: Wallet },
      { key: "facturacion", label: "Boleta SII & Pagos", icon: Receipt },
      { key: "bancos", label: "Bancos & Conciliación", icon: Landmark },
    ],
  },
  {
    id: "catalogo",
    label: "Catálogo",
    tabs: [
      { key: "stock", label: "Recetas & Stock", icon: Warehouse },
      { key: "compras", label: "Proveedores & Compras", icon: Truck },
    ],
  },
  {
    id: "gestion",
    label: "Gestión",
    tabs: [
      { key: "clientes", label: "Clientes & Promos", icon: Users },
      { key: "reportes", label: "Reportes", icon: ChartColumn },
      { key: "sucursales", label: "Multi-Sucursal", icon: Building2 },
    ],
  },
];

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
}

interface KdsOrder {
  id: string;
  table: string;
  time: string;
  station: "Plancha & Fuegos" | "Fritura & Entradas" | "Barra & Coctelería";
  status: "PENDING" | "PREPARING" | "READY";
  items: { name: string; note?: string }[];
}

interface CashMovement {
  id: string;
  time: string;
  type: "IN" | "OUT";
  concept: string;
  amount: number;
  method: string;
}

export function ProductInteractivePreview() {
  const [activeTab, setActiveTab] = useState<TabKey>("pos");
  const [role, setRole] = useState<Role>("admin");
  // undefined = el acordeón sigue a la pestaña activa; "" = todos cerrados.
  const [openGroupOverride, setOpenGroupOverride] = useState<string | null | undefined>(undefined);

  // Derivados en render (sin effects): pestañas visibles según rol y grupo abierto.
  const allowedTabs = ROLE_TABS[role];
  const effectiveTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0];
  const activeGroupId =
    SIDEBAR_GROUPS.find((g) => g.tabs.some((t) => t.key === effectiveTab))?.id ?? null;
  const openGroup = openGroupOverride === undefined ? activeGroupId : openGroupOverride;

  function changeRole(next: Role) {
    setRole(next);
    if (!ROLE_TABS[next].includes(effectiveTab)) {
      setActiveTab(ROLE_TABS[next][0]);
      setOpenGroupOverride(undefined);
    }
  }

  function changeTab(next: TabKey) {
    setActiveTab(next);
    setOpenGroupOverride(undefined);
  }

  // === ESTADO DEL POS ===
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  const [cart, setCart] = useState<CartItem[]>([
    { id: "1", name: "Smash Burger Doble", price: 7900, qty: 2, note: "Punto medio, extra cheddar" },
    { id: "2", name: "Papas Rústicas Trufadas", price: 4200, qty: 1, note: "Salsa alioli aparte" },
    { id: "3", name: "Cerveza IPA Artesanal", price: 3800, qty: 2 },
  ]);
  const [tipEnabled, setTipEnabled] = useState(true);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [checkoutMethod, setCheckoutMethod] = useState<string>("card_debit");
  const [cashTendered, setCashTendered] = useState<number>(30000);
  const [saleCompleted, setSaleCompleted] = useState(false);

  // === ESTADO DE FINANZAS ===
  const [totalTurnover, setTotalTurnover] = useState(1845900);
  const [totalExpenses, setTotalExpenses] = useState(124500);
  const [cashOnHand, setCashOnHand] = useState(420000);
  const [cardSales, setCardSales] = useState(1185900);
  const [movements, setMovements] = useState<CashMovement[]>([
    {
      id: "mov-1",
      time: "17:48",
      type: "IN",
      concept: "Venta Boleta #8942 · Mesa 4",
      amount: 27600,
      method: "Transbank Débito",
    },
    {
      id: "mov-2",
      time: "17:15",
      type: "OUT",
      concept: "Caja Chica: Compra hielo y limones pica",
      amount: 14500,
      method: "Efectivo",
    },
    {
      id: "mov-3",
      time: "16:40",
      type: "IN",
      concept: "Venta Boleta #8941 · Mesa 7",
      amount: 42000,
      method: "Efectivo",
    },
    {
      id: "mov-4",
      time: "09:30",
      type: "IN",
      concept: "Apertura Fondo Inicial de Caja",
      amount: 100000,
      method: "Efectivo",
    },
  ]);

  // === ESTADO DE KDS (COCINA) ===
  const [kdsFilterStation, setKdsFilterStation] = useState<string>("all");
  const [kdsOrders, setKdsOrders] = useState<KdsOrder[]>([
    {
      id: "KDS-142",
      table: "Mesa 4",
      time: "02:45",
      station: "Plancha & Fuegos",
      status: "PREPARING",
      items: [
        { name: "2x Smash Burger Doble", note: "Sin cebolla caramelizada" },
        { name: "1x Sandwich Mechada Luco", note: "Pan marraqueta" },
      ],
    },
    {
      id: "KDS-143",
      table: "Mesa 7",
      time: "05:10",
      station: "Barra & Coctelería",
      status: "PENDING",
      items: [
        { name: "2x Pisco Sour Catedral", note: "Limón de Pica" },
        { name: "1x Gin Tonic Silvestre", note: "Con botánicos" },
      ],
    },
    {
      id: "KDS-140",
      table: "Mesa 2",
      time: "08:20",
      station: "Fritura & Entradas",
      status: "READY",
      items: [
        { name: "2x Papas Rústicas Trufadas", note: "Salsa alioli extra" },
      ],
    },
  ]);

  // === ESTADO DE MESAS ===
  const [tableArea, setTableArea] = useState<"salon" | "terraza">("salon");
  const [selectedTableNum, setSelectedTableNum] = useState<number>(4);

  // Catálogo de Productos
  const posProducts = [
    { id: "p1", name: "Smash Burger Doble", cat: "burgers", price: 7900, icon: Flame, tag: "Plancha", sku: "BURG-01", stock: 18 },
    { id: "p2", name: "Sandwich Mechada Luco", cat: "burgers", price: 8200, icon: Flame, tag: "Plancha", sku: "BURG-02", stock: 12 },
    { id: "p3", name: "Papas Rústicas Trufadas", cat: "acompanamientos", price: 4200, icon: Utensils, tag: "Fritura", sku: "SIDE-01", stock: 25 },
    { id: "p4", name: "Aros de Cebolla Merkén", cat: "acompanamientos", price: 3600, icon: Utensils, tag: "Fritura", sku: "SIDE-02", stock: 30 },
    { id: "p5", name: "Cerveza IPA Artesanal", cat: "barra", price: 3800, icon: Beer, tag: "Barra", sku: "BAR-01", stock: 48 },
    { id: "p6", name: "Pisco Sour Catedral", cat: "barra", price: 5900, icon: Beer, tag: "Barra", sku: "BAR-02", stock: 35 },
    { id: "p7", name: "Café Espresso Doble", cat: "barra", price: 2400, icon: Coffee, tag: "Barra", sku: "BAR-03", stock: 80 },
    { id: "p8", name: "Cheesecake Frutos Rojos", cat: "postres", price: 3900, icon: Utensils, tag: "Postres", sku: "DES-01", stock: 8 },
  ];

  const filteredProducts =
    selectedCategory === "todos"
      ? posProducts
      : posProducts.filter((p) => p.cat === selectedCategory);

  const addItemToCart = (prod: (typeof posProducts)[0]) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.name === prod.name);
      if (existing) {
        return prev.map((i) => (i.name === prod.name ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { id: Date.now().toString(), name: prod.name, price: prod.price, qty: 1 }];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const nextQty = i.qty + delta;
            return nextQty > 0 ? { ...i, qty: nextQty } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[],
    );
  };

  const removeCartItem = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const rawSubtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountAmount = discountApplied ? Math.round(rawSubtotal * 0.1) : 0;
  const subtotalCart = rawSubtotal - discountAmount;
  const tipAmount = tipEnabled ? Math.round(subtotalCart * 0.1) : 0;
  const totalCart = subtotalCart + tipAmount;

  // Enviar a KDS
  const sendOrderToKds = () => {
    const newKdsId = `KDS-${Math.floor(100 + Math.random() * 900)}`;
    const newOrder: KdsOrder = {
      id: newKdsId,
      table: `Mesa ${selectedTableNum}`,
      time: "00:01",
      station: "Plancha & Fuegos",
      status: "PENDING",
      items: cart.map((c) => ({ name: `${c.qty}x ${c.name}`, note: c.note })),
    };
    setKdsOrders((prev) => [newOrder, ...prev]);
    setActiveTab("kds");
  };

  // Métodos de pago reales de FRIG
  const PAYMENT_METHODS = [
    { id: "card_debit", label: "Transbank Débito", icon: CreditCard },
    { id: "card_credit", label: "Transbank Crédito", icon: CreditCard },
    { id: "cash", label: "Efectivo en Gaveta", icon: Banknote },
    { id: "transfer", label: "Transferencia Banco", icon: Coins },
    { id: "wallet", label: "MercadoPago / Mach", icon: QrCode },
    { id: "convenio", label: "Convenio Empresa", icon: FileText },
  ];

  // Simular cobro y sincronizar con Finanzas
  const confirmPayment = () => {
    const paidAmount = totalCart;
    setTotalTurnover((prev) => prev + paidAmount);
    if (checkoutMethod === "cash") {
      setCashOnHand((prev) => prev + paidAmount);
    } else {
      setCardSales((prev) => prev + paidAmount);
    }

    const methodName =
      PAYMENT_METHODS.find((m) => m.id === checkoutMethod)?.label ?? "Transbank Débito";

    const newMov: CashMovement = {
      id: `mov-${Date.now()}`,
      time: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
      type: "IN",
      concept: `Venta Boleta #8943 · Mesa ${selectedTableNum}`,
      amount: paidAmount,
      method: methodName,
    };

    setMovements((prev) => [newMov, ...prev]);
    setSaleCompleted(true);
    setTimeout(() => {
      setIsCheckoutModalOpen(false);
      setSaleCompleted(false);
      setCart([]);
    }, 1800);
  };

  // KDS transitions
  const updateKdsStatus = (id: string, nextStatus: "PREPARING" | "READY" | "DONE") => {
    if (nextStatus === "DONE") {
      setKdsOrders((prev) => prev.filter((o) => o.id !== id));
    } else {
      setKdsOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: nextStatus } : o)),
      );
    }
  };

  // Inyectar egreso en Finanzas
  const addQuickExpense = () => {
    const amount = 8500;
    setTotalExpenses((prev) => prev + amount);
    setCashOnHand((prev) => prev - amount);
    setMovements((prev) => [
      {
        id: `mov-${Date.now()}`,
        time: new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }),
        type: "OUT",
        concept: "Caja Chica: Compra cilantro y servilletas",
        amount,
        method: "Efectivo",
      },
      ...prev,
    ]);
  };

  const netProfit = totalTurnover - totalExpenses;
  const operationalMargin = totalTurnover > 0 ? ((netProfit / totalTurnover) * 100).toFixed(1) : "0";

  const tabLabels: Record<TabKey, { title: string; breadcrumb: string }> = {
    pos: { title: "Punto de Venta Táctil", breadcrumb: "Vender / POS Terminal" },
    kds: { title: "Monitor de Cocina KDS", breadcrumb: "Vender / Cocina y Estaciones" },
    delivery: { title: "Delivery & Retiro", breadcrumb: "Vender / Despacho y Retiro" },
    tables: { title: "Mapa de Mesas & Salón", breadcrumb: "Local / Salón y Garzones" },
    qr: { title: "Menú QR & Pedidos en Mesa", breadcrumb: "Local / Carta Digital" },
    finance: { title: "Caja & Finanzas en Vivo", breadcrumb: "Dinero / Turnos y Arqueos" },
    stock: { title: "Recetas & Stock al Gramo", breadcrumb: "Catálogo / Bodega e Insumos" },
    compras: { title: "Proveedores & Compras", breadcrumb: "Catálogo / Compras y Recepciones" },
    facturacion: { title: "Boleta Electrónica & Medios de Pago", breadcrumb: "Dinero / Facturación SII" },
    sucursales: { title: "Multi-Sucursal", breadcrumb: "Gestión / Sucursales" },
    ventas: { title: "Ventas & Cotizaciones", breadcrumb: "Vender / Ventas y Cotizaciones" },
    bancos: { title: "Bancos & Conciliación", breadcrumb: "Dinero / Bancos y Conciliación" },
    clientes: { title: "Clientes & Promociones", breadcrumb: "Gestión / Clientes y Promociones" },
    reportes: { title: "Reportes del Negocio", breadcrumb: "Gestión / Reportes" },
  };

  const filteredKdsOrders =
    kdsFilterStation === "all"
      ? kdsOrders
      : kdsOrders.filter((o) => o.station === kdsFilterStation);

  return (
    <div className="w-full rounded-2xl border border-zinc-400/30 bg-[#111111] shadow-2xl overflow-hidden text-zinc-200 font-sans">
      {/* 1. Marco de Ventana Real del Navegador Web */}
      <div className="flex items-center justify-between border-b border-zinc-900/70 bg-[#0d0d0d] px-4 py-2.5 gap-3">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-400/80" />
          </div>
          <div className="hidden sm:flex items-center gap-1.5 ml-2 px-3 py-1 rounded-md bg-[#161616] border border-zinc-800/40 text-[11px] font-mono text-zinc-300">
            <Lock className="h-3 w-3 text-zinc-400" />
            <span>https://app.frig.yggdra.cl/{activeTab}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-950 text-zinc-300 border border-zinc-600/50 text-[11px] font-semibold">
            <Store className="h-3 w-3 text-zinc-400" />
            <span>Frig · Sucursal Providencia</span>
          </span>
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-zinc-300/80">
            <User className="h-3 w-3" />
            <span>{ROLES.find((r) => r.key === role)?.user}</span>
          </span>
        </div>
      </div>

      {/* 1.b Selector de Vistas por Rol: Cajero / Propietario (Owner) / Administrador */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-900/70 bg-[#0f0f0f] px-4 py-2">
        <span className="hidden sm:inline text-[10px] font-mono text-zinc-400/70 uppercase tracking-wider mr-1">
          Vistas:
        </span>
        {ROLES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => changeRole(r.key)}
            className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider transition-all ${
              role === r.key
                ? "bg-[#c67d52] text-white shadow-sm"
                : "bg-[#181818] text-zinc-400 border border-zinc-800/60 hover:text-white hover:border-zinc-600/60"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* 2. Cuerpo Interior: Sidebar Real de FRIG con Grupos Oficiales + Viewport */}
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[520px]">
        {/* Sidebar Oficial de FRIG (Grupos VENDER, LOCAL, DINERO, CATÁLOGO) */}
        <aside className="md:col-span-3 lg:col-span-3 border-b md:border-b-0 md:border-r border-zinc-900/70 bg-[#101010] p-3 flex md:flex-col justify-between overflow-x-auto gap-2">
          <div className="w-full flex md:flex-col gap-2 md:gap-1">
            {SIDEBAR_GROUPS.map((group) => {
              const tabs = group.tabs.filter((t) => ROLE_TABS[role].includes(t.key));
              if (tabs.length === 0) return null;
              const isOpen = openGroup === group.id;
              return (
                <div key={group.id} className="min-w-fit md:min-w-0 md:w-full">
                  <button
                    type="button"
                    onClick={() => setOpenGroupOverride(isOpen ? "" : group.id)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${isOpen ? "text-white bg-[#181818]" : "text-zinc-400/80 hover:text-white"}`}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="flex md:flex-col gap-1 md:gap-1 pt-0.5 pb-1">
                      {tabs.map((t) => {
                        const Icon = t.icon;
                        const isActive = activeTab === t.key;
                        return (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => changeTab(t.key)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap text-left ${isActive ? "bg-zinc-800 text-white font-semibold shadow-sm" : "text-zinc-300 hover:text-white hover:bg-[#181818]"}`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-zinc-400"}`} />
                              <span>{t.label}</span>
                            </div>
                            {isActive && <ChevronRight className="h-3 w-3 hidden md:block text-white" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Estado de Periféricos en Vivo */}
          <div className="hidden md:block p-2.5 rounded-xl border border-zinc-900/60 bg-[#141414] text-[11px] space-y-1 text-zinc-300/80">
            <div className="flex items-center justify-between font-bold text-white">
              <span>Turno #84 Activo</span>
              <span className="h-2 w-2 rounded-full bg-zinc-400 animate-pulse" />
            </div>
            <p className="text-[10px]">Boleta SII en línea</p>
            <p className="text-[10px] text-zinc-400/80">Impresora cocina LAN conectada</p>
          </div>
        </aside>

        {/* Viewport Principal de la App */}
        <main className="md:col-span-9 lg:col-span-9 p-4 sm:p-5 flex flex-col justify-between bg-[#111111]">
          <div>
            {/* Cabecera de Página Real */}
            <div className="flex flex-wrap items-center justify-between pb-3 mb-4 border-b border-zinc-900/70 gap-2">
              <div>
                <p className="text-[11px] text-zinc-400/80 font-mono">
                  {tabLabels[effectiveTab].breadcrumb}
                </p>
                <h3 className="text-base sm:text-lg font-bold text-white leading-tight">
                  {tabLabels[effectiveTab].title}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2.5 py-1 rounded-md bg-zinc-950 border border-zinc-800/60 text-zinc-300 font-medium">
                  {effectiveTab === "finance"
                    ? "Caja Salón · Turno Abierto"
                    : activeTab === "pos"
                    ? "Mesa 4 · Garzón Carlos M."
                    : activeTab === "kds"
                    ? "3 Estaciones en Línea"
                    : activeTab === "tables"
                    ? "Salón Principal"
                    : "Bodega Central"}
                </span>
              </div>
            </div>

            {/* Vistas según pestaña activa */}
            <AnimatePresence mode="wait">
              {/* ========================================== */}
              {/* 1. FINANZAS & ARQUEO                       */}
              {/* ========================================== */}
              {effectiveTab === "finance" && (
                <motion.div
                  key="finance"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414]">
                      <span className="text-xs text-zinc-300 block mb-1">Ventas del Turno</span>
                      <p className="font-mono text-lg sm:text-xl font-extrabold text-white">
                        {formatCLP(totalTurnover)}
                      </p>
                      <span className="text-[10px] text-zinc-400 mt-1 block">
                        38 boletas emitidas
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-rose-900/40 bg-[#1a1214]">
                      <span className="text-xs text-rose-300 block mb-1">Egresos Caja Chica</span>
                      <p className="font-mono text-lg sm:text-xl font-extrabold text-white">
                        {formatCLP(totalExpenses)}
                      </p>
                      <span className="text-[10px] text-rose-300/80 mt-1 block">
                        Compras autorizadas
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414]">
                      <span className="text-xs text-zinc-300 block mb-1">Margen Operativo</span>
                      <p className="font-mono text-lg sm:text-xl font-extrabold text-zinc-300">
                        {operationalMargin}%
                      </p>
                      <span className="text-[10px] text-zinc-300/80 mt-1 block">
                        Utilidad: {formatCLP(netProfit)}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414]">
                      <span className="text-xs text-zinc-300 block mb-1">Cuadratura</span>
                      <p className="font-mono text-lg sm:text-xl font-extrabold text-zinc-300">
                        $0 Descuadre
                      </p>
                      <span className="text-[10px] text-zinc-400 font-semibold mt-1 block">
                        ✓ Cuadre exacto al peso
                      </span>
                    </div>
                  </div>

                  {/* Arqueo Detallado por Medios de Pago */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <div className="lg:col-span-5 p-3.5 rounded-xl border border-zinc-900/60 bg-[#061109] space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-900/60 text-xs font-bold text-white">
                        <span>Desglose por Medios de Pago</span>
                        <span className="text-[10px] font-mono text-zinc-400">Conciliado</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#1a1a1a]">
                          <span className="font-semibold text-white">Efectivo en Gaveta</span>
                          <span className="font-mono font-bold text-white">{formatCLP(cashOnHand)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#1a1a1a]">
                          <span className="font-semibold text-white">Transbank Débito / Crédito</span>
                          <span className="font-mono font-bold text-white">{formatCLP(cardSales)}</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-[#1a1a1a]">
                          <span className="font-semibold text-white">Transferencias Verificadas</span>
                          <span className="font-mono font-bold text-white">{formatCLP(240000)}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addQuickExpense}
                        className="w-full py-1.5 rounded-lg border border-rose-900/60 bg-rose-950/40 text-rose-300 text-xs font-semibold hover:bg-rose-900/50 transition-colors"
                      >
                        - Registrar Gasto de Caja Chica ($8.500)
                      </button>
                    </div>

                    <div className="lg:col-span-7 p-3.5 rounded-xl border border-zinc-900/60 bg-[#061109]">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-900/60 text-xs font-bold text-white">
                        <span>Movimientos en Vivo del Turno</span>
                        <span className="text-[10px] font-mono text-zinc-400">{movements.length} registros</span>
                      </div>
                      <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {movements.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between p-1.5 rounded border border-zinc-950 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="font-mono text-[10px] text-zinc-400">{m.time}</span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-white text-[11px]">{m.concept}</p>
                                <p className="text-[9px] text-zinc-400/70">{m.method}</p>
                              </div>
                            </div>
                            <span
                              className={`font-mono text-xs font-bold shrink-0 ${
                                m.type === "IN" ? "text-zinc-300" : "text-rose-400"
                              }`}
                            >
                              {m.type === "IN" ? "+" : "-"}
                              {formatCLP(m.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 2. POS TÁCTIL                              */}
              {/* ========================================== */}
              {effectiveTab === "pos" && (
                <motion.div
                  key="pos"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-3"
                >
                  {/* Catálogo de Productos */}
                  <div className="lg:col-span-7 space-y-2.5">
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                      {[
                        { id: "todos", label: "Todos" },
                        { id: "burgers", label: "Burgers" },
                        { id: "acompanamientos", label: "Acompañamientos" },
                        { id: "barra", label: "Bebidas" },
                        { id: "postres", label: "Postres" },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`px-2.5 py-1 rounded-full whitespace-nowrap text-xs transition-colors ${
                            selectedCategory === cat.id
                              ? "bg-zinc-800 text-white font-bold"
                              : "bg-zinc-950/70 text-zinc-300 border border-zinc-800/40 hover:bg-zinc-900"
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {filteredProducts.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addItemToCart(p)}
                          className="p-2.5 rounded-xl border border-zinc-900/70 bg-[#1a1a1a]/70 hover:border-[#c67d52]/50 hover:bg-[#202020] text-left transition-all active:scale-95 flex flex-col justify-between"
                        >
                          <div>
                            <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-950 text-zinc-300 border border-zinc-800/40">
                              {p.tag}
                            </span>
                            <p className="font-bold text-white text-xs mt-1 truncate">{p.name}</p>
                          </div>
                          <div className="mt-2 pt-1 border-t border-zinc-900/60 flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-zinc-300">
                              {formatCLP(p.price)}
                            </span>
                            <span className="text-[10px] text-zinc-300 font-semibold">+</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Carro / Comanda */}
                  <div className="lg:col-span-5 rounded-xl border border-zinc-800/60 bg-[#061109] p-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-900/60 text-xs">
                        <div>
                          <p className="font-bold text-white">Comanda Mesa 4</p>
                          <p className="text-[10px] text-zinc-300/75">Garzón: Carlos M. · 3 comensales</p>
                        </div>
                        <span className="font-mono text-[11px] text-zinc-400">#8942</span>
                      </div>

                      <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {cart.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between text-xs py-1 border-b border-zinc-950"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-semibold text-white truncate text-[11px]">{item.name}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.id, -1)}
                                  className="h-4 w-4 rounded bg-zinc-950 text-white flex items-center justify-center"
                                >
                                  -
                                </button>
                                <span className="font-mono text-xs px-1">{item.qty}</span>
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.id, 1)}
                                  className="h-4 w-4 rounded bg-zinc-950 text-white flex items-center justify-center"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-white">
                                {formatCLP(item.price * item.qty)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeCartItem(item.id)}
                                className="text-[#c67d52] hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-900/60 space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-300">
                        <button
                          type="button"
                          onClick={() => setTipEnabled(!tipEnabled)}
                          className="flex items-center gap-1.5"
                        >
                          <span
                            className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${
                              tipEnabled ? "bg-zinc-600 text-white border-[#c67d52]" : "border-zinc-600"
                            }`}
                          >
                            {tipEnabled && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                          </span>
                          <span>Propina sugerida 10%</span>
                        </button>
                        <span className="font-mono">{formatCLP(tipAmount)}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-zinc-300">
                        <button
                          type="button"
                          onClick={() => setDiscountApplied(!discountApplied)}
                          className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-300"
                        >
                          <Percent className="h-3 w-3" />
                          <span>{discountApplied ? "Descuento 10% aplicado" : "Aplicar cupón 10%"}</span>
                        </button>
                        {discountApplied && (
                          <span className="font-mono text-rose-400">-{formatCLP(discountAmount)}</span>
                        )}
                      </div>

                      <div className="flex items-baseline justify-between pt-1 border-t border-zinc-950">
                        <span className="text-xs font-bold text-white">Total a Cobrar</span>
                        <span className="font-mono text-base font-extrabold text-white">
                          {formatCLP(totalCart)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={sendOrderToKds}
                          disabled={cart.length === 0}
                          className="py-1.5 rounded-lg border border-zinc-600 bg-zinc-950 text-zinc-200 text-xs font-semibold hover:bg-zinc-900"
                        >
                          Mandar a Cocina
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCheckoutModalOpen(true)}
                          disabled={cart.length === 0}
                          className="py-1.5 rounded-lg bg-[#ba6c48] text-white text-xs font-extrabold hover:bg-[#c87a55]"
                        >
                          Cobrar Boleta SII
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Modal de Cobro con TODOS los Medios de Pago Reales */}
                  {isCheckoutModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                      <div className="w-full max-w-md rounded-2xl border border-zinc-400/40 bg-[#0a1b10] p-5 shadow-2xl text-zinc-200">
                        {!saleCompleted ? (
                          <>
                            <div className="flex items-center justify-between pb-2 border-b border-zinc-900/60">
                              <div>
                                <h4 className="font-bold text-white text-sm">Cobro de Comanda #FRIG-8942</h4>
                                <p className="text-[10px] text-zinc-400">Emisión directa al Servicio de Impuestos Internos</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsCheckoutModalOpen(false)}
                                className="text-xs text-zinc-400 hover:text-white"
                              >
                                Cerrar
                              </button>
                            </div>

                            <div className="my-3 text-center">
                              <span className="text-xs text-zinc-300">Total a Pagar (IVA y Propina incluidos)</span>
                              <p className="font-mono text-2xl sm:text-3xl font-extrabold text-zinc-400 mt-0.5">
                                {formatCLP(totalCart)}
                              </p>
                            </div>

                            <div className="space-y-1.5 my-3">
                              <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider block">
                                Todos los Medios de Pago Disponibles:
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {PAYMENT_METHODS.map((m) => {
                                  const Icon = m.icon;
                                  const isSel = checkoutMethod === m.id;
                                  return (
                                    <button
                                      key={m.id}
                                      type="button"
                                      onClick={() => setCheckoutMethod(m.id)}
                                      className={`p-2 rounded-lg border text-left text-xs font-semibold flex items-center gap-1.5 transition-all ${
                                        isSel
                                          ? "bg-zinc-800 border-[#c67d52] text-white shadow-sm"
                                          : "bg-[#061109] border-zinc-900 text-zinc-300 hover:bg-zinc-950"
                                      }`}
                                    >
                                      <Icon className={`h-3.5 w-3.5 shrink-0 ${isSel ? "text-white" : "text-zinc-400"}`} />
                                      <span className="truncate text-[11px]">{m.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Detalle si es efectivo: Vuelto */}
                            {checkoutMethod === "cash" && (
                              <div className="p-2.5 rounded-lg bg-[#061109] border border-zinc-900/60 my-2 text-xs flex items-center justify-between">
                                <span className="text-zinc-300">Paga con: $30.000</span>
                                <span className="font-mono font-bold text-white">
                                  Vuelto: {formatCLP(Math.max(0, 30000 - totalCart))}
                                </span>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={confirmPayment}
                              className="w-full mt-2 py-2.5 rounded-xl bg-[#ba6c48] text-white font-extrabold text-sm hover:bg-[#c87a55] shadow-md"
                            >
                              Emitir Boleta Electrónica SII & Abrir Gaveta
                            </button>
                          </>
                        ) : (
                          <div className="py-5 text-center space-y-2">
                            <CheckCircle2 className="h-10 w-10 text-zinc-400 mx-auto" />
                            <h4 className="font-bold text-white text-base">¡Venta Cobrada con Éxito!</h4>
                            <p className="text-xs text-zinc-300">
                              Boleta SII #8943 generada, gaveta de dinero abierta y registrada en Finanzas.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 3. COCINA KDS                              */}
              {/* ========================================== */}
              {effectiveTab === "kds" && (
                <motion.div
                  key="kds"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  {/* Selector de Estación */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                    {[
                      { id: "all", label: "Todas las Estaciones" },
                      { id: "Plancha & Fuegos", label: "Plancha & Fuegos" },
                      { id: "Fritura & Entradas", label: "Fritura" },
                      { id: "Barra & Coctelería", label: "Barra & Bebidas" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setKdsFilterStation(st.id)}
                        className={`px-2.5 py-1 rounded-full whitespace-nowrap text-xs transition-colors ${
                          kdsFilterStation === st.id
                            ? "bg-zinc-800 text-white font-bold"
                            : "bg-zinc-950 text-zinc-300 border border-zinc-800/40 hover:bg-zinc-900"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Pendientes */}
                    <div className="rounded-xl border border-amber-500/30 bg-[#12140a]/80 p-3 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-amber-900/40 text-xs font-bold text-amber-300">
                        <span>Pendientes ({filteredKdsOrders.filter((o) => o.status === "PENDING").length})</span>
                      </div>
                      {filteredKdsOrders
                        .filter((o) => o.status === "PENDING")
                        .map((o) => (
                          <div key={o.id} className="p-2.5 rounded-lg border border-amber-500/40 bg-[#1a1c0d] space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white">{o.table}</span>
                              <span className="font-mono text-[10px] text-amber-300">{o.id}</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-200 border border-amber-800/50 block w-fit">
                              {o.station}
                            </span>
                            <ul className="text-xs space-y-0.5">
                              {o.items.map((it, idx) => (
                                <li key={idx} className="font-semibold text-zinc-200">{it.name}</li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              onClick={() => updateKdsStatus(o.id, "PREPARING")}
                              className="w-full py-1 rounded bg-amber-600 text-zinc-950 text-[11px] font-extrabold hover:bg-amber-500"
                            >
                              Iniciar Preparación
                            </button>
                          </div>
                        ))}
                    </div>

                    {/* En Preparación */}
                    <div className="rounded-xl border border-zinc-400/30 bg-[#091b10]/80 p-3 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-zinc-900/40 text-xs font-bold text-zinc-300">
                        <span>En Preparación ({filteredKdsOrders.filter((o) => o.status === "PREPARING").length})</span>
                      </div>
                      {filteredKdsOrders
                        .filter((o) => o.status === "PREPARING")
                        .map((o) => (
                          <div key={o.id} className="p-2.5 rounded-lg border border-zinc-400/40 bg-[#0c2415] space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white">{o.table}</span>
                              <span className="font-mono text-[10px] text-zinc-300">{o.id}</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-950 text-zinc-300 border border-zinc-800/50 block w-fit">
                              {o.station}
                            </span>
                            <ul className="text-xs space-y-0.5">
                              {o.items.map((it, idx) => (
                                <li key={idx} className="font-semibold text-zinc-200">{it.name}</li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              onClick={() => updateKdsStatus(o.id, "READY")}
                              className="w-full py-1 rounded bg-zinc-600 text-white text-[11px] font-extrabold hover:bg-[#c67d52]"
                            >
                              Marcar Listo
                            </button>
                          </div>
                        ))}
                    </div>

                    {/* Listos */}
                    <div className="rounded-xl border border-sky-500/30 bg-[#09151c]/80 p-3 space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-sky-900/40 text-xs font-bold text-sky-300">
                        <span>Listos para Salón ({filteredKdsOrders.filter((o) => o.status === "READY").length})</span>
                      </div>
                      {filteredKdsOrders
                        .filter((o) => o.status === "READY")
                        .map((o) => (
                          <div key={o.id} className="p-2.5 rounded-lg border border-sky-500/40 bg-[#0c1e28] space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-white">{o.table}</span>
                              <span className="font-mono text-[10px] text-sky-300">{o.id}</span>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-200 border border-sky-800/50 block w-fit">
                              {o.station}
                            </span>
                            <ul className="text-xs space-y-0.5">
                              {o.items.map((it, idx) => (
                                <li key={idx} className="font-semibold text-zinc-200">{it.name}</li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              onClick={() => updateKdsStatus(o.id, "DONE")}
                              className="w-full py-1 rounded bg-sky-600 text-white text-[11px] font-extrabold hover:bg-sky-500"
                            >
                              Despachar
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 4. MESAS & SALÓN                           */}
              {/* ========================================== */}
              {effectiveTab === "tables" && (
                <motion.div
                  key="tables"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between text-xs text-zinc-300">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTableArea("salon")}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          tableArea === "salon" ? "bg-zinc-800 text-white" : "bg-zinc-950 text-zinc-300"
                        }`}
                      >
                        Salón Principal
                      </button>
                      <button
                        type="button"
                        onClick={() => setTableArea("terraza")}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          tableArea === "terraza" ? "bg-zinc-800 text-white" : "bg-zinc-950 text-zinc-300"
                        }`}
                      >
                        Terraza Exterior
                      </button>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-zinc-400" /> Libre
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Ocupada
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-sky-400" /> Cuenta
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { num: 1, name: "Mesa 1", status: "LIBRE", pax: 2, total: 0, waiter: "—" },
                      { num: 2, name: "Mesa 2", status: "OCUPADA", pax: 4, total: 48900, waiter: "Carlos M." },
                      { num: 3, name: "Mesa 3", status: "CUENTA", pax: 2, total: 21500, waiter: "Camila R." },
                      { num: 4, name: "Mesa 4", status: "OCUPADA", pax: 3, total: 27600, waiter: "Carlos M." },
                    ].map((t) => (
                      <button
                        key={t.num}
                        type="button"
                        onClick={() => setSelectedTableNum(t.num)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          selectedTableNum === t.num
                            ? "border-zinc-400 bg-[#122015] shadow-md ring-1 ring-zinc-400/50"
                            : "border-zinc-900/60 bg-[#141414] hover:border-[#c67d52]/40"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white text-sm">{t.name}</span>
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              t.status === "LIBRE" ? "bg-zinc-400" : t.status === "CUENTA" ? "bg-sky-400 animate-pulse" : "bg-amber-500"
                            }`}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-300 font-semibold block">
                          {t.status === "LIBRE" ? "Disponible" : t.status === "CUENTA" ? "Cuenta Pedida" : "Consumiendo"}
                        </span>
                        <div className="mt-2 pt-2 border-t border-zinc-950 flex items-center justify-between text-[11px] font-mono">
                          <span className="text-zinc-400">{t.pax} pax</span>
                          <span className="font-bold text-white">{t.total > 0 ? formatCLP(t.total) : "—"}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl border border-zinc-800/50 bg-[#061109] flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-white">Mesa {selectedTableNum} seleccionada</p>
                      <p className="text-zinc-300/80 text-[11px]">Cuentas separadas, cambio de mesa y propina legal del 10%.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => changeTab("pos")}
                      className="px-3 py-1.5 rounded-lg bg-zinc-600 text-white font-bold hover:bg-[#c67d52]"
                    >
                      Abrir Comanda en POS
                    </button>
                  </div>
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 5. RECETAS & STOCK                         */}
              {/* ========================================== */}
              {effectiveTab === "stock" && (
                <motion.div
                  key="stock"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="space-y-2">
                    {[
                      {
                        sku: "ING-ANGUS",
                        name: "Carne Angus Molida",
                        stock: "14.2 kg",
                        deduction: "-180g por Smash Burger Doble",
                        cost: "$1.260",
                        pct: 78,
                      },
                      {
                        sku: "ING-BRIOCHE",
                        name: "Pan Brioche Artesanal",
                        stock: "26 unidades",
                        deduction: "-1 unidad por hamburguesa",
                        cost: "$320",
                        pct: 24,
                      },
                      {
                        sku: "ING-CHEDDAR",
                        name: "Queso Cheddar Madurado",
                        stock: "5.8 kg",
                        deduction: "-60g por porción",
                        cost: "$240",
                        pct: 65,
                      },
                    ].map((ing) => (
                      <div
                        key={ing.sku}
                        className="p-3 rounded-xl border border-zinc-900/60 bg-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{ing.name}</span>
                            <span className="font-mono text-[10px] text-zinc-400">{ing.sku}</span>
                          </div>
                          <p className="text-[11px] text-zinc-300/80 mt-0.5">
                            {ing.deduction} · Costo porción: <strong className="text-white">{ing.cost}</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24 bg-zinc-950 rounded-full h-1.5 overflow-hidden border border-zinc-900">
                            <div
                              className={`h-full rounded-full ${ing.pct < 30 ? "bg-amber-400" : "bg-zinc-400"}`}
                              style={{ width: `${ing.pct}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-white min-w-16 text-right">
                            {ing.stock}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-800/40 bg-[#061109] text-xs flex items-center justify-between text-zinc-300">
                    <span>Costo total insumos Smash Burger: <strong>$1.820</strong></span>
                    <span className="text-zinc-400 font-bold">Margen bruto: 76.9%</span>
                  </div>
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 6. DELIVERY & RETIRO                       */}
              {/* ========================================== */}
              {effectiveTab === "delivery" && (
                <motion.div
                  key="delivery"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Pendientes", value: "4", tone: "text-amber-400" },
                      { label: "En reparto", value: "2", tone: "text-zinc-100" },
                      { label: "Entregados hoy", value: "17", tone: "text-zinc-400" },
                    ].map((s) => (
                      <div key={s.label} className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414]">
                        <span className="text-xs text-zinc-300 block mb-1">{s.label}</span>
                        <span className={`text-xl font-bold ${s.tone}`}>{s.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Pedidos entrantes</p>
                    {[
                      { id: "DEL-231", channel: "PedidosYa", items: "2× Smash Burger, 1× Papas", total: 20000, eta: "25 min", state: "En reparto" },
                      { id: "DEL-232", channel: "WhatsApp", items: "1× Luco, 2× Pisco Sour", total: 20000, eta: "40 min", state: "Preparando" },
                      { id: "DEL-233", channel: "Retiro en local", items: "1× Completo Italiano", total: 4500, eta: "15 min", state: "Listo para retiro" },
                    ].map((o) => (
                      <div
                        key={o.id}
                        className="p-3 rounded-xl border border-zinc-900/60 bg-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{o.id}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">{o.channel}</span>
                            <span className={`text-[10px] font-semibold ${o.state === "En reparto" ? "text-[#c67d52]" : "text-zinc-300"}`}>{o.state}</span>
                          </div>
                          <p className="text-[11px] text-zinc-300/80 mt-0.5">{o.items}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-white">{formatCLP(o.total)}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">ETA {o.eta}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-800/40 bg-[#141414] text-xs flex items-center justify-between text-zinc-300">
                    <span>Los pedidos entran al mismo KDS y descuentan stock igual que el salón.</span>
                    <span className="text-zinc-400 font-bold">Un solo flujo, todos los canales</span>
                  </div>
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 7. MENÚ QR                                 */}
              {/* ========================================== */}
              {effectiveTab === "qr" && (
                <motion.div
                  key="qr"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl border border-zinc-800/40 bg-[#141414] flex flex-col items-center text-center gap-3">
                      <QrCode className="h-24 w-24 text-white" strokeWidth={1} />
                      <p className="text-xs text-zinc-300">Carta digital · Mesa 4</p>
                      <p className="text-[11px] text-zinc-400">
                        El cliente escanea, ve fotos, precios y alergenos. Pide directo desde la mesa.
                      </p>
                    </div>
                    <div className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414] space-y-2 text-xs">
                      <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Pedidos desde la mesa · hoy</p>
                      {[
                        { table: "Mesa 3", item: "2× Pisco Sour", state: "Enviado a barra" },
                        { table: "Mesa 7", item: "1× Cheesecake", state: "Enviado a cocina" },
                        { table: "Mesa 4", item: "1× Cerveza IPA", state: "Entregado" },
                      ].map((r) => (
                        <div key={r.table} className="flex items-center justify-between p-2 rounded-lg bg-[#181818]">
                          <div>
                            <span className="font-semibold text-white">{r.table}</span>
                            <span className="text-zinc-300/80"> · {r.item}</span>
                          </div>
                          <span className="text-[10px] text-zinc-400">{r.state}</span>
                        </div>
                      ))}
                      <div className="p-2 rounded-lg bg-[#1a1a1a] border border-zinc-800/60 text-[11px] text-zinc-300">
                        Cada pedido QR entra a comanda y descuenta stock automáticamente.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 8. PROVEEDORES & COMPRAS                   */}
              {/* ========================================== */}
              {effectiveTab === "compras" && (
                <motion.div
                  key="compras"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Órdenes de compra</p>
                    {[
                      { prov: "Carnes El Matancero", items: "20 kg carne molida, 8 kg tocino", total: 189000, state: "Recibida", icon: Package },
                      { prov: "Distribuidora Bever SA", items: "4 cajas cerveza IPA 24un", total: 168000, state: "En camino", icon: Truck },
                      { prov: "Verduras La Vega", items: "Lechugas, tomates, cebollas", total: 42300, state: "Borrador", icon: Printer },
                    ].map((oc) => (
                      <div
                        key={oc.prov}
                        className="p-3 rounded-xl border border-zinc-900/60 bg-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <oc.icon className="h-3.5 w-3.5 text-zinc-400" />
                            <span className="font-bold text-white">{oc.prov}</span>
                            <span className={`text-[10px] font-semibold ${oc.state === "Recibida" ? "text-[#c67d52]" : "text-zinc-300"}`}>{oc.state}</span>
                          </div>
                          <p className="text-[11px] text-zinc-300/80 mt-0.5">{oc.items}</p>
                        </div>
                        <span className="font-mono font-bold text-white">{formatCLP(oc.total)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-800/40 bg-[#141414] text-xs flex items-center justify-between text-zinc-300">
                    <span>Al recibir una orden, la bodega se actualiza sola y el costo de cada receta se recalcula.</span>
                    <span className="text-zinc-400 font-bold">Compra → bodega → costo real</span>
                  </div>
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 9. BOLETA SII & MEDIOS DE PAGO             */}
              {/* ========================================== */}
              {effectiveTab === "facturacion" && (
                <motion.div
                  key="facturacion"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414] space-y-2 text-xs">
                      <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Último documento SII</p>
                      <div className="flex items-center justify-between p-2 rounded-lg bg-[#181818]">
                        <div>
                          <span className="font-bold text-white">Boleta Nº 8956</span>
                          <p className="text-[11px] text-zinc-400 mt-0.5">Mesa 2 · {formatCLP(24300)} · propina 10% incluida</p>
                        </div>
                        <span className="text-[10px] font-semibold text-[#c67d52]">ACEPTADO SII</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#181818] text-[11px] text-zinc-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5"><Printer className="h-3.5 w-3.5 text-zinc-400" /> Impresión térmica + PDF al correo</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#181818] text-[11px] text-zinc-300">
                        Factura con IVA desglosado y envío directo al SII, sin sistemas aparte.
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414] space-y-2 text-xs">
                      <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Medios de pago del turno</p>
                      {[
                        { m: "Transbank Débito", v: 486900, icon: CreditCard },
                        { m: "Transbank Crédito", v: 152300, icon: CreditCard },
                        { m: "Efectivo", v: 213400, icon: Banknote },
                        { m: "Transferencia", v: 58200, icon: CheckCircle2 },
                      ].map((p) => (
                        <div key={p.m} className="flex items-center justify-between p-2 rounded-lg bg-[#181818]">
                          <span className="flex items-center gap-1.5 text-zinc-200">
                            <p.icon className="h-3.5 w-3.5 text-zinc-400" />
                            {p.m}
                          </span>
                          <span className="font-mono font-bold text-white">{formatCLP(p.v)}</span>
                        </div>
                      ))}
                      <div className="p-2 rounded-lg bg-[#1a1a1a] border border-zinc-800/60 text-[11px] text-zinc-300 flex items-center justify-between">
                        <span>Propina 10% configurable por mesa</span>
                        <span className="font-bold text-white">{formatCLP(41200)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 10. MULTI-SUCURSAL                         */}
              {/* ========================================== */}
              {effectiveTab === "sucursales" && (
                <motion.div
                  key="sucursales"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Todas las sucursales · hoy</p>
                    {[
                      { s: "Providencia", ventas: 910400, tickets: 74, open: true },
                      { s: "Ñuñoa", ventas: 634200, tickets: 58, open: true },
                      { s: "Las Condes", ventas: 301300, tickets: 31, open: false },
                    ].map((b) => (
                      <div
                        key={b.s}
                        className="p-3 rounded-xl border border-zinc-900/60 bg-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className={`h-2 w-2 rounded-full ${b.open ? "bg-zinc-400 animate-pulse" : "bg-zinc-700"}`} />
                          <div>
                            <span className="font-bold text-white">{b.s}</span>
                            <p className="text-[11px] text-zinc-400">{b.tickets} tickets · {b.open ? "Turno activo" : "Cerrado"}</p>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-white">{formatCLP(b.ventas)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-800/40 bg-[#141414] text-xs flex items-center justify-between text-zinc-300">
                    <span>Carta central, precios y stock por local. Reportes consolidados del grupo en un solo lugar.</span>
                    <span className="text-zinc-400 font-bold">Total grupo: {formatCLP(1845900)}</span>
                  </div>
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 11. VENTAS & COTIZACIONES                  */}
              {/* ========================================== */}
              {effectiveTab === "ventas" && (
                <motion.div
                  key="ventas"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Documentos de hoy</p>
                    {[
                      { id: "Boleta #8956", detail: "Mesa 2 · Transbank Débito", total: 24300, state: "Emitida SII" },
                      { id: "Boleta #8955", detail: "Para llevar · Efectivo", total: 8600, state: "Emitida SII" },
                      { id: "Cotización COT-45", detail: "Catering 100 personas · evento corporativo", total: 1250000, state: "Pendiente" },
                    ].map((d) => (
                      <div
                        key={d.id}
                        className="p-3 rounded-xl border border-zinc-900/60 bg-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white">{d.id}</span>
                            <span className={`text-[10px] font-semibold ${d.state === "Pendiente" ? "text-amber-400" : "text-[#c67d52]"}`}>{d.state}</span>
                          </div>
                          <p className="text-[11px] text-zinc-300/80 mt-0.5">{d.detail}</p>
                        </div>
                        <span className="font-mono font-bold text-white">{formatCLP(d.total)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg border border-zinc-800/40 bg-[#141414] text-xs flex items-center justify-between text-zinc-300">
                    <span>Toda venta queda con su documento tributario. Las cotizaciones se convierten en venta con un clic.</span>
                    <span className="text-zinc-400 font-bold">Historial completo y buscable</span>
                  </div>
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 12. BANCOS & CONCILIACIÓN                  */}
              {/* ========================================== */}
              {effectiveTab === "bancos" && (
                <motion.div
                  key="bancos"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414] space-y-2 text-xs">
                      <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Cuentas conectadas</p>
                      {[
                        { b: "Cuenta Corriente BancoEstado ····1234", saldo: 3420000 },
                        { b: "Cuenta Vista Banco Santander ····5678", saldo: 815000 },
                      ].map((c) => (
                        <div key={c.b} className="flex items-center justify-between p-2 rounded-lg bg-[#181818]">
                          <span className="text-zinc-200">{c.b}</span>
                          <span className="font-mono font-bold text-white">{formatCLP(c.saldo)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414] space-y-2 text-xs">
                      <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Conciliación automática · hoy</p>
                      <div className="p-2 rounded-lg bg-[#181818] flex items-center justify-between text-zinc-200">
                        <span>Transacciones Transbank conciliadas</span>
                        <span className="font-mono font-bold text-white">142 / 142</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#181818] flex items-center justify-between text-zinc-200">
                        <span>Ventas vs depósitos bancarios</span>
                        <span className="font-mono font-bold text-[#c67d52]">Diferencia $0</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[#1a1a1a] border border-zinc-800/60 text-[11px] text-zinc-300">
                        Cada cobro del POS cuadra solo contra el banco. Se acabó cuadrar planillas a mano.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 13. CLIENTES & PROMOCIONES                 */}
              {/* ========================================== */}
              {effectiveTab === "clientes" && (
                <motion.div
                  key="clientes"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414] space-y-2 text-xs">
                      <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Clientes frecuentes</p>
                      {[
                        { n: "Ana Rodríguez", d: "12 visitas este mes · favorito: Smash Burger", desc: "10% auto" },
                        { n: "Pedro Salinas", d: "6 visitas este mes · gasta $12.000 promedio", desc: "5% auto" },
                      ].map((c) => (
                        <div key={c.n} className="p-2 rounded-lg bg-[#181818]">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">{c.n}</span>
                            <span className="text-[10px] font-semibold text-[#c67d52]">{c.desc}</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">{c.d}</p>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414] space-y-2 text-xs">
                      <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Promociones activas</p>
                      {[
                        { p: "2×1 Pisco Sour · Martes", state: "Activa" },
                        { p: "Combo Familiar −15% · fines de semana", state: "Activa" },
                        { p: "Felices 50: −50% en cumpleaños", state: "Programada" },
                      ].map((pr) => (
                        <div key={pr.p} className="flex items-center justify-between p-2 rounded-lg bg-[#181818]">
                          <span className="text-zinc-200">{pr.p}</span>
                          <span className={`text-[10px] font-semibold ${pr.state === "Activa" ? "text-[#c67d52]" : "text-zinc-400"}`}>{pr.state}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ========================================== */}
              {/* 14. REPORTES                               */}
              {/* ========================================== */}
              {effectiveTab === "reportes" && (
                <motion.div
                  key="reportes"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414] space-y-2 text-xs">
                      <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Ventas últimos 7 días</p>
                      <div className="flex items-end justify-between gap-1.5 h-24 px-1">
                        {[42, 55, 38, 70, 88, 100, 64].map((h, i) => (
                          <div key={i} className="flex-1 rounded-t bg-[#c67d52]/80" style={{ height: `${h}%` }} />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500 px-1">
                        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <span key={i}>{d}</span>)}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl border border-zinc-800/40 bg-[#141414] space-y-2 text-xs">
                      <p className="text-[11px] font-mono text-zinc-400/70 uppercase tracking-wider">Top productos del mes</p>
                      {[
                        { p: "Smash Burger Doble", q: "412 un." },
                        { p: "Cerveza IPA Artesanal", q: "386 un." },
                        { p: "Papas Rústicas Trufadas", q: "290 un." },
                      ].map((t, i) => (
                        <div key={t.p} className="flex items-center justify-between p-2 rounded-lg bg-[#181818]">
                          <span className="text-zinc-200">{i + 1}. {t.p}</span>
                          <span className="font-mono font-bold text-white">{t.q}</span>
                        </div>
                      ))}
                      <div className="p-2 rounded-lg bg-[#1a1a1a] border border-zinc-800/60 text-[11px] text-zinc-300">
                        Reportes de ventas, costos, márgenes y nutrición. Exportables en un clic.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Pie Interior de la App */}
          <div className="pt-3 mt-4 border-t border-zinc-900/70 flex flex-wrap items-center justify-between text-[11px] text-zinc-300/70 gap-2">
            <span>Operación unificada: POS táctil, comanderos móviles, cocina KDS y arqueo de caja sincronizados.</span>
            <span className="text-zinc-400 font-semibold">100% Web sin descargas ni licencias por terminal</span>
          </div>
        </main>
      </div>
    </div>
  );
}
