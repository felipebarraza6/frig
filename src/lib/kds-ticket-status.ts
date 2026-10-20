import type { KitchenTicket } from "@/lib/api/kitchen";

export type KitchenAdvanceAction = {
  label: string;
  next: KitchenTicket["status"];
  endpoint: "start" | "ready" | "deliver";
};

const ADVANCE: Record<string, KitchenAdvanceAction> = {
  PENDING: { label: "Preparar", next: "PREPARING", endpoint: "start" },
  PREPARING: { label: "Listo", next: "READY", endpoint: "ready" },
  READY: { label: "Entregar", next: "DELIVERED", endpoint: "deliver" },
};

const REVERT: Record<string, KitchenTicket["status"]> = {
  PREPARING: "PENDING",
  READY: "PREPARING",
  DELIVERED: "READY",
};

export function kitchenAdvanceAction(
  status: KitchenTicket["status"] | string | null | undefined,
): KitchenAdvanceAction | null {
  if (!status) return null;
  return ADVANCE[status] ?? null;
}

export function kitchenRevertStatus(
  status: KitchenTicket["status"] | string | null | undefined,
): KitchenTicket["status"] | null {
  if (!status) return null;
  return REVERT[status] ?? null;
}
