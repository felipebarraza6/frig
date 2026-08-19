import { getIcon, ICON_MAP, type IconName } from "@/lib/icons";
import type { LucideIcon, LucideProps } from "lucide-react";

/**
 * Re-exporta el mapa de íconos para el menú dinámico.
 * Mantiene compatibilidad con código existente.
 */
export const MENU_ICON_MAP = ICON_MAP;
export type MenuIconName = IconName;
export { getIcon as getMenuIcon };
export type { LucideIcon, LucideProps };
