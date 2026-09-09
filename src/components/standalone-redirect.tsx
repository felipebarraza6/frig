"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * La PWA instalada arranca en start_url "/". Si abre en standalone, el
 * usuario quiere la app (no la landing de marketing): lo mandamos a /login,
 * que redirige solo al dashboard si ya hay sesión.
 */
export function StandaloneRedirect() {
  const router = useRouter();

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) router.replace("/login");
  }, [router]);

  return null;
}
