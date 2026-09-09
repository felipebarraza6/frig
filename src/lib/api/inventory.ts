import { apiFetch, apiFile } from "./client";
import type { ApiFileResult } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

type InventoryHistory = YggdraSchemas["InventoryHistory"];
type InventoryHistoryRequest = YggdraSchemas["InventoryHistoryRequest"];
type ProductInventorySummary = YggdraSchemas["ProductInventorySummary"];
type PaginatedInventoryHistory = YggdraSchemas["PaginatedInventoryHistoryList"];

export interface MovementsFilter {
  search?: string;
  movement_type?: string;
  product?: number;
  warehouse?: number;
  next?: string | null;
  previous?: string | null;
}

export async function fetchInventoryMovements(filter: MovementsFilter = {}): Promise<PaginatedInventoryHistory> {
  if (filter.next) {
    return apiFetch<PaginatedInventoryHistory>(filter.next);
  }
  if (filter.previous) {
    return apiFetch<PaginatedInventoryHistory>(filter.previous);
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.movement_type) qs.set("movement_type", filter.movement_type);
  if (filter.product) qs.set("product", String(filter.product));
  if (filter.warehouse) qs.set("warehouse", String(filter.warehouse));
  const q = qs.toString();
  return apiFetch<PaginatedInventoryHistory>(`/inventory/inventory-history/${q ? `?${q}` : ""}`);
}

export async function fetchAllInventoryMovements(filter: MovementsFilter = {}): Promise<InventoryHistory[]> {
  const all: InventoryHistory[] = [];
  let nextUrl: string | null = null;
  const buildQs = () => {
    const qs = new URLSearchParams();
    if (filter.search) qs.set("search", filter.search);
    if (filter.movement_type) qs.set("movement_type", filter.movement_type);
    if (filter.product) qs.set("product", String(filter.product));
    if (filter.warehouse) qs.set("warehouse", String(filter.warehouse));
    return qs.toString();
  };
  const firstQs = buildQs();
  let data = await apiFetch<PaginatedInventoryHistory>(`/inventory/inventory-history/${firstQs ? `?${firstQs}` : ""}`);
  all.push(...(data.results ?? []));
  nextUrl = data.next ?? null;
  while (nextUrl) {
    data = await apiFetch<PaginatedInventoryHistory>(nextUrl);
    all.push(...(data.results ?? []));
    nextUrl = data.next ?? null;
  }
  return all;
}

/**
 * Tipos de movimiento cuyo impacto real en el backend create_movement/ es
 * "fijar el stock absoluto" (cualquier cantidad escrita sobrescribe el stock),
 * en vez de restar. Comportamiento verificado contra la API el 2026-09-09:
 * LOSS/DAMAGE/EXPIRY/ADJUSTMENT hacen `stock = quantity`; IN/OUT/RETURN hacen
 * `stock += quantity` (con signo, así que OUT solo resta en negativo).
 *
 * Como no podemos corregir el backend desde este frontend, toda salida se
 * envía como OUT con cantidad negativa (la única vía que resta de verdad) y
 * el motivo original se conserva en notes para no perder el detalle.
 */
const SET_STOCK_TYPES = new Set(["LOSS", "DAMAGE", "EXPIRY"]);
const OUT_REASON_LABELS: Record<string, string> = {
  OUT: "Salida",
  LOSS: "Merma/pérdida",
  DAMAGE: "Daño",
  EXPIRY: "Vencimiento",
};

export async function createInventoryMovement(payload: InventoryHistoryRequest): Promise<InventoryHistory> {
  // El action create_movement/ del backend espera `product_id` (el serializer
  // InventoryHistoryRequest del esquema dice `product`, pero el action no lo acepta).
  const { product, movement_type, quantity, notes, ...rest } = payload;
  const isOut = movement_type === "OUT" || SET_STOCK_TYPES.has(movement_type);
  const reason = OUT_REASON_LABELS[movement_type] ?? "Salida";
  const body = isOut
    ? {
        ...rest,
        product_id: product,
        movement_type: "OUT",
        quantity: -Math.abs(Number(quantity)),
        notes: notes?.trim() ? `${reason}: ${notes.trim()}` : reason,
      }
    : { ...rest, product_id: product, movement_type, quantity, notes };
  return apiFetch<InventoryHistory>("/inventory/inventory-history/create_movement/", {
    method: "POST",
    body,
  });
}

function normalizeSummaryList(
  data: ProductInventorySummary[] | { results?: ProductInventorySummary[] },
): ProductInventorySummary[] {
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

export async function fetchLowStock(): Promise<ProductInventorySummary[]> {
  const data = await apiFetch<ProductInventorySummary[] | { results?: ProductInventorySummary[] }>(
    "/inventory/product-inventory/low_stock/",
  );
  return normalizeSummaryList(data);
}

export async function fetchOutOfStock(): Promise<ProductInventorySummary[]> {
  const data = await apiFetch<ProductInventorySummary[] | { results?: ProductInventorySummary[] }>(
    "/inventory/product-inventory/out_of_stock/",
  );
  return normalizeSummaryList(data);
}

/**
 * Stock actual de todos los productos con inventario (paginado, con búsqueda
 * por nombre/código). Contrato: ProductInventoryViewSet (read-only).
 */
export async function fetchProductInventory(filter: {
  search?: string;
  page?: number;
  page_size?: number;
} = {}): Promise<ProductInventorySummary[]> {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.page) qs.set("page", String(filter.page));
  if (filter.page_size) qs.set("page_size", String(filter.page_size));
  const data = await apiFetch<{ results?: ProductInventorySummary[] } | ProductInventorySummary[]>(
    `/inventory/product-inventory/${qs.toString() ? `?${qs}` : ""}`,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

export function exportInventoryMovements(filter: MovementsFilter, format: "excel" | "pdf"): Promise<ApiFileResult> {
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.movement_type) qs.set("movement_type", filter.movement_type);
  if (filter.product) qs.set("product", String(filter.product));
  if (filter.warehouse) qs.set("warehouse", String(filter.warehouse));
  const q = qs.toString();
  return apiFile(`/inventory/inventory-history/export-${format}/${q ? `?${q}` : ""}`);
}
