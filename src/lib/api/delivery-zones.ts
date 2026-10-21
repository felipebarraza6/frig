import { apiFetch } from "@/lib/api/client";

export function deliveryLineLabel(zoneName?: string | null): string {
  const name = (zoneName ?? "").trim();
  return name ? `Despacho (${name})` : "Despacho";
}

export type BranchDeliveryZone = {
  id: number;
  branch?: number;
  name: string;
  price: string | number;
  sort_order?: number;
  is_active?: boolean;
};

type ZoneList = { results?: BranchDeliveryZone[] } | BranchDeliveryZone[];

function unwrap(data: ZoneList): BranchDeliveryZone[] {
  return Array.isArray(data) ? data : (data.results ?? []);
}

/** GET /api/branches/delivery-zones/ */
export async function fetchDeliveryZones(opts?: {
  isActive?: boolean;
}): Promise<BranchDeliveryZone[]> {
  const query =
    opts?.isActive === true
      ? "?is_active=true"
      : opts?.isActive === false
        ? "?is_active=false"
        : "";
  const data = await apiFetch<ZoneList>(`/branches/delivery-zones/${query}`);
  return unwrap(data);
}

export async function createDeliveryZone(payload: {
  name: string;
  price: string | number;
  sort_order?: number;
  is_active?: boolean;
}): Promise<BranchDeliveryZone> {
  return apiFetch<BranchDeliveryZone>("/branches/delivery-zones/", {
    method: "POST",
    body: payload,
  });
}

export async function updateDeliveryZone(
  id: number,
  payload: Partial<Pick<BranchDeliveryZone, "name" | "price" | "sort_order" | "is_active">>,
): Promise<BranchDeliveryZone> {
  return apiFetch<BranchDeliveryZone>(`/branches/delivery-zones/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteDeliveryZone(id: number): Promise<void> {
  await apiFetch(`/branches/delivery-zones/${id}/`, { method: "DELETE" });
}
