"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { useToast } from "@/lib/store/toast";
import { FRIG_ALWAYS_ON_MODULES } from "@/lib/modules";
import { useIsPosFirstRole } from "@/lib/store/session";

/**
 * Escucha el evento global "api:forbidden" disparado por apiFetch cuando una
 * petición recibe 403. Muestra un toast discreto y evita redirigir a roles
 * operativos (cajero/mesero) o quedarse en un loop si /dashboard también falla.
 *
 * Los módulos que en Frig son core (siempre activos) no generan toast ni
 * redirección: si el backend los reporta deshabilitados es un problema de
 * configuración, no una acción del usuario.
 */
export function ForbiddenListener() {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const isPosFirstRole = useIsPosFirstRole();

  // Regex compilada una sola vez con word-boundaries: evita que "sales"
  // matchee "salesperson" o "config" matchee "configuration".
  const alwaysOnRegex = useMemo(
    () =>
      new RegExp(
        `\\b(${FRIG_ALWAYS_ON_MODULES.join("|")})\\b`,
        "i",
      ),
    [],
  );

  useEffect(() => {
    function handleForbidden(e: Event) {
      const error = e instanceof CustomEvent ? (e.detail as ApiError) : null;
      const rawMessage = error?.message && error.message !== "Error 403" ? error.message : "";
      const message = rawMessage || "No tienes permiso para ver esta función.";

      // Si el error proviene de un módulo core de Frig (siempre activo), no
      // molestamos al usuario: el backend debería tenerlo habilitado.
      // Match por palabra completa para no caer en falsos positivos
      // (p. ej. "salesperson" contiene "sales" pero NO debe silenciarse).
      if (rawMessage && alwaysOnRegex.test(rawMessage)) {
        return;
      }

      // No mostrar toast si es una petición secundaria silenciosa de POS.
      const isPosRoute = pathname.startsWith("/pos");
      const isSecondaryModule = /\b(tables|public_catalog|product_catalog|nutrition)\b/i.test(
        rawMessage,
      );
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
  }, [router, pathname, toast, isPosFirstRole, alwaysOnRegex]);

  return null;
}
