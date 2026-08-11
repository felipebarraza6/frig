import { apiFetch } from "./client";
import { getBranchId } from "./session-storage";
import type { Branch, BranchThemeConfig } from "@/lib/types";

/** GET /api/branches/ — lista sucursales a las que el usuario tiene acceso. */
export async function fetchBranches(): Promise<Branch[]> {
  const data = await apiFetch<{ results?: Branch[] } | Branch[]>("/branches/");
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