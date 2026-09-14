import { API_BASE, ApiError } from "./client";
import { apiFetch } from "./client";
import { getBranchId, getToken } from "./session-storage";
import type {
  Branch,
  BranchPayload,
  BranchThemeConfig,
  BranchThemeConfigInline,
  BranchUser,
  ID,
  RoleDefinition,
} from "@/lib/types";

export interface BranchesFilter {
  search?: string;
  is_active?: boolean;
  next?: string | null;
  previous?: string | null;
}

/** GET /api/branches/ — lista sucursales a las que el usuario tiene acceso. */
function normalizeBranchId(branch: Branch): Branch {
  const realId = branch.branch_id ?? branch.id;
  return { ...branch, branch_id: realId } as Branch;
}

export async function fetchBranches(filter: BranchesFilter = {}): Promise<{
  results: Branch[];
  count: number;
  next?: string | null;
  previous?: string | null;
}> {
  if (filter.next) {
    const data = await apiFetch<{ results?: Branch[]; count?: number; next?: string | null; previous?: string | null } | Branch[]>(
      filter.next,
      { branch: "none" },
    );
    if (Array.isArray(data)) return { results: data.map(normalizeBranchId), count: data.length };
    return { results: (data.results ?? []).map(normalizeBranchId), count: data.count ?? 0, next: data.next, previous: data.previous };
  }
  if (filter.previous) {
    const data = await apiFetch<{ results?: Branch[]; count?: number; next?: string | null; previous?: string | null } | Branch[]>(
      filter.previous,
      { branch: "none" },
    );
    if (Array.isArray(data)) return { results: data.map(normalizeBranchId), count: data.length };
    return { results: (data.results ?? []).map(normalizeBranchId), count: data.count ?? 0, next: data.next, previous: data.previous };
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.is_active !== undefined) qs.set("is_active", String(filter.is_active));
  const query = qs.toString();
  const data = await apiFetch<{ results?: Branch[]; count?: number; next?: string | null; previous?: string | null } | Branch[]>(
    `/branches/${query ? `?${query}` : ""}`,
  );
  if (Array.isArray(data)) return { results: data.map(normalizeBranchId), count: data.length };
  return { results: (data.results ?? []).map(normalizeBranchId), count: data.count ?? 0, next: data.next, previous: data.previous };
}

/** GET /api/branches/{id}/ — detalle de una sucursal. */
export async function fetchBranch(id: ID): Promise<Branch> {
  const branch = await apiFetch<Branch>(`/branches/${id}/`);
  return normalizeBranchId(branch);
}

/** POST /api/branches/ — crear sucursal. */
export async function createBranch(payload: BranchPayload): Promise<Branch> {
  const branch = await apiFetch<Branch>("/branches/", {
    method: "POST",
    body: payload,
  });
  return normalizeBranchId(branch);
}

/** PATCH /api/branches/{id}/ — editar sucursal. */
export async function updateBranch(id: ID, payload: Partial<BranchPayload>): Promise<Branch> {
  const branch = await apiFetch<Branch>(`/branches/${id}/`, {
    method: "PATCH",
    body: payload,
  });
  return normalizeBranchId(branch);
}

/** GET /api/branches/{id}/users/ — usuarios de la sucursal. */
export async function fetchBranchUsers(id: ID): Promise<BranchUser[]> {
  const data = await apiFetch<{ results?: BranchUser[] } | BranchUser[]>(
    `/branches/${id}/users/`,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

/** POST /api/branches/{id}/invite-user/ — invitar usuario por email. */
export async function inviteBranchUser(
  id: ID,
  email: string,
  roleDefinition: ID,
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/branches/${id}/invite-user/`, {
    method: "POST",
    body: { email, role_definition: roleDefinition },
  });
}

/** GET /api/branches/{id}/roles/ — definiciones de rol de la sucursal. */
export async function fetchBranchRoles(branchId: ID): Promise<RoleDefinition[]> {
  const data = await apiFetch<{ results?: RoleDefinition[] } | RoleDefinition[]>(
    `/branches/${branchId}/roles/`,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

/**
 * GET /api/branches/themes/ — tema de la sucursal.
 * El backend puede devolver un objeto paginado { results: [...] } o el tema
 * directamente. Se normaliza a un único BranchThemeConfig de la sucursal.
 *
 * Si se pasa `branchId` se filtra por esa sucursal; de lo contrario se usa
 * la sucursal activa desde localStorage.
 *
 * Fallback: si `/branches/themes/` no está implementado (404), intenta con
 * `/branches/{id}/theme-config/` para no dejar la marca sin tema.
 */
export async function fetchBranchTheme(branchId?: string): Promise<BranchThemeConfig | null> {
  const targetId = branchId ?? getBranchId();
  // Sin sucursal objetivo NO se devuelve el primer tema de la lista: para un
  // super admin (sin sucursal elegida) eso pintaba la app con colores ajenos.
  if (!targetId) return null;
  try {
    const data = await apiFetch<{ results?: BranchThemeConfig[] } | BranchThemeConfig>(
      "/branches/themes/",
      { auth: "auto" },
    );
    const themes = Array.isArray(data)
      ? data
      : ((data as { results?: BranchThemeConfig[] }).results ?? []);
    if (targetId) {
      return themes.find((t) => String(t.branch) === targetId) ?? themes[0] ?? null;
    }
    return themes[0] ?? null;
  } catch (err) {
    if (
      targetId &&
      err &&
      typeof err === "object" &&
      "status" in err &&
      (err.status === 404 || err.status === 410)
    ) {
      return fetchBranchThemeById(targetId);
    }
    return null;
  }
}

/**
 * GET /api/branches/{id}/theme-config/ — configuración de tema de una sucursal.
 * El endpoint devuelve un Branch con `theme_config` anidado; se extrae y se
 * normaliza a BranchThemeConfig.
 */
export async function fetchBranchThemeById(id: ID): Promise<BranchThemeConfig | null> {
  try {
    type BranchWithTheme = Branch & { theme_config?: BranchThemeConfigInline | null };
    const data = await apiFetch<BranchWithTheme | BranchThemeConfig>(
      `/branches/${id}/theme-config/`,
    );
    if (data && "theme_config" in data) {
      const cfg = (data as BranchWithTheme).theme_config;
      if (!cfg) return null;
      const inline = cfg as BranchThemeConfigInline;
      return {
        branch: id,
        app_name: inline.app_name,
        logo: inline.logo,
        favicon: inline.favicon,
        banner: inline.banner_image,
        primary_color: inline.primary_color,
        secondary_color: inline.secondary_color,
        algorithm: inline.algorithm,
      } as BranchThemeConfig;
    }
    return (data as BranchThemeConfig) ?? null;
  } catch {
    return null;
  }
}

/** GET /api/branches/public-login-theme/{slug}/ — login pre-auth por slug de sucursal. */
export async function fetchPublicLoginTheme(
  slug: string,
): Promise<BranchThemeConfig | null> {
  try {
    const data = await apiFetch<Record<string, unknown>>(
      `/branches/public-login-theme/${encodeURIComponent(slug)}/`,
      { auth: "none", branch: "none" },
    );
    return normalizePublicLoginTheme(data);
  } catch {
    return null;
  }
}

/**
 * GET /api/branches/public-login-theme/by-host/ — branding público del login
 * según el Host de la petición (el dominio de la sucursal gana sobre el de
 * la organización). Público: no requiere auth ni sucursal. Devuelve null si
 * el host no tiene branding (p. ej. localhost en desarrollo).
 */
export async function fetchPublicLoginThemeByHost(): Promise<BranchThemeConfig | null> {
  try {
    const data = await apiFetch<Record<string, unknown>>(
      "/branches/public-login-theme/by-host/",
      { auth: "none", branch: "none" },
    );
    return normalizePublicLoginTheme(data);
  } catch {
    return null;
  }
}

/** Mapea la respuesta pública (PublicLoginTheme) a BranchThemeConfig. */
function normalizePublicLoginTheme(data: Record<string, unknown> | null): BranchThemeConfig | null {
  if (!data || typeof data !== "object") return null;
  const hasBranding = data.app_name || data.logo_url || data.primary_color;
  if (!hasBranding) return null;
  return {
    app_name: typeof data.app_name === "string" ? data.app_name : undefined,
    tagline:
      typeof data.login_subtitle === "string" && data.login_subtitle
        ? data.login_subtitle
        : undefined,
    logo: typeof data.logo_url === "string" && data.logo_url ? data.logo_url : null,
    favicon:
      typeof data.favicon_url === "string" && data.favicon_url ? data.favicon_url : null,
    primary_color:
      typeof data.primary_color === "string" ? data.primary_color : undefined,
    secondary_color:
      typeof data.secondary_color === "string" ? data.secondary_color : undefined,
    algorithm:
      data.algorithm === "dark" || data.algorithm === "light" ? data.algorithm : undefined,
    login_welcome_message:
      typeof data.login_welcome_message === "string"
        ? data.login_welcome_message
        : undefined,
  };
}

/** Foreground oscuro del tema, usado como texto sobre colores de marca claros. */
const DARK_BRAND_FOREGROUND = "#1a1d18";

/**
 * Devuelve el color de texto legible sobre un HEX de marca según su
 * luminancia percibida (YIQ: 0.299R + 0.587G + 0.114B). Colores claros
 * reciben el foreground oscuro del tema; los oscuros, blanco.
 */
function readableForegroundFor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const luminance =
    0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff);
  return luminance > 150 ? DARK_BRAND_FOREGROUND : "#ffffff";
}

/**
 * Aplica el tema multi-tenant a `:root` inyectando CSS custom properties
 * de marca. Sin theme se usan los defaults de globals.css.
 *
 * Deriva todos los tokens del UI (background, card, muted, border, etc.)
 * desde primary + secondary para que el tema se propague en toda la app.
 */
export function applyThemeConfig(theme: BranchThemeConfig | null): void {
  const root = document.documentElement;
  const primary = theme?.primary_color ?? "#2f6b3c";
  const secondary = theme?.secondary_color ?? "#f2e8cf";

  // Colores base
  root.style.setProperty("--brand-primary", primary);
  root.style.setProperty("--brand-secondary", secondary);
  root.style.setProperty("--brand-radius", typeof theme?.borderRadius === "number" && theme.borderRadius > 0 ? `${theme.borderRadius}px` : "0.75rem");

  // Foreground derivado (texto legible sobre el color)
  const primaryForeground = readableForegroundFor(primary);
  const secondaryForeground = readableForegroundFor(secondary);
  root.style.setProperty("--primary-foreground", primaryForeground);
  root.style.setProperty("--secondary-foreground", secondaryForeground);
  root.style.setProperty("--color-primary-foreground", primaryForeground);
  root.style.setProperty("--color-secondary-foreground", secondaryForeground);

  // Derivar tokens del UI desde secondary (modo light)
  // --background: secondary muy diluido con blanco (superficie principal clara)
  root.style.setProperty("--background", mixColor(secondary, "#ffffff", 0.75));
  // --foreground: texto oscuro legible sobre background
  root.style.setProperty("--foreground", mixColor(primary, "#1a1a1a", 0.5));
  // --card: blanco puro para contraste con el background
  root.style.setProperty("--card", "#ffffff");
  root.style.setProperty("--card-foreground", mixColor(primary, "#1a1a1a", 0.5));
  // --muted: variante suave del secondary (para badges, fondos sutiles)
  root.style.setProperty("--muted", mixColor(secondary, "#ffffff", 0.7));
  root.style.setProperty("--muted-foreground", mixColor(primary, "#1a1a1a", 0.35));
  // --accent: mismo que muted
  root.style.setProperty("--accent", mixColor(secondary, "#ffffff", 0.7));
  root.style.setProperty("--accent-foreground", mixColor(primary, "#1a1a1a", 0.5));
  // --border / --input: bordes visibles pero sutiles
  root.style.setProperty("--border", mixColor(secondary, primary, 0.2));
  root.style.setProperty("--input", mixColor(secondary, primary, 0.15));
  // --surface: superficie secundaria
  root.style.setProperty("--brand-surface", mixColor(secondary, "#ffffff", 0.8));
  root.style.setProperty("--brand-foreground", mixColor(primary, "#1a1a1a", 0.5));

  // Dark mode toggle
  if (theme?.algorithm === "dark") {
    root.classList.add("dark");
    // Tokens dark derivados
    root.style.setProperty("--background", mixColor(primary, "#000000", 0.92));
    root.style.setProperty("--foreground", mixColor(secondary, "#ffffff", 0.85));
    root.style.setProperty("--card", mixColor(primary, "#000000", 0.88));
    root.style.setProperty("--card-foreground", mixColor(secondary, "#ffffff", 0.85));
    root.style.setProperty("--muted", mixColor(primary, "#000000", 0.78));
    root.style.setProperty("--muted-foreground", mixColor(secondary, "#ffffff", 0.55));
    root.style.setProperty("--accent", mixColor(primary, "#000000", 0.78));
    root.style.setProperty("--accent-foreground", mixColor(secondary, "#ffffff", 0.85));
    root.style.setProperty("--border", mixColor(primary, "#ffffff", 0.15));
    root.style.setProperty("--input", mixColor(primary, "#ffffff", 0.18));
  } else if (theme?.algorithm === "light") {
    root.classList.remove("dark");
  }
}

/**
 * Mezcla dos colores CSS con un ratio (0-1).
 * ratio=0 → color1 puro, ratio=1 → color2 puro.
 */
function mixColor(color1: string, color2: string, ratio: number): string {
  // Soporta hex (#rrggbb) y nombres básicos
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  if (!c1 || !c2) return color1; // fallback
  const r = Math.round(c1.r + (c2.r - c1.r) * ratio);
  const g = Math.round(c1.g + (c2.g - c1.g) * ratio);
  const b = Math.round(c1.b + (c2.b - c1.b) * ratio);
  return `hsl(${rgbToHsl(r, g, b).join(" ")})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

export type POSQuickActionType =
  | "pay_account"
  | "pay_order"
  | "collect";

/** PATCH /api/branches/{id}/ — configuración SII de la sucursal (multipart por
 *  el certificado digital). Campos vacíos se envían como vacíos para permitir
 *  limpiar la resolución. */
export interface BranchSiiConfigPayload {
  sii_enabled: boolean;
  sii_resolution_number?: string;
  sii_resolution_date?: string;
  digital_certificate?: File | null;
  certificate_password?: string;
}

export async function updateBranchSiiConfig(
  id: ID,
  payload: BranchSiiConfigPayload,
): Promise<void> {
  if (!id) throw new Error("ID de sucursal no válido para guardar la configuración SII");

  const formData = new FormData();
  formData.append("sii_enabled", String(payload.sii_enabled));
  formData.append("sii_resolution_number", payload.sii_resolution_number ?? "");
  formData.append("sii_resolution_date", payload.sii_resolution_date ?? "");
  if (payload.digital_certificate) {
    formData.append("digital_certificate", payload.digital_certificate);
  }
  if (payload.certificate_password) {
    formData.append("certificate_password", payload.certificate_password);
  }

  const token = getToken();
  const branchId = getBranchId();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Token ${token}`;
  if (branchId) headers["X-Branch-ID"] = branchId;

  const res = await fetch(`${API_BASE}/branches/${id}/`, {
    method: "PATCH",
    headers,
    body: formData,
    credentials: "include",
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // respuesta no JSON
    }
  }

  if (!res.ok) {
    let message = `Error ${res.status} al guardar la configuración SII`;
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail?: unknown }).detail;
      if (detail) message = String(detail);
    }
    throw new ApiError(res.status, message, data);
  }
}

export interface BranchThemeConfigPayload {
  app_name?: string;
  login_welcome_message?: string;
  tagline?: string;
  primary_color?: string;
  secondary_color?: string;
  algorithm?: "light" | "dark" | "auto";
  borderRadius?: number;
  motion?: boolean;
  compact?: boolean;
  font_size?: string;
  social_links?: Record<string, string>;
  website_url?: string;
  brand_description?: string;
  login_subtitle?: string;
  logo?: File | null | undefined;
  favicon?: File | null | undefined;
  banner_image?: File | null | undefined;
}

/**
 * PATCH /api/branches/{id}/theme-config/ — actualiza branding y theme de la sucursal.
 * Soporta subida de archivos (logo, favicon, banner) vía multipart/form-data.
 */
export async function updateBranchTheme(
  id: ID,
  payload: BranchThemeConfigPayload,
): Promise<BranchThemeConfig> {
  if (!id) throw new Error("ID de sucursal no válido para guardar el tema");
  const formData = new FormData();

  const append = (key: string, value: unknown) => {
    if (value === undefined || value === null) return;
    if (value instanceof File) {
      formData.append(key, value);
      return;
    }
    if (typeof value === "boolean" || typeof value === "number") {
      formData.append(key, String(value));
      return;
    }
    if (typeof value === "object") {
      formData.append(key, JSON.stringify(value));
      return;
    }
    formData.append(key, String(value));
  };

  for (const [key, value] of Object.entries(payload)) {
    append(key, value);
  }

  const token = getToken();
  const branchId = getBranchId();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Token ${token}`;
  if (branchId) headers["X-Branch-ID"] = branchId;

  const res = await fetch(`${API_BASE}/branches/${id}/theme-config/`, {
    method: "PATCH",
    headers,
    body: formData,
    credentials: "include",
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // respuesta no JSON
    }
  }

  if (!res.ok) {
    let message = `Error ${res.status} al guardar el tema`;
    if (data && typeof data === "object" && "detail" in data) {
      const detail = (data as { detail?: unknown }).detail;
      if (detail) message = String(detail);
    }
    throw new ApiError(res.status, message, data);
  }

  return data as BranchThemeConfig;
}