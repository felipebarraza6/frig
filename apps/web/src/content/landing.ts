import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  ChefHat,
  CreditCard,
  LayoutGrid,
  Leaf,
  Palette,
  Store,
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
    "Desde un punto de venta hasta un restaurante completo. FRIG es la app para vender, sentar mesas, cocinar y ver tus números — sin pagar módulo por módulo.",
};

export const LANDING_FEATURES: LandingFeature[] = [
  {
    icon: Zap,
    title: "Caja rápida y táctil",
    description: "Busca, arma el pedido y cobra en segundos.",
  },
  {
    icon: Store,
    title: "Varias sucursales, una cuenta",
    description: "Cada local opera con su equipo, en el mismo sistema.",
  },
  {
    icon: Palette,
    title: "Marca propia en cada local",
    description: "Logo, colores y bienvenida por sucursal.",
  },
  {
    icon: LayoutGrid,
    title: "Gestión de mesas",
    description: "Mapa del salón, estados y transferencias.",
  },
  {
    icon: ChefHat,
    title: "Cocina en tiempo real",
    description: "Comandas y monitor de cocina incluidos.",
  },
  {
    icon: Warehouse,
    title: "Inventario de verdad",
    description: "Bodegas, movimientos y stock bajo control.",
  },
  {
    icon: BookOpen,
    title: "Gestión de recetas",
    description: "Fichas, costos e insumos de cada plato.",
  },
  {
    icon: Leaf,
    title: "Etiquetado nutricional",
    description: "Etiquetas de tus recetas, listas para imprimir.",
  },
  {
    icon: CreditCard,
    title: "Finanzas y reportes",
    description: "Cobros, ingresos, egresos y números claros.",
  },
];

export const DEMO_CONTACTS = {
  to: "frig@yggdra.cl",
  subject: "Solicito una demo de FRIG",
} as const;
