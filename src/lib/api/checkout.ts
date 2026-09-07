import { apiFetch } from "./client";

export interface CheckoutRequest {
  plan_id: string;
  business_name: string;
  contact_name: string;
  email: string;
  website?: string;
}

export interface CheckoutResponse {
  checkout_id: string;
  payment_url: string;
  status: string;
}

export interface CheckoutStatus {
  status: string;
  payment_url?: string;
}

export function checkoutPath(group = "frig"): string {
  return `/public/${group}-checkout/`;
}

export function fetchCheckout(p: CheckoutRequest, group = "frig", signal?: AbortSignal) {
  return apiFetch<CheckoutResponse>(checkoutPath(group), {
    method: "POST",
    body: p,
    auth: "none",
    branch: "none",
    signal,
  });
}

export function fetchCheckoutStatus(id: string, group = "frig") {
  return apiFetch<CheckoutStatus>(`${checkoutPath(group)}${id}/`, {
    auth: "none",
    branch: "none",
  });
}
