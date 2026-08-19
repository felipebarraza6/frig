"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/lib/store/toast";

/**
 * Escucha el evento global "api:forbidden" disparado por apiFetch cuando una
 * petición recibe 403. Muestra un toast y redirige a /dashboard.
 *
 * Útil para cuando el owner apaga un módulo y luego una página ya abierta
 * intenta usar una API de ese módulo.
 */
export function ForbiddenListener() {
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    function handleForbidden(e: Event) {
      const error = e instanceof CustomEvent ? (e.detail as ApiError) : null;
      const message =
        error?.message && error.message !== "Error 403"
          ? error.message
          : "Esta funcionalidad no está disponible en tu plan o fue deshabilitada.";
      toast.error(message);
      router.replace("/dashboard");
    }

    window.addEventListener("api:forbidden", handleForbidden);
    return () => window.removeEventListener("api:forbidden", handleForbidden);
  }, [router, toast]);

  return null;
}
