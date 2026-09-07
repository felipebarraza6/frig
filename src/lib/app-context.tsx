"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchPublicLoginThemeByHost } from "@/lib/api/branches";
import type { BranchThemeConfig } from "@/lib/types";

export type AppStatus = "checking" | "ready";

export interface AppContextValue {
  host: string;
  isDev: boolean;
  theme: BranchThemeConfig | null;
  checkoutGroup: string;
  status: AppStatus;
}

const AppContext = createContext<AppContextValue | null>(null);

function resolveHost(): { host: string; isDev: boolean } {
  if (typeof window === "undefined") return { host: "", isDev: true };
  const host = window.location.hostname;
  const isDev = host === "localhost" || host === "127.0.0.1" || /^\d+\.\d+\.\d+\.\d+$/.test(host);
  return { host, isDev };
}

export function AppProvider({ children, checkoutGroup = "frig" }: { children: ReactNode; checkoutGroup?: string }) {
  const [{ host, isDev }] = useState(resolveHost);
  const [theme, setTheme] = useState<BranchThemeConfig | null>(null);
  const [status, setStatus] = useState<AppStatus>(() => (isDev ? "ready" : "checking"));

  useEffect(() => {
    if (isDev || status === "ready") return;
    let cancelled = false;
    (async () => {
      const t = await fetchPublicLoginThemeByHost();
      if (cancelled) return;
      setTheme(t);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [isDev, status]);

  const value = useMemo<AppContextValue>(
    () => ({ host, isDev, theme, checkoutGroup, status }),
    [host, isDev, theme, checkoutGroup, status],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) return { host: "", isDev: true, theme: null, checkoutGroup: "frig", status: "ready" };
  return ctx;
}
