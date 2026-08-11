import { apiFetch } from "./client";
import type { LoginCompleteResponse, LoginPayload } from "@/lib/types";

/** POST /api/accounts/users/login_complete/ — devuelve token + user + branches. */
export async function loginComplete(payload: LoginPayload): Promise<LoginCompleteResponse> {
  return apiFetch<LoginCompleteResponse>("/accounts/users/login_complete/", {
    method: "POST",
    body: payload,
    auth: "none",
  });
}

/** POST /api/accounts/users/logout/ — invalida token y cookie. */
export async function logout(): Promise<void> {
  await apiFetch("/accounts/users/logout/", {
    method: "POST",
    auth: "required",
    branch: "none",
  });
}