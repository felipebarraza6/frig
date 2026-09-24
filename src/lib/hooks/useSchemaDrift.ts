"use client";

import { useEffect } from "react";
import { useToastStore } from "@/lib/store/toast";

/**
 * Escucha el evento global "api:schema-drift" que dispara apiFetch/apiFile
 * cuando el header `X-Yggdra-Schema-Sha` del backend difiere del sha con el
 * que se compiló el frontend (ver src/lib/api/contract-sha.ts). Muestra un
 * toast persistente pidiendo recargar: el bundle servido quedó atrás del
 * contrato del backend y las llamadas pueden romper.
 */
export function useSchemaDrift(): void {
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    function handleDrift() {
      addToast({
        message: "El backend fue actualizado. Recarga la página.",
        variant: "warning",
        duration: 0,
        action: {
          label: "Recargar",
          onClick: () => window.location.reload(),
        },
      });
    }

    window.addEventListener("api:schema-drift", handleDrift);
    return () => window.removeEventListener("api:schema-drift", handleDrift);
  }, [addToast]);
}
