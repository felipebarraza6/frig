import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type BillingStatus = YggdraSchemas["BranchSubscription"];

/**
 * GET /api/plan-checkout/billing-status/
 * Suscripción ACTIVE de la sucursal (header X-Branch-ID) para trial banner.
 */
export async function fetchBillingStatus(): Promise<BillingStatus | null> {
  try {
    return await apiFetch<BillingStatus>("/plan-checkout/billing-status/", {
      method: "GET",
    });
  } catch {
    return null;
  }
}
