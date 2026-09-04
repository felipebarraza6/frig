"use client";

import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "@/lib/store/session";
import { getToken } from "@/lib/api/session-storage";
import {
  useBranchWebSocket,
  type BranchEventMessage,
  type BranchEventScope,
} from "@/lib/realtime/useBranchWebSocket";

const SCOPES: BranchEventScope[] = ["pos", "cash_register", "dashboard", "modules"];

function invalidateQueriesForEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  message: BranchEventMessage
) {
  switch (message.scope) {
    case "pos":
    case "order":
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["kitchen-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["order"] });
      break;
    case "cash_register":
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      break;
    case "dashboard":
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      break;
    case "modules":
      // Otro dispositivo/ventana cambió los módulos activos de la sucursal.
      // Refrescamos la query para que el menú y los guards se enteren.
      queryClient.invalidateQueries({ queryKey: ["branch-modules"] });
      break;
    default:
      break;
  }
}

/**
 * Proveedor de eventos en tiempo real por sucursal.
 *
 * Se conecta a `/ws/branch/<branchId>/` y refresca automáticamente las
 * queries de React Query relevantes cuando llegan eventos de POS, caja o
 * dashboard.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const currentBranchId = useSessionStore((s) => s.currentBranchId);
  const token = getToken();

  const handleMessage = useCallback(
    (message: BranchEventMessage) => {
      invalidateQueriesForEvent(queryClient, message);
    },
    [queryClient]
  );

  const { status } = useBranchWebSocket(currentBranchId, token, {
    scopes: SCOPES,
    onMessage: handleMessage,
    enabled: Boolean(currentBranchId && token),
  });

  useEffect(() => {
    // El status se expone para futura UI de "conectando" / "sin conexión".
    if (status === "error") {
      console.warn("[RealtimeProvider] WebSocket error");
    }
  }, [status]);

  return <>{children}</>;
}
