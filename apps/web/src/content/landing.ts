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
