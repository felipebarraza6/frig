/** Paletas predefinidas para la galería de temas de sucursal. */

export interface ThemePalette {
  /** Nombre identificable del theme (clave interna). */
  id: string;
  /** Nombre comercial visible en UI. */
  label: string;
  /** Color primario (hex). Botones, acentos principales, focos. */
  primary: string;
  /** Color secundario (hex). Fondos de cards, bordes sutiles. */
  secondary: string;
  /** Color accent (hex). Highlights, badges, iconos activos. */
  accent: string;
  /** Color de fondo de la app (hex). */
  surface: string;
  /** Color de texto principal (hex). */
  text: string;
  /** Color muted/neutral (hex). */
  muted: string;
  /** Breve descriptor del vibe visual. */
  description: string;
}

/** 4 temas nórdicos/comerciales para Frig — legibles a primera vista. */
export const PRESET_THEMES: readonly ThemePalette[] = [
  {
    id: "aurora",
    label: "Aurora Boreal",
    primary: "#10b981",
    secondary: "#7c3aed",
    accent: "#06b6d4",
    surface: "#0f172a",
    text: "#f1f5f9",
    muted: "#475569",
    description: "Verde esmeralda y violeta profundo — frescura ártica",
  },
  {
    id: "fjord",
    label: "Fjord",
    primary: "#2563eb",
    secondary: "#64748b",
    accent: "#0ea5e9",
    surface: "#f8fafc",
    text: "#0f172a",
    muted: "#94a3b8",
    description: "Azul glaciar y gris nórdico — serenidad costera",
  },
  {
    id: "glaciar",
    label: "Glaciar",
    primary: "#0891b2",
    secondary: "#e2e8f0",
    accent: "#22d3ee",
    surface: "#ffffff",
    text: "#1e293b",
    muted: "#cbd5e1",
    description: "Cyan hielo y blanco limpio — minimalismo polar",
  },
  {
    id: "magma",
    label: "Magma",
    primary: "#dc2626",
    secondary: "#ea580c",
    accent: "#f59e0b",
    surface: "#1c1917",
    text: "#fafaf9",
    muted: "#57534e",
    description: "Rojo volcánico y ámbar cálido — energía de cocina",
  },
] as const;

/** Lookup rápido por ID. */
export function getThemeById(id: string): ThemePalette | undefined {
  return PRESET_THEMES.find((t) => t.id === id);
}
