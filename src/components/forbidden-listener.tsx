"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";
import { toggleBranchModule, type ModuleName } from "@/lib/api/branch-modules";
import { activateBranch } from "@/lib/branch-session";
import { getModuleMetadata } from "@/lib/hooks/useModuleCatalog";
import { useToast, useToastStore } from "@/lib/store/toast";
import { FRIG_ALWAYS_ON_MODULES } from "@/lib/modules";
import {
  useIsOwner,
  useIsPosFirstRole,
  useIsSuperAdmin,
  useSessionStore,
} from "@/lib/store/session";

/**
 * Extrae el módulo de un 403 "módulo no habilitado" del backend:
 * «El módulo 'nutrition' no está habilitado para esta sucursal.»
 */
export function parseDisabledModule(message: string): string | null {
  const match = /m[oó]dulo\s+['"«]?([a-z_]+)['"»]?\s+no est[aá] habilitado/i.exec(message);
  return match ? match[1].toLowerCase() : null;
}

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
  const isOwner = useIsOwner();
  const isSuperAdmin = useIsSuperAdmin();
  const canManageModules = isOwner || isSuperAdmin;
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const addToast = useToastStore((s) => s.addToast);
  const queryClient = useQueryClient();
  // Un aviso por módulo y sucursal mientras dure la sesión en la app: varias
  // peticiones paralelas/polling al mismo módulo no deben repetir el toast.
  const noticedModulesRef = useRef<Set<string>>(new Set());

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
      const isSecondaryModule = /\b(tables|public_catalog|product_catalog|nutrition|catalogs)\b/i.test(
        rawMessage,
      );

      // 403 "módulo no habilitado": un aviso por módulo con acción para
      // activarlo. OWNER/superadmin lo activan aquí mismo (toggle + refresco de
      // frontend-config); el resto recibe el aviso de pedirlo al dueño.
      const disabledModule = parseDisabledModule(rawMessage);
      if (disabledModule) {
        if (isPosRoute && isSecondaryModule) return;
        const noticeKey = `${currentBranchId ?? ""}:${disabledModule}`;
        if (noticedModulesRef.current.has(noticeKey)) return;
        noticedModulesRef.current.add(noticeKey);
        const label = getModuleMetadata(disabledModule, {}).label;
        const branchId = Number(currentBranchId);
        const canEnableHere =
          canManageModules && Number.isFinite(branchId) && branchId > 0;
        addToast({
          message: canEnableHere
            ? `El módulo «${label}» no está habilitado en esta sucursal.`
            : `El módulo «${label}» no está habilitado. Pide al dueño de la sucursal que lo active.`,
          variant: "warning",
          duration: 8000,
          ...(canEnableHere
            ? {
                action: {
                  label: "Activar módulo",
                  onClick: () => {
                    void (async () => {
                      try {
                        await toggleBranchModule({
                          branchId,
                          moduleName: disabledModule as ModuleName,
                          isEnabled: true,
                        });
                        await activateBranch(String(branchId), queryClient);
                        noticedModulesRef.current.delete(noticeKey);
                        toast.success(`Módulo «${label}» activado.`);
                      } catch (err) {
                        toast.error(
                          err instanceof Error
                            ? err.message
                            : "No se pudo activar el módulo.",
                        );
                      }
                    })();
                  },
                },
              }
            : {}),
        });
        // Sin redirección: el usuario puede activarlo y seguir donde estaba.
        return;
      }

      // Errores de "módulo no habilitado para esta sucursal": la UI ya oculta
      // esas secciones y el 403 suele venir de peticiones secundarias/paralelas
      // (no de una acción del usuario). Mostrar el toast rompe la experiencia.
      const isModuleDisabled = /no está habilitado/i.test(rawMessage);
      if (!isModuleDisabled && !(isPosRoute && isSecondaryModule)) {
        toast.error(message);
      }

      // No redirigir si estamos en POS y el error es de un módulo secundario.
      // Tampoco redirigir para roles operativos ni si ya estamos en /dashboard.
      if (isPosFirstRole || pathname === "/dashboard") {
        return;
      }
      if (isPosRoute && isSecondaryModule) {
        return;
      }

      router.replace("/dashboard");
    }

    window.addEventListener("api:forbidden", handleForbidden);
    return () => window.removeEventListener("api:forbidden", handleForbidden);
  }, [
    router,
    pathname,
    toast,
    isPosFirstRole,
    alwaysOnRegex,
    canManageModules,
    currentBranchId,
    addToast,
    queryClient,
  ]);

  return null;
}
