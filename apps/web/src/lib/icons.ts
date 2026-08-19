import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Receipt,
  Banknote,
  ChefHat,
  ShoppingBag,
  FileText,
  Package,
  Boxes,
  QrCode,
  Apple,
  Tags,
  Warehouse,
  ClipboardList,
  Table,
  UserCircle,
  Users,
  Percent,
  CreditCard,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Monitor,
  Truck,
  Settings,
  ShoppingCart,
  TrendingUp,
  Calendar,
  Leaf,
  Utensils,
  PackageCheck,
  BoxesIcon,
} from "lucide-react";

/**
 * Mapa global de nombres de icono a componentes de Lucide.
 * Usado por el menú dinámico y la pantalla de módulos.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Receipt,
  Banknote,
  ChefHat,
  ShoppingBag,
  FileText,
  Package,
  Boxes,
  QrCode,
  Apple,
  Tags,
  Warehouse,
  ClipboardList,
  Table,
  UserCircle,
  Users,
  Percent,
  CreditCard,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Monitor,
  Truck,
  Settings,
  ShoppingCart,
  TrendingUp,
  Calendar,
  Leaf,
  Utensils,
  PackageCheck,
  BoxesIcon,
};

export type IconName = keyof typeof ICON_MAP;

export function getIcon(name?: string | null): LucideIcon {
  if (!name) return Package;
  return ICON_MAP[name] ?? Package;
}
