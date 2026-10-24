import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Bike,
  Boxes,
  ChartColumn,
  ChefHat,
  CreditCard,
  FileText,
  Kanban,
  LayoutGrid,
  Leaf,
  QrCode,
  Rotate3d,
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
  points: string[];
}

export const LANDING_VALUE_PROP: LandingValueProp = {
  headline: "El restaurante, en una sola pantalla",
  subhead:
    "Cobra, cocina y controla caja, stock y sucursales sin instalar nada. Abres una pestaña y el turno ya puede empezar.",
  points: [
    "Todos los módulos, en todos los planes",
    "Caja, mesas y cocina en el mismo turno",
    "Tu marca, sin instaladores ni cajas",
    "Demos reales, listas para probar",
  ],
};

/** Pruebas cortas del hero. No son métricas inventadas: son hechos del producto. */
export const LANDING_PROOF = [
  { value: "0", label: "instaladores" },
  { value: "1", label: "sistema por local" },
  { value: "UF", label: "precio, no por módulo" },
] as const;

/**
 * Ambiente de revisión, aparte de producción.
 * El workflow de staging inyecta NEXT_PUBLIC_STAGING_URL. En local (y en el
 * build FTP de producción) cae al GitHub Pages del repo.
 */
export const LANDING_STAGING_URL =
  process.env.NEXT_PUBLIC_STAGING_URL?.trim() ||
  "https://felipebarraza6.github.io/frig/";

export const LANDING_STAGING = {
  kicker: "Staging para revisar",
  title: "Hay una versión de staging para revisar bien",
  body: "Antes de pasar a producción, el mismo sistema corre en un ambiente aparte: módulos, flujos y marca se prueban ahí, sin tocar el local en vivo.",
} as const;

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
    icon: Rotate3d,
    title: "Salón digital 3D",
    description:
      "Tu local en 3D: pantallas de cocina vivas en los muros, tótem de catálogo y recorrido en primera persona.",
  },
  {
    icon: LayoutGrid,
    title: "Mesas y salón",
    description:
      "Cuentas por mesa, estados en vivo y modo garzón sobre el mapa del local.",
  },
  {
    icon: ChefHat,
    title: "Cocina y KDS",
    description:
      "Comandas en pantalla con tiempos en vivo, colores de estado configurables y monitor del salón.",
  },
  {
    icon: Bike,
    title: "Delivery y retiro",
    description: "Pedidos con despacho y panel de pendientes.",
  },
  {
    icon: Warehouse,
    title: "Inventario y recetas",
    description: "Descuento automático de insumos al vender.",
  },
  {
    icon: Boxes,
    title: "Bodegas visuales",
    description:
      "Bodegas por salas y casillas con vista 3D e inspector de stock a golpe de vista.",
  },
  {
    icon: ChartColumn,
    title: "Informes y finanzas",
    description:
      "Ventas, dinero, gastos e ingresos: KPIs con deltas por período, listos para decidir.",
  },
  {
    icon: Kanban,
    title: "CRM comercial",
    description:
      "Prospectos, embudo de oportunidades, seguimientos y encuestas públicas con QR.",
  },
  {
    icon: FileText,
    title: "Facturación electrónica",
    description: "Boletas y facturas al SII con un clic.",
  },
  {
    icon: QrCode,
    title: "Menú QR y pedidos",
    description:
      "Carta digital con carrito, pedidos desde la mesa y modo tótem para autoservicio.",
  },
  {
    icon: Leaf,
    title: "Etiquetas nutricionales",
    description:
      "Etiqueta normada generada desde tus recetas, imprimible en un clic.",
  },
  {
    icon: CreditCard,
    title: "Medios de pago",
    description: "Transbank, efectivo, transferencia y propina del 10%.",
  },
  {
    icon: Store,
    title: "Multi-sucursal",
    description: "Gestiona varios locales desde una sola cuenta.",
  },
  {
    icon: Truck,
    title: "Proveedores y compras",
    description: "Órdenes de compra, cotizaciones y recepción de mercadería.",
  },
  {
    icon: ShieldCheck,
    title: "Roles y permisos",
    description: "Acceso granular para administradores, cajeros y garzones.",
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
  tagline: string;
  priceUf: number | null;
  /** Recursos incluidos (lo que crece entre niveles). */
  resources: string[];
  highlighted?: boolean;
  /** Texto del sello del plan destacado (viene del sistema). */
  badge?: string | null;
}

export const LANDING_INTEGRATION_UF = 0;

export const LANDING_PLANS: LandingPlan[] = [
  {
    id: "demo",
    name: "Plan Demo",
    tagline: "Prueba gratuita sin compromiso",
    priceUf: 0,
    resources: ["POS básico", "Inventario", "1 sucursal", "Soporte email"],
  },
  {
    id: "local",
    name: "Plan Local",
    tagline: "Para locales pequeños",
    priceUf: 5,
    resources: ["POS avanzado", "Inventario completo", "3 sucursales", "Soporte prioritario", "Reportes básicos"],
    highlighted: true,
    badge: "Más Popular",
  },
  {
    id: "pro",
    name: "Plan Pro",
    tagline: "Para redes y franquicias",
    priceUf: 15,
    resources: ["Todo en Local", "Sucursales ilimitadas", "Agentes IA", "Workflows", "Soporte 24/7", "API completa"],
  },
];

export const LANDING_PRICING_NOTE = "Precios en UF. Plan demo sin costo.";

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
    name: "Sanguchería Chillán",
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
  {
    slug: "pub",
    name: "Pub La Oficina",
    rubro: "Pub / Bar",
    brandColor: "#8E44AD",
    highlight: "Tragos y tablas con ventas rápidas",
  },
  {
    slug: "cafeteria",
    name: "Pastelería Dulce Amanecer",
    rubro: "Cafetería / Pastelería",
    brandColor: "#E67E22",
    highlight: "Recetas que descuentan insumos",
  },
  {
    slug: "gestion",
    name: "Comercial Los Robles",
    rubro: "Gestión comercial",
    brandColor: "#2C3E50",
    highlight: "Solo finanzas: lo esencial de tu negocio",
  },
];
