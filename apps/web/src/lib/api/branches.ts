import { API_BASE, ApiError } from "./client";
import { apiFetch } from "./client";
import { getBranchId, getToken } from "./session-storage";
import type {
  Branch,
  BranchPayload,
  BranchThemeConfig,
  BranchThemeConfigInline,
  ID,
  RoleDefinition,
  UserResponse,
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
export async function fetchBranchUsers(id: ID): Promise<UserResponse[]> {
  const data = await apiFetch<{ results?: UserResponse[] } | UserResponse[]>(
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
    return await apiFetch<BranchThemeConfig>(
      `/branches/public-login-theme/${slug}/`,
      { auth: "none", branch: "none" },
    );
  } catch {
    return null;
  }
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
 */
export function applyThemeConfig(theme: BranchThemeConfig | null): void {
  const root = document.documentElement;
  const primary = theme?.primary_color ?? "#2f6b3c";
  const secondary = theme?.secondary_color ?? "#f2e8cf";
  root.style.setProperty("--brand-primary", primary);
  root.style.setProperty("--brand-secondary", secondary);
  // Foreground derivado del color de marca para texto legible encima.
  // Se setea también el alias --color-* por si algún consumo usa el token
  // directo en vez del mapeo de @theme.
  const primaryForeground = readableForegroundFor(primary);
  const secondaryForeground = readableForegroundFor(secondary);
  root.style.setProperty("--primary-foreground", primaryForeground);
  root.style.setProperty("--secondary-foreground", secondaryForeground);
  root.style.setProperty("--color-primary-foreground", primaryForeground);
  root.style.setProperty("--color-secondary-foreground", secondaryForeground);
  root.style.setProperty(
    "--brand-radius",
    typeof theme?.borderRadius === "number" && theme.borderRadius > 0
      ? `${theme.borderRadius}px`
      : "0.75rem",
  );
  if (theme?.algorithm === "dark") {
    root.classList.add("dark");
  } else if (theme?.algorithm === "light") {
    root.classList.remove("dark");
  }
}

export type POSQuickActionType =
  | "pay_account"
  | "pay_order"
  | "collect"
  | "pay_purchase_order"
  | "pay_expense";

export interface POSQuickAction {
  id: string;
  type: POSQuickActionType;
  label: string;
  icon: string;
  color?: string;
  enabled: boolean;
}

export interface BranchPOSConfig {
  id: string | number;
  branch: number | string;
  show_price_in_selector: boolean;
  show_product_images: boolean;
  require_branch_selection: boolean;
  auto_select_product: boolean;
  default_measurement_unit: string;
  enable_quick_actions: boolean;
  quick_actions: POSQuickAction[];
}

export const DEFAULT_POS_QUICK_ACTIONS: POSQuickAction[] = [
  { id: "pay-account", type: "pay_account", label: "Cuentas pendientes", icon: "Receipt", color: "blue", enabled: true },
  { id: "pay-order", type: "pay_order", label: "Órdenes pendientes", icon: "ClipboardList", color: "amber", enabled: true },
  { id: "collect", type: "collect", label: "Cobrar", icon: "UserSearch", color: "emerald", enabled: true },
  { id: "pay-purchase-order", type: "pay_purchase_order", label: "Pagar orden de compra", icon: "Truck", color: "purple", enabled: true },
  { id: "pay-expense", type: "pay_expense", label: "Pagar gasto", icon: "TrendingDown", color: "rose", enabled: true },
];

export async function fetchBranchPOSConfig(): Promise<BranchPOSConfig | null> {
  const data = await apiFetch<{ results?: BranchPOSConfig[] } | BranchPOSConfig>("/branches/pos-config/");
  const results = Array.isArray(data) ? data : ((data as { results?: BranchPOSConfig[] }).results ?? []);
  const cfg = results[0] ?? (data as BranchPOSConfig);
  if (!cfg || typeof cfg !== "object") return null;
  return {
    ...cfg,
    quick_actions: cfg.quick_actions?.length ? cfg.quick_actions : DEFAULT_POS_QUICK_ACTIONS,
  } as BranchPOSConfig;
}

export async function updateBranchPOSConfig(
  id: ID,
  payload: Partial<BranchPOSConfig>,
): Promise<BranchPOSConfig> {
  return apiFetch<BranchPOSConfig>(`/branches/pos-config/${id}/`, {
    method: "PATCH",
    body: payload,
  });
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