"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/lib/store/toast";
import { useIsPosFirstRole } from "@/lib/store/session";

/**
 * Escucha el evento global "api:forbidden" disparado por apiFetch cuando una
 * petición recibe 403. Muestra un toast discreto y evita redirigir a roles
 * operativos (cajero/mesero) o quedarse en un loop si /dashboard también falla.
 */
export function ForbiddenListener() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const isPosFirstRole = useIsPosFirstRole();

  useEffect(() => {
    function handleForbidden(e: Event) {
      const error = e instanceof CustomEvent ? (e.detail as ApiError) : null;
      const rawMessage = error?.message && error.message !== "Error 403" ? error.message : "";
      const message = rawMessage || "No tienes permiso para ver esta función.";

      // No mostrar toast si es una petición secundaria silenciosa de POS.
      const isPosRoute = pathname.startsWith("/pos");
      const isSecondaryModule = /tables|public_catalog|product_catalog|nutrition/i.test(rawMessage);
      if (!(isPosRoute && isSecondaryModule)) {
        toast.error(message);
      }

      // Roles operativos se quedan donde están; /dashboard no redirige a sí mismo.
      if (isPosFirstRole || pathname === "/dashboard") {
        return;
      }

      router.replace("/dashboard");
    }

    window.addEventListener("api:forbidden", handleForbidden);
    return () => window.removeEventListener("api:forbidden", handleForbidden);
  }, [router, pathname, toast, isPosFirstRole]);

  return null;
}
