import { apiFetch } from "./client";

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

export async function fetchPublicMenuBySlug(slug: string): Promise<PublicMenuResponse> {
  return apiFetch<PublicMenuResponse>(`/public-catalog/public/${slug}/`, {
    auth: "none",
    branch: "none",
  });
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

export function publicMenuUrl(slug: string): string {
  return `/menu/${slug}`;
}
