"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/lib/store/toast";

/**
 * Escucha el evento global "api:forbidden" disparado por apiFetch cuando una
 * petición recibe 403. Muestra un toast y redirige a /dashboard solo cuando
 * el error bloquea la página actual; para queries secundarias de módulos
 * opcionales (p. ej. tables, public_catalog en POS) solo avisa.
 */
export function ForbiddenListener() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();

  useEffect(() => {
    function handleForbidden(e: Event) {
      const error = e instanceof CustomEvent ? (e.detail as ApiError) : null;
      const message =
        error?.message && error.message !== "Error 403"
          ? error.message
          : "Esta funcionalidad no está disponible en tu plan o fue deshabilitada.";
      toast.error(message);

      // No sacar al usuario de POS por módulos secundarios desactivados.
      const isPosRoute = pathname.startsWith("/pos");
      const isSecondaryModule =
        /tables|public_catalog|product_catalog|nutrition/i.test(message);
      if (isPosRoute && isSecondaryModule) {
        return;
      }

      router.replace("/dashboard");
    }

    window.addEventListener("api:forbidden", handleForbidden);
    return () => window.removeEventListener("api:forbidden", handleForbidden);
  }, [router, pathname, toast]);

  return null;
}
