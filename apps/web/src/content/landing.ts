import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Bike,
  ChefHat,
  CreditCard,
  FileText,
  LayoutGrid,
  QrCode,
  ShieldCheck,
  Store,
  Truck,
  Warehouse,
  Zap,
} from "lucide-react";

export interface LandingFeature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface LandingValueProp {
  headline: string;
  subhead: string;
}

export const LANDING_VALUE_PROP: LandingValueProp = {
  headline: "Gestión comercial y gastronómica, todo incluido.",
  subhead:
    "Punto de venta, mesas, cocina, delivery, inventario y finanzas en una sola app. Activa solo los módulos que tu negocio necesita — sin pagar de más.",
};

/**
 * Funcionalidades reales de FRIG (alineadas a los módulos de la app).
 * Cada ítem describe algo que el sistema hace hoy, no promesas.
 */
export const LANDING_FEATURES: LandingFeature[] = [
  {
    icon: Zap,
    title: "Punto de venta táctil",
    description: "Cobra en segundos con modificadores, combos y descuentos.",
  },
  {
    icon: Banknote,
    title: "Caja y arqueo",
    description: "Apertura, movimientos, cierre y cuadratura del día.",
  },
  {
    icon: LayoutGrid,
    title: "Mesas y salón",
    description: "Mapa del local, cuentas por mesa y modo garzón.",
  },
  {
    icon: Bike,
    title: "Delivery y retiro",
    description: "Pedidos con despacho y panel de pendientes.",
  },
  {
    icon: ChefHat,
    title: "Cocina en vivo",
    description: "Comandas por estación en la pantalla KDS, sin papeles.",
  },
  {
    icon: Warehouse,
    title: "Inventario multi-bodega",
    description: "Stock, movimientos y alertas en tiempo real.",
  },
  {
    icon: Truck,
    title: "Compras y proveedores",
    description: "Órdenes de compra y pagos integrados a la caja.",
  },
  {
    icon: CreditCard,
    title: "Finanzas claras",
    description: "Pagos, métodos, cuentas bancarias y conciliación.",
  },
  {
    icon: FileText,
    title: "Documentos tributarios",
    description: "Boletas y facturas electrónicas listas para el SII.",
  },
  {
    icon: QrCode,
    title: "Menú QR público",
    description: "Tu carta digital para que los clientes vean y compartan.",
  },
  {
    icon: Store,
    title: "Multi-sucursal con tu marca",
    description: "Logo, colores, equipo y módulos por cada local.",
  },
  {
    icon: ShieldCheck,
    title: "Roles y permisos",
    description: "Cajero, garzón y administrador: cada uno ve lo suyo.",
  },
];

export const DEMO_CONTACTS = {
  to: "frig@yggdra.cl",
  subject: "Solicito una demo de FRIG",
} as const;

// ── Planes de precio ─────────────────────────────────────────────────────────

/**
 * Parrilla de precios de FRIG. Filosofía: todos los planes incluyen TODOS los
 * módulos (FRIG es abierta, no vende por herramienta). El precio crece con el
 * nivel de demanda del negocio — sucursales, puntos de venta y usuarios —
 * no con las funciones disponibles.
 */
export interface LandingPlan {
  id: string;
  name: string;
  /** Perfil de negocio al que apunta el nivel. */
  tagline: string;
  /** Precio mensual en UF (null = a convenir). */
  priceUf: number | null;
  /** Recursos incluidos (lo que crece entre niveles). */
  resources: string[];
  highlighted?: boolean;
}

export const LANDING_INTEGRATION_UF = 1;

export const LANDING_PLANS: LandingPlan[] = [
  {
    id: "kiosco",
    name: "Emprendimiento",
    tagline: "Kioscos y negocios de barrio",
    priceUf: 1,
    resources: ["1 sucursal", "1 punto de venta", "2 usuarios"],
  },
  {
    id: "local",
    name: "Local en crecimiento",
    tagline: "Minimarkets y cafeterías con su segunda caja",
    priceUf: 2,
    resources: ["1 sucursal", "2 puntos de venta", "5 usuarios", "Totem QR incluido"],
  },
  {
    id: "restaurante",
    name: "Restaurante",
    tagline: "Salón con mesas, garzones y cocina en vivo",
    priceUf: 3,
    resources: ["2 sucursales", "3 puntos de venta", "10 usuarios", "KDS de cocina incluido"],
    highlighted: true,
  },
  {
    id: "grande",
    name: "Operación grande",
    tagline: "Varios salones, cajeros y turnos completos",
    priceUf: 5,
    resources: ["3 sucursales", "6 puntos de venta", "20 usuarios", "Multi-bodega completa"],
  },
  {
    id: "cadena",
    name: "Cadena",
    tagline: "Franquicias y multi-local a escala",
    priceUf: null,
    resources: ["Sucursales ilimitadas", "POS ilimitados", "Usuarios ilimitados", "Acompañamiento dedicado"],
  },
];

export const LANDING_PRICING_NOTE =
  "Todos los planes incluyen todos los módulos: POS, caja, mesas, cocina, delivery, inventario, finanzas, documentos tributarios, menú QR, promociones, reportes y multi-sucursal con tu marca. El precio crece con el tamaño de tu operación — nunca con las funciones.";

// ── Casos de uso (demos) ─────────────────────────────────────────────────────

/**
 * Demos activas de FRIG por rubro. Cada una tiene su login personalizado
 * (logo y color de marca) en /login/<slug>.
 */
export interface LandingUseCase {
  slug: string;
  name: string;
  rubro: string;
  /** Color de marca de la demo. */
  brandColor: string;
  /** Qué demuestra. */
  highlight: string;
}

export const LANDING_USE_CASES: LandingUseCase[] = [
  {
    slug: "pos",
    name: "Kiosco Express San Miguel",
    rubro: "Punto de venta",
    brandColor: "#f97316",
    highlight: "Cobro táctil en segundos",
  },
  {
    slug: "minimarket",
    name: "Mini Market Don Pepe",
    rubro: "Minimarket",
    brandColor: "#16a34a",
    highlight: "Catálogo con código y stock",
  },
  {
    slug: "comida",
    name: "Sanguchería El Che",
    rubro: "Comida rápida / takeaway",
    brandColor: "#dc2626",
    highlight: "Combos y modificadores al vuelo",
  },
  {
    slug: "bistro",
    name: "Bistro La Tranquera",
    rubro: "Restaurante mediano",
    brandColor: "#d4a017",
    highlight: "9 mesas con cuentas por mesa",
  },
  {
    slug: "grande",
    name: "Restaurante Puerto Azul",
    rubro: "Restaurante grande",
    brandColor: "#1e3a8a",
    highlight: "18 mesas, cajero y garzones",
  },
  {
    slug: "heladeria",
    name: "Heladería Glacé Andino",
    rubro: "Heladería artesanal",
    brandColor: "#d946ef",
    highlight: "Recetas y sabores por combinación",
  },
];
