import { apiFetch } from "./client";
import { getBranchId } from "./session-storage";
import type {
  Branch,
  BranchPayload,
  BranchThemeConfig,
  ID,
  RoleDefinition,
  UserResponse,
} from "@/lib/types";

export interface BranchesFilter {
  search?: string;
  is_active?: boolean;
  next?: string | null;
  previous?: string | null;
}

/** GET /api/branches/ — lista sucursales a las que el usuario tiene acceso. */
export async function fetchBranches(filter: BranchesFilter = {}): Promise<{
  results: Branch[];
  count: number;
  next?: string | null;
  previous?: string | null;
}> {
  if (filter.next) {
    const data = await apiFetch<{ results?: Branch[]; count?: number; next?: string | null; previous?: string | null } | Branch[]>(
      filter.next,
      { branch: "none" },
    );
    if (Array.isArray(data)) return { results: data, count: data.length };
    return { results: data.results ?? [], count: data.count ?? 0, next: data.next, previous: data.previous };
  }
  if (filter.previous) {
    const data = await apiFetch<{ results?: Branch[]; count?: number; next?: string | null; previous?: string | null } | Branch[]>(
      filter.previous,
      { branch: "none" },
    );
    if (Array.isArray(data)) return { results: data, count: data.length };
    return { results: data.results ?? [], count: data.count ?? 0, next: data.next, previous: data.previous };
  }
  const qs = new URLSearchParams();
  if (filter.search) qs.set("search", filter.search);
  if (filter.is_active !== undefined) qs.set("is_active", String(filter.is_active));
  const query = qs.toString();
  const data = await apiFetch<{ results?: Branch[]; count?: number; next?: string | null; previous?: string | null } | Branch[]>(
    `/branches/${query ? `?${query}` : ""}`,
  );
  if (Array.isArray(data)) return { results: data, count: data.length };
  return { results: data.results ?? [], count: data.count ?? 0, next: data.next, previous: data.previous };
}

/** GET /api/branches/{id}/ — detalle de una sucursal. */
export async function fetchBranch(id: ID): Promise<Branch> {
  return apiFetch<Branch>(`/branches/${id}/`);
}

/** POST /api/branches/ — crear sucursal. */
export async function createBranch(payload: BranchPayload): Promise<Branch> {
  return apiFetch<Branch>("/branches/", {
    method: "POST",
    body: payload,
  });
}

/** PATCH /api/branches/{id}/ — editar sucursal. */
export async function updateBranch(id: ID, payload: Partial<BranchPayload>): Promise<Branch> {
  return apiFetch<Branch>(`/branches/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

/** GET /api/branches/{id}/users/ — usuarios de la sucursal. */
export async function fetchBranchUsers(id: ID): Promise<UserResponse[]> {
  const data = await apiFetch<{ results?: UserResponse[] } | UserResponse[]>(
    `/branches/${id}/users/`,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

/** POST /api/branches/{id}/invite-user/ — invitar usuario por email. */
export async function inviteBranchUser(
  id: ID,
  email: string,
  roleDefinition: ID,
): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(`/branches/${id}/invite-user/`, {
    method: "POST",
    body: { email, role_definition: roleDefinition },
  });
}

/** GET /api/branches/{id}/roles/ — definiciones de rol de la sucursal. */
export async function fetchBranchRoles(branchId: ID): Promise<RoleDefinition[]> {
  const data = await apiFetch<{ results?: RoleDefinition[] } | RoleDefinition[]>(
    `/branches/${branchId}/roles/`,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

/**
 * GET /api/branches/themes/ — tema de la sucursal activa (X-Branch-ID).
 * Nota: el endpoint devuelve TODOS los temas; se filtra por sucursal aquí.
 */
export async function fetchBranchTheme(): Promise<BranchThemeConfig | null> {
  const data = await apiFetch<{ results?: BranchThemeConfig[] } | BranchThemeConfig>(
    "/branches/themes/",
    { auth: "auto" },
  );
  if (Array.isArray(data)) {
    const branchId = getBranchId();
    if (branchId) {
      return data.find((t) => String(t.branch) === branchId) ?? data[0] ?? null;
    }
    return data[0] ?? null;
  }
  return data ?? null;
}

/** GET /api/branches/public-login-theme/{slug}/ — login pre-auth por slug de sucursal. */
export async function fetchPublicLoginTheme(
  slug: string,
): Promise<BranchThemeConfig | null> {
  try {
    return await apiFetch<BranchThemeConfig>(
      `/branches/public-login-theme/${slug}/`,
      { auth: "none", branch: "none" },
    );
  } catch {
    return null;
  }
}

/**
 * Aplica el tema multi-tenant a `:root` inyectando CSS custom properties
 * de marca. Sin theme se usan los defaults de globals.css.
 */
export function applyThemeConfig(theme: BranchThemeConfig | null): void {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", theme?.primary_color ?? "#2f6b3c");
  root.style.setProperty("--brand-secondary", theme?.secondary_color ?? "#f2e8cf");
  root.style.setProperty(
    "--brand-radius",
    typeof theme?.borderRadius === "number" && theme.borderRadius > 0
      ? `${theme.borderRadius}px`
      : "0.75rem",
  );
  if (theme?.algorithm === "dark") {
    root.classList.add("dark");
  } else if (theme?.algorithm === "light") {
    root.classList.remove("dark");
  }
}