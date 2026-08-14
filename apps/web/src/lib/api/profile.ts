import { apiFetch } from "./client";

export interface UserProfile {
  first_name?: string;
  last_name?: string;
  email?: string;
  username?: string;
  dni?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ChangePasswordResponse {
  detail?: string;
  message?: string;
}

/** GET /api/accounts/users/my-profile/ — datos editables del usuario logueado. */
export async function fetchMyProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/accounts/users/my-profile/", {
    branch: "none",
  });
}

/** PATCH /api/accounts/users/my-profile/ — actualizar datos del usuario logueado. */
export async function updateMyProfile(payload: Partial<UserProfile>): Promise<UserProfile> {
  return apiFetch<UserProfile>("/accounts/users/my-profile/", {
    method: "PATCH",
    body: payload,
    branch: "none",
  });
}

/** POST /api/accounts/users/change_password/ — cambiar contraseña del usuario logueado. */
export async function changePassword(payload: ChangePasswordPayload): Promise<ChangePasswordResponse> {
  return apiFetch<ChangePasswordResponse>("/accounts/users/change_password/", {
    method: "POST",
    body: payload,
    branch: "none",
  });
}
