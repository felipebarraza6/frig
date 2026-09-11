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
  /** light | dark */
  mode: "light" | "dark";
  /** Breve descriptor del vibe visual. */
  description: string;
}

/** 4 temas nórdicos/comerciales × Light + Dark = 8 presets. */
export const PRESET_THEMES: readonly ThemePalette[] = [
  // ─── Aurora Boreal ───
  {
    id: "aurora-light",
    label: "Aurora Boreal",
    primary: "#10b981",
    secondary: "#7c3aed",
    accent: "#06b6d4",
    surface: "#f0fdf4",
    text: "#1e293b",
    muted: "#94a3b8",
    mode: "light",
    description: "Verde esmeralda y violeta — frescura ártica clara",
  },
  {
    id: "aurora-dark",
    label: "Aurora Boreal",
    primary: "#10b981",
    secondary: "#7c3aed",
    accent: "#06b6d4",
    surface: "#0f172a",
    text: "#f1f5f9",
    muted: "#475569",
    mode: "dark",
    description: "Verde esmeralda y violeta profundo — frescura ártica oscura",
  },
  // ─── Fjord ───
  {
    id: "fjord-light",
    label: "Fjord",
    primary: "#2563eb",
    secondary: "#64748b",
    accent: "#0ea5e9",
    surface: "#f8fafc",
    text: "#0f172a",
    muted: "#94a3b8",
    mode: "light",
    description: "Azul glaciar y gris nórdico — serenidad costera clara",
  },
  {
    id: "fjord-dark",
    label: "Fjord",
    primary: "#2563eb",
    secondary: "#475569",
    accent: "#0ea5e9",
    surface: "#1e293b",
    text: "#f1f5f9",
    muted: "#64748b",
    mode: "dark",
    description: "Azul profundo y gris acero — serenidad costera oscura",
  },
  // ─── Glaciar ───
  {
    id: "glaciar-light",
    label: "Glaciar",
    primary: "#0891b2",
    secondary: "#e2e8f0",
    accent: "#22d3ee",
    surface: "#ffffff",
    text: "#1e293b",
    muted: "#cbd5e1",
    mode: "light",
    description: "Cyan hielo y blanco limpio — minimalismo polar claro",
  },
  {
    id: "glaciar-dark",
    label: "Glaciar",
    primary: "#06b6d4",
    secondary: "#334155",
    accent: "#22d3ee",
    surface: "#1a1a2e",
    text: "#e2e8f0",
    muted: "#475569",
    mode: "dark",
    description: "Cyan frío y noche polar — minimalismo oscuro",
  },
  // ─── Magma ───
  {
    id: "magma-light",
    label: "Magma",
    primary: "#dc2626",
    secondary: "#ea580c",
    accent: "#f59e0b",
    surface: "#fef3c7",
    text: "#1c1917",
    muted: "#78716c",
    mode: "light",
    description: "Rojo volcánico y ámbar cálido — energía de cocina clara",
  },
  {
    id: "magma-dark",
    label: "Magma",
    primary: "#dc2626",
    secondary: "#ea580c",
    accent: "#f59e0b",
    surface: "#1c1917",
    text: "#fafaf9",
    muted: "#57534e",
    mode: "dark",
    description: "Rojo volcánico y ámbras — energía cálida oscura",
  },
] as const;

/** Lookup rápido por ID. */
export function getThemeById(id: string): ThemePalette | undefined {
  return PRESET_THEMES.find((t) => t.id === id);
}

/** Retorna solo los themes base (sin duplicar por modo). */
export function getBaseThemes(): readonly ThemePalette[] {
  const seen = new Set<string>();
  return PRESET_THEMES.filter((t) => {
    if (seen.has(t.label)) return false;
    seen.add(t.label);
    return true;
  });
}

/** Retorna la variante light y dark de un theme base por su label. */
export function getThemeVariants(label: string): ThemePalette[] {
  return PRESET_THEMES.filter((t) => t.label === label);
}
