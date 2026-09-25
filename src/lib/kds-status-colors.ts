/**
 * Colores KDS (Pendiente / En preparación / Listo) **siempre por estación**.
 * Sin config guardada: tríada automática adaptada al primary del theme.
 */

export type KdsStatusKey = "pending" | "preparing" | "ready";

export type KdsStatusColors = Record<KdsStatusKey, string>;

/** Fallback fijo solo si no hay theme (no debería usarse en app autenticada). */
export const KDS_STATUS_DEFAULTS: KdsStatusColors = {
  pending: "#f59e0b",
  preparing: "#0ea5e9",
  ready: "#10b981",
};

export const KDS_STATUS_LABELS: Record<KdsStatusKey, string> = {
  pending: "Pendientes",
  preparing: "En preparación",
  ready: "Listos",
};

function stationStorageKey(
  branchId: string | number,
  stationId: string | number,
): string {
  return `frig.kds.statusColors.${branchId}.${stationId}`;
}

function branchStorageKey(branchId: string | number): string {
  return `frig.kds.statusColors.${branchId}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function normalizeHex(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const v = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(v)) {
    const r = v[1];
    const g = v[2];
    const b = v[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
}

/**
 * Tríada automática desde el primary del theme:
 * - preparing = primary (marca)
 * - pending = giro cálido (~ámbar) sobre el mismo tono
 * - ready = giro fresco (~verde) sobre el mismo tono
 */
export function defaultKdsStatusColorsFromTheme(
  primaryHex?: string | null,
): KdsStatusColors {
  const rgb = primaryHex ? hexToRgb(primaryHex) : null;
  if (!rgb) return { ...KDS_STATUS_DEFAULTS };

  const [h, sRaw, lRaw] = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const s = Math.max(42, Math.min(78, sRaw < 20 ? 55 : sRaw));
  const l = Math.max(38, Math.min(58, lRaw < 28 ? 48 : lRaw > 72 ? 48 : lRaw));

  return {
    pending: hslToHex(h + 38, s, l),
    preparing: hslToHex(h, s, l),
    ready: hslToHex(h - 48, s, l),
  };
}

function parseColors(
  raw: string | null,
  fallback: KdsStatusColors,
): KdsStatusColors | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<KdsStatusColors>;
    return {
      pending: normalizeHex(parsed.pending, fallback.pending),
      preparing: normalizeHex(parsed.preparing, fallback.preparing),
      ready: normalizeHex(parsed.ready, fallback.ready),
    };
  } catch {
    return null;
  }
}

export function hasSavedKdsStatusColors(
  branchId: string | number | null | undefined,
  stationId: string | number | null | undefined,
): boolean {
  if (typeof window === "undefined") return false;
  if (branchId == null || stationId == null || stationId === "") return false;
  return !!window.localStorage.getItem(stationStorageKey(branchId, stationId));
}

/**
 * Carga colores de una estación. Si no hay guardados, usa la tríada del theme.
 * `themePrimary` = primary_color de la sucursal.
 */
export function loadKdsStatusColors(
  branchId: string | number | null | undefined,
  stationId?: string | number | null,
  themePrimary?: string | null,
): KdsStatusColors {
  const themeDefaults = defaultKdsStatusColorsFromTheme(themePrimary);

  if (typeof window === "undefined") return themeDefaults;
  if (branchId == null || branchId === "") return themeDefaults;

  if (stationId != null && stationId !== "") {
    const byStation = parseColors(
      window.localStorage.getItem(stationStorageKey(branchId, stationId)),
      themeDefaults,
    );
    if (byStation) return byStation;
  }

  // Legacy sucursal (migración) — solo si no hay por estación.
  const byBranch = parseColors(
    window.localStorage.getItem(branchStorageKey(branchId)),
    themeDefaults,
  );
  if (byBranch) return byBranch;

  return themeDefaults;
}

export function saveKdsStatusColors(
  branchId: string | number,
  stationId: string | number,
  colors: KdsStatusColors,
  themePrimary?: string | null,
): void {
  if (typeof window === "undefined") return;
  const fallback = defaultKdsStatusColorsFromTheme(themePrimary);
  const next: KdsStatusColors = {
    pending: normalizeHex(colors.pending, fallback.pending),
    preparing: normalizeHex(colors.preparing, fallback.preparing),
    ready: normalizeHex(colors.ready, fallback.ready),
  };
  window.localStorage.setItem(
    stationStorageKey(branchId, stationId),
    JSON.stringify(next),
  );
  applyKdsStatusColorVars(next);
  window.dispatchEvent(
    new CustomEvent("frig:kds-status-colors", {
      detail: {
        branchId: String(branchId),
        stationId: String(stationId),
        colors: next,
      },
    }),
  );
}

export function kdsReadableForeground(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "#ffffff";
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#111827" : "#ffffff";
}

export function kdsHexAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function applyKdsStatusColorVars(colors: KdsStatusColors): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  (["pending", "preparing", "ready"] as const).forEach((key) => {
    const hex = colors[key];
    root.style.setProperty(`--kds-${key}`, hex);
    root.style.setProperty(`--kds-${key}-fg`, kdsReadableForeground(hex));
    root.style.setProperty(`--kds-${key}-soft`, kdsHexAlpha(hex, 0.14));
    root.style.setProperty(`--kds-${key}-border`, kdsHexAlpha(hex, 0.45));
  });
}

export function statusKeyFromTicket(
  status: string | undefined,
): KdsStatusKey | null {
  if (status === "PENDING") return "pending";
  if (status === "PREPARING") return "preparing";
  if (status === "READY") return "ready";
  return null;
}
