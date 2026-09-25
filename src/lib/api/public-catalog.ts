import { apiFetch, API_BASE, API_ORIGIN } from "./client";

export type MenuMode = "VITRINA" | "ORDENAR" | "PAGAR";
export type StationType = "POS" | "PANTALLA" | "QR" | "GENERAL";
export type TargetAudience = "PUBLIC" | "CUSTOMER" | "MEMBER";
export type OrderType = "SALE" | "ORDER" | "AGREEMENT";
export type FontFamily = "system" | "serif" | "sans" | "rounded";

export interface PublicCatalogSummary {
  id: number;
  title: string;
  slug: string;
  is_active: boolean;
  is_default: boolean;
  mode: MenuMode;
  mode_display: string;
  station_type: StationType;
  station_type_display: string;
  station: number | null;
  target_audience: TargetAudience;
  order_type: OrderType;
  product_count: number;
  category_count: number;
  branch: number;
  branch_name: string;
  created: string;
  modified: string;
}

export interface PublicCatalogProductDetail {
  id: number;
  name: string;
  price: string | number;
}

export interface PublicCatalogCategoryDetail {
  id: number;
  name: string;
}

export interface PublicCatalog {
  id: number;
  title: string;
  description?: string | null;
  theme_color?: string;
  secondary_color?: string;
  show_prices?: boolean;
  show_descriptions?: boolean;
  show_categories?: boolean;
  is_active?: boolean;
  is_default?: boolean;
  slug: string;
  mode?: MenuMode;
  mode_display?: string;
  station_type?: StationType;
  station_type_display?: string;
  station?: number | null;
  target_audience?: TargetAudience;
  target_audience_display?: string;
  order_type?: OrderType;
  order_type_display?: string;
  products: number[];
  product_details?: PublicCatalogProductDetail[];
  product_count?: number;
  categories: number[];
  category_details?: PublicCatalogCategoryDetail[];
  category_count?: number;
  logo?: string | null;
  banner_image?: string | null;
  font_family?: FontFamily;
  font_family_display?: string;
  expires_at?: string | null;
  branch: number;
  branch_name?: string;
  created?: string;
  modified?: string;
}

export interface PublicCatalogPayload {
  title: string;
  description?: string | null;
  theme_color?: string;
  secondary_color?: string;
  show_prices?: boolean;
  show_descriptions?: boolean;
  show_categories?: boolean;
  is_active?: boolean;
  is_default?: boolean;
  slug: string;
  mode?: MenuMode;
  station_type?: StationType;
  station?: number | null;
  target_audience?: TargetAudience;
  order_type?: OrderType;
  products?: number[];
  categories?: number[];
  font_family?: FontFamily;
  expires_at?: string | null;
  branch?: number;
}

export interface PaginatedPublicCatalog {
  count: number;
  next: string | null;
  previous: string | null;
  results: PublicCatalogSummary[];
}

export interface PublicMenuCategory {
  id: number;
  name: string;
}

export interface PublicMenuProduct {
  id: number;
  name: string;
  description?: string | null;
  price?: string;
  sale_price?: string;
  category?: PublicMenuCategory | null;
  primary_image?: string | null;
  is_featured?: boolean;
  measurement_unit?: string | null;
  /** Campos nutricionales (por 100 g). Requieren soporte en el backend. */
  energy_kcal?: string | null;
  proteins_g?: string | null;
  total_fats_g?: string | null;
  saturated_fats_g?: string | null;
  carbohydrates_g?: string | null;
  total_sugars_g?: string | null;
  sodium_mg?: string | null;
  is_nutritional_ingredient?: boolean;
  /** Si el back lo expone en el catálogo público. */
  ingredients?: Array<string | { name?: string; ingredient_name?: string }>;
  /** Nombres listos para UI (chips). Enriquecido desde receta si hace falta. */
  ingredient_names?: string[];
  /** @deprecated preferir ingredient_names */
  ingredient_line?: string | null;
}

export interface PublicMenuResponse {
  catalog: PublicCatalog;
  products: PublicMenuProduct[];
}

export type { CashRegisterStation } from "./cash-register-stations";

export async function fetchPublicCatalogs(
  search?: string,
): Promise<PaginatedPublicCatalog> {
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  const q = qs.toString();
  return apiFetch<PaginatedPublicCatalog>(`/public-catalog/catalogs/${q ? `?${q}` : ""}`);
}

export async function fetchPublicCatalog(id: number): Promise<PublicCatalog> {
  return apiFetch<PublicCatalog>(`/public-catalog/catalogs/${id}/`);
}

export async function createPublicCatalog(
  payload: PublicCatalogPayload,
): Promise<PublicCatalog> {
  return apiFetch<PublicCatalog>("/public-catalog/catalogs/", {
    method: "POST",
    body: payload,
  });
}

export async function updatePublicCatalog(
  id: number,
  payload: Partial<PublicCatalogPayload>,
): Promise<PublicCatalog> {
  return apiFetch<PublicCatalog>(`/public-catalog/catalogs/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deletePublicCatalog(id: number): Promise<void> {
  await apiFetch(`/public-catalog/catalogs/${id}/`, { method: "DELETE" });
}

const WA_MARKER_RE = /<!--\s*frig:whatsapp:([+\d\s\-]+)\s*-->/i;

/** Extrae WhatsApp embebido en la descripción (sin campo dedicado en el API). */
export function extractWhatsappFromDescription(
  description?: string | null,
): string | null {
  if (!description) return null;
  const m = description.match(WA_MARKER_RE);
  return m?.[1]?.replace(/\s+/g, "") || null;
}

export function stripWhatsappMarker(description?: string | null): string {
  if (!description) return "";
  return description.replace(WA_MARKER_RE, "").trim();
}

/** Guarda el WhatsApp de pedidos en un marcador oculto de la descripción. */
export function embedWhatsappInDescription(
  description: string | null | undefined,
  phone: string | null | undefined,
): string | null {
  const base = stripWhatsappMarker(description);
  const cleaned = (phone ?? "").replace(/[^\d+]/g, "").trim();
  if (!cleaned) return base || null;
  const marker = `<!--frig:whatsapp:${cleaned}-->`;
  return base ? `${base}\n${marker}` : marker;
}

export type PublicCatalogPayPayload = {
  product_id: number;
  quantity: number;
  email: string;
  name?: string;
  phone?: string;
};

export type PublicCatalogPayResult = {
  payment_url?: string;
  url?: string;
  redirect_url?: string;
  detail?: string;
  message?: string;
  [key: string]: unknown;
};

/** POST /public-catalog/public/<slug>/pay/ — inicia pago Flow (1 producto). */
export async function payPublicCatalogProduct(
  slug: string,
  payload: PublicCatalogPayPayload,
): Promise<PublicCatalogPayResult> {
  return apiFetch<PublicCatalogPayResult>(
    `/public-catalog/public/${encodeURIComponent(slug)}/pay/`,
    {
      method: "POST",
      auth: "none",
      branch: "none",
      credentials: "omit",
      body: payload,
    },
  );
}

/**
 * Copia el logo de la sucursal al catálogo (multipart).
 * Así el menú público QR muestra logo sin sesión admin.
 */
export async function syncCatalogLogoFromUrl(
  catalogId: number,
  logoUrl: string,
): Promise<PublicCatalog | null> {
  const absolute = /^https?:\/\//i.test(logoUrl)
    ? logoUrl
    : `${API_ORIGIN}${logoUrl.startsWith("/") ? "" : "/"}${logoUrl}`;
  const imgRes = await fetch(absolute, { credentials: "omit" });
  if (!imgRes.ok) return null;
  const blob = await imgRes.blob();
  const ext =
    blob.type.includes("png")
      ? "png"
      : blob.type.includes("webp")
        ? "webp"
        : "jpg";
  const formData = new FormData();
  formData.append("logo", blob, `branch-logo.${ext}`);

  const token = typeof window !== "undefined" ? window.localStorage.getItem("frig.token") : null;
  const branchId =
    typeof window !== "undefined" ? window.localStorage.getItem("frig.branch_id") : null;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Token ${token}`;
  if (branchId) headers["X-Branch-ID"] = branchId;

  const res = await fetch(`${API_BASE}/public-catalog/catalogs/${catalogId}/`, {
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
      /* ignore */
    }
  }
  if (!res.ok) return null;
  return data as PublicCatalog;
}

export async function fetchPublicMenuBySlug(slug: string): Promise<PublicMenuResponse> {
  const raw = await apiFetch<PublicMenuResponse & {
    product_details?: PublicCatalogProductDetail[];
  }>(`/public-catalog/public/${encodeURIComponent(slug)}/`, {
    auth: "none",
    branch: "none",
    // Evita que la cookie de sesión admin altere el catálogo público.
    credentials: "omit",
  });

  const catalog = raw.catalog;
  let products = Array.isArray(raw.products) ? raw.products : [];

  // Si el back no mandó el listado enriquecido, armar uno mínimo desde product_details.
  if (products.length === 0) {
    const details =
      raw.product_details ??
      catalog?.product_details ??
      [];
    products = details.map((p) => ({
      id: p.id,
      name: p.name,
      price: String(p.price),
      sale_price: String(p.price),
      category: null,
      description: null,
      primary_image: null,
    }));
  }

  return { catalog, products };
}

export { fetchCashRegisterStations } from "./cash-register-stations";

export interface QRCodeGenerateRequest {
  catalog?: number | null;
  size?: number;
  include_price?: boolean;
}

export interface QRCode {
  id: number;
  catalog?: number | null;
  catalog_title?: string | null;
  code: string;
  is_active: boolean;
  scan_count: number;
  metadata?: Record<string, unknown>;
}

export async function generateQRForCatalog(
  catalogId: number,
  size = 400,
): Promise<QRCode> {
  return apiFetch<QRCode>("/public-catalog/qr-codes/generate/", {
    method: "POST",
    body: { catalog: catalogId, size, include_price: false },
  });
}

/**
 * Path del menú público (`/menu/<slug>`).
 * En local, `next.config` no usa `output: "export"` → la ruta dinámica funciona.
 * En build/prod + Apache, `.htaccess` reescribe a `/menu/__.html` y el cliente
 * resuelve el slug desde el pathname (`usePublicMenuSlug`).
 * Fallback estático: `/menu/view?slug=` y `/menu/totem?slug=`.
 */
export function publicMenuUrl(slug: string): string {
  return `/menu/${encodeURIComponent(slug)}`;
}

/** URL absoluta del menú público (abrir siempre en navegador real). */
export function publicMenuAbsoluteUrl(slug: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${publicMenuUrl(slug)}`;
}

export function publicTotemUrl(slug: string): string {
  return `/menu/${encodeURIComponent(slug)}/totem`;
}

export function publicTotemAbsoluteUrl(slug: string, origin?: string): string {
  const base =
    origin ??
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${publicTotemUrl(slug)}`;
}

export function modeLabel(mode: MenuMode | string | undefined): string {
  switch (mode) {
    case "VITRINA":
      return "Vitrina";
    case "ORDENAR":
      return "Ordenar";
    case "PAGAR":
      return "Ordenar y pagar";
    default:
      return mode || "—";
  }
}

export function stationTypeLabel(type: StationType | string | undefined): string {
  switch (type) {
    case "QR":
      return "Menú QR";
    case "POS":
      return "Punto de venta";
    case "PANTALLA":
      return "Pantalla";
    case "GENERAL":
      return "General";
    default:
      return type || "—";
  }
}
