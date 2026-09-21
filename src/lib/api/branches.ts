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
  /**
   * El listado del backend oculta las inactivas por defecto
   * (UniversalFilterMixin); con show_inactive=true las incluye.
   */
  show_inactive?: boolean;
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
  if (filter.show_inactive) qs.set("show_inactive", "true");
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

/* ─── Gestión de usuarios de la sucursal ────────────────────────────────── */

/** GET /api/branches/{id}/available-users/ — usuarios que pueden asignarse. */
export async function fetchBranchAvailableUsers(branchId: ID): Promise<BranchUser[]> {
  const data = await apiFetch<{ results?: BranchUser[] } | BranchUser[]>(
    `/branches/${branchId}/available-users/`,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

/** POST /api/branches/{id}/users/assign/ — asigna un usuario existente (super admin). */
export async function assignBranchUser(
  branchId: ID,
  userId: ID,
  roleDefinition: ID,
): Promise<BranchUser> {
  return apiFetch<BranchUser>(`/branches/${branchId}/users/assign/`, {
    method: "POST",
    body: { user_id: userId, role_definition: roleDefinition },
  });
}

/** POST/DELETE /api/branches/{id}/remove-user/ — remueve un usuario (user_id). */
export async function removeBranchUser(branchId: ID, userId: ID): Promise<unknown> {
  return apiFetch<unknown>(`/branches/${branchId}/remove-user/`, {
    method: "POST",
    body: { user_id: userId },
  });
}

/** PUT /api/branches/{id}/toggle_user_status/ — activa/desactiva el acceso. */
export async function toggleBranchUserStatus(
  branchId: ID,
  userId: ID,
  isActive: boolean,
): Promise<unknown> {
  return apiFetch<unknown>(`/branches/${branchId}/toggle_user_status/`, {
    method: "PUT",
    body: { user_id: userId, is_active: isActive },
  });
}

/** PUT /api/branches/{id}/update-user-role/ — cambia el rol de un usuario. */
export async function updateBranchUserRole(
  branchId: ID,
  userId: ID,
  roleDefinition: ID,
): Promise<unknown> {
  return apiFetch<unknown>(`/branches/${branchId}/update-user-role/`, {
    method: "PUT",
    body: { user_id: userId, role_definition: roleDefinition },
  });
}

/** POST /api/branches/{id}/transfer-ownership/ — transfiere la propiedad. */
export async function transferBranchOwnership(
  branchId: ID,
  userId: ID,
): Promise<unknown> {
  return apiFetch<unknown>(`/branches/${branchId}/transfer-ownership/`, {
    method: "POST",
    body: { user_id: userId },
  });
}

/** POST /api/branches/{id}/leave-branch/ — el usuario autenticado deja la sucursal. */
export async function leaveBranch(branchId: ID): Promise<unknown> {
  return apiFetch<unknown>(`/branches/${branchId}/leave-branch/`, {
    method: "POST",
  });
}

/** GET /api/branches/{id}/enabled-roles/ — roles habilitados con módulos por rol. */
export async function fetchBranchEnabledRoles(branchId: ID): Promise<RoleDefinition[]> {
  const data = await apiFetch<{ results?: RoleDefinition[] } | RoleDefinition[]>(
    `/branches/${branchId}/enabled-roles/`,
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
 *
 * Cache de módulo (promise compartida + TTL 5 min): login, forgot y reset
 * resuelven el mismo by-host en segundos; sin cache serían 3+ requests
 * idénticos por navegación.
 */
let byHostCache: { promise: Promise<BranchThemeConfig | null>; at: number } | null = null;
const BY_HOST_TTL = 5 * 60 * 1000;

export function fetchPublicLoginThemeByHost(): Promise<BranchThemeConfig | null> {
  if (byHostCache && Date.now() - byHostCache.at < BY_HOST_TTL) {
    return byHostCache.promise;
  }
  const promise = (async () => {
    try {
      const data = await apiFetch<Record<string, unknown>>(
        "/branches/public-login-theme/by-host/",
        { auth: "none", branch: "none" },
      );
      return normalizePublicLoginTheme(data);
    } catch {
      return null;
    }
  })();
  byHostCache = { promise, at: Date.now() };
  return promise;
}

/** Mapea la respuesta pública (PublicLoginTheme) a BranchThemeConfig.
 *  Acepta los alias que envía el backend (color_mode, welcome_message,
 *  subtitle) y el bloque ui_preferences (radio, motion). */
function normalizePublicLoginTheme(data: Record<string, unknown> | null): BranchThemeConfig | null {
  if (!data || typeof data !== "object") return null;
  const hasBranding = data.app_name || data.logo_url || data.primary_color;
  if (!hasBranding) return null;
  const algorithmRaw = data.algorithm ?? data.color_mode;
  const ui = (data.ui_preferences && typeof data.ui_preferences === "object"
    ? data.ui_preferences
    : {}) as Record<string, unknown>;
  return {
    app_name: typeof data.app_name === "string" ? data.app_name : undefined,
    tagline:
      typeof data.login_subtitle === "string" && data.login_subtitle
        ? data.login_subtitle
        : typeof data.subtitle === "string" && data.subtitle
          ? data.subtitle
          : typeof data.tagline === "string" && data.tagline
            ? data.tagline
            : undefined,
    logo: typeof data.logo_url === "string" && data.logo_url ? data.logo_url : null,
    favicon:
      typeof data.favicon_url === "string" && data.favicon_url ? data.favicon_url : null,
    primary_color:
      typeof data.primary_color === "string" ? data.primary_color : undefined,
    secondary_color:
      typeof data.secondary_color === "string" ? data.secondary_color : undefined,
    algorithm:
      algorithmRaw === "dark" || algorithmRaw === "light" ? algorithmRaw : undefined,
    login_welcome_message:
      typeof data.login_welcome_message === "string" && data.login_welcome_message
        ? data.login_welcome_message
        : typeof data.welcome_message === "string" && data.welcome_message
          ? data.welcome_message
          : undefined,
    borderRadius:
      typeof ui.border_radius_px === "number" && ui.border_radius_px > 0
        ? ui.border_radius_px
        : undefined,
    motion: typeof ui.motion_enabled === "boolean" ? ui.motion_enabled : undefined,
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
  const primary = theme?.primary_color ?? "#c67d52";
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

  /*
   * Derivar la paleta del UI desde el TONO del primary (no mezclas fijas
   * con verdes/heredados): lo que el usuario elige en el swatch es
   * exactamente el color de botones/focos, y el resto de la paleta
   * (fondos, bordes, muted) comparte su tono con saturación y luz
   * controladas. Fidelidad ("lo que ofrezco es lo que se implementa")
   * + contraste garantizado por lightness fija por token.
   */
  const rgb = hexToRgb(primary) ?? { r: 198, g: 125, b: 82 };
  const [h, sRaw] = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const hue = `${h} ${Math.min(28, Math.max(6, Math.round(sRaw * 0.4)))}%`;
  const tint = (l: number) => `hsl(${hue} ${l}%)`;

  const isDark = theme?.algorithm === "dark";

  if (isDark) {
    root.classList.add("dark");
    // primary demasiado oscuro sobre fondo oscuro: aclarar para textos/íconos
    const [, , pl] = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const displayPrimary = pl < 48 ? tint(58) : primary;
    root.style.setProperty("--color-primary", displayPrimary);

    root.style.setProperty("--background", tint(7));
    root.style.setProperty("--foreground", tint(92));
    root.style.setProperty("--card", tint(10));
    root.style.setProperty("--card-foreground", tint(92));
    root.style.setProperty("--muted", tint(16));
    root.style.setProperty("--muted-foreground", tint(64));
    root.style.setProperty("--accent", tint(18));
    root.style.setProperty("--accent-foreground", tint(90));
    root.style.setProperty("--border", tint(20));
    root.style.setProperty("--input", tint(22));
    root.style.setProperty("--brand-surface", tint(12));
    root.style.setProperty("--brand-foreground", tint(90));
  } else {
    root.classList.remove("dark");
    root.style.setProperty("--color-primary", primary);
    root.style.setProperty("--background", tint(97));
    root.style.setProperty("--foreground", tint(13));
    root.style.setProperty("--card", "#ffffff");
    root.style.setProperty("--card-foreground", tint(13));
    root.style.setProperty("--muted", tint(94));
    root.style.setProperty("--muted-foreground", tint(34));
    root.style.setProperty("--accent", tint(92));
    root.style.setProperty("--accent-foreground", tint(16));
    root.style.setProperty("--border", tint(87));
    root.style.setProperty("--input", tint(84));
    root.style.setProperty("--brand-surface", tint(95));
    root.style.setProperty("--brand-foreground", tint(13));
  }

  // Secondary: tal cual el usuario lo eligió (superficie/borde secundario).
  root.style.setProperty("--color-secondary", secondary);

  // Avisar a los canvas decorativos (matriz de datos del login/landing)
  // para re-teñir su paleta con la marca recién aplicada.
  window.dispatchEvent(new CustomEvent("frig:theme-changed"));
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