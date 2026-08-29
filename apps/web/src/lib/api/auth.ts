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
export interface ForgotPasswordPayload {
  /** Email normalizado (minúsculas) del usuario. */
  email: string;
  /** Sucursal explícita (opcional) — útil cuando el email tiene varias asignaciones. */
  branch_id?: number | string;
  /** Slug del login de la sucursal/organización (multi-app: FRIG, Muninn, etc.). */
  login_slug?: string;
}

export interface ForgotPasswordResponse {
  message?: string;
  error?: string;
}

/**
 * POST /api/accounts/users/forgot_password/ — solicita el correo de recuperación.
 *
 * Endpoint público (sin token). El backend devuelve una respuesta genérica
 * incluso si el email no existe (anti-enumeración) y resuelve el branding
 * (dominio, logo y remitente) a partir de la sucursal del usuario.
 */
export async function forgotPassword(payload: ForgotPasswordPayload): Promise<ForgotPasswordResponse> {
  return apiFetch<ForgotPasswordResponse>("/accounts/users/forgot_password/", {
    method: "POST",
    body: payload,
    auth: "none",
    branch: "none",
  });
}

export interface ResetPasswordConfirmPayload {
  token: string;
  new_password: string;
  /** El backend exige confirmación de la nueva contraseña. */
  confirm_password: string;
  /** Sucursal explícita (opcional) — contexto multi-branch. */
  branch_id?: number | string;
}

export interface ResetPasswordConfirmResponse {
  message?: string;
  error?: string;
  /** Errores de validación del serializer (campo → lista de mensajes). */
  [key: string]: unknown;
}

/**
 * POST /api/accounts/users/reset_password_confirm/ — confirma el reset con el token.
 *
 * Endpoint público (sin token). Valida el token y su expiración (24h).
 */
export async function resetPasswordConfirm(payload: ResetPasswordConfirmPayload): Promise<ResetPasswordConfirmResponse> {
  return apiFetch<ResetPasswordConfirmResponse>("/accounts/users/reset_password_confirm/", {
    method: "POST",
    body: payload,
    auth: "none",
    branch: "none",
  });
}
