import { useCurrentBranch, useSessionStore } from "@/lib/store/session";
import { mediaUrl } from "@/lib/api/client";

export const FRIG_SYMBOL = "/brand/frig-symbol.png";

/** Localhost / IP: el producto es FRIG (desarrollo y demos locales). */
export function isLocalFrigHost(): boolean {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host)
  );
}

/**
 * Nombre que ve el usuario: marca de la sucursal / org (white-label).
 * Si no hay sucursal ni organización, el fallback es FRIG.
 */
export function productDisplayName(opts: {
  appName?: string | null;
  businessName?: string | null;
  branchName?: string | null;
  organizationName?: string | null;
}): string {
  const app = opts.appName?.trim();
  if (app) return app;
  const biz = opts.businessName?.trim();
  if (biz) return biz;
  const br = opts.branchName?.trim();
  if (br) return br;
  const org = opts.organizationName?.trim();
  if (org) return org;
  return "App";
}

export function useProductBrand(): {
  name: string;
  logo: string;
  isFrig: boolean;
} {
  const theme = useSessionStore((s) => s.theme);
  const orgTheme = useSessionStore((s) => s.organizationTheme);
  const branch = useCurrentBranch();

  if (isLocalFrigHost()) {
    return { name: "FRIG", logo: FRIG_SYMBOL, isFrig: true };
  }

  const name = productDisplayName({
    appName: theme?.app_name || orgTheme?.app_name,
    businessName: branch?.business_name ?? branch?.fantasy_name,
    branchName: branch?.branch_name,
    organizationName: branch?.organization_name,
  });
  const logo =
    mediaUrl(theme?.logo) ||
    mediaUrl(orgTheme?.logo) ||
    mediaUrl(branch?.logo) ||
    FRIG_SYMBOL;

  return {
    name,
    logo,
    isFrig: name.trim().toLowerCase() === "frig",
  };
}

export function useProductName(): string {
  return useProductBrand().name;
}
