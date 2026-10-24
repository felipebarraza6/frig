"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "@/lib/store/session";
import { getToken } from "@/lib/api/session-storage";
import {
  useBranchWebSocket,
  type BranchEventMessage,
  type BranchEventScope,
} from "@/lib/realtime/useBranchWebSocket";
import { CASH_KEYS, CRM_KEYS, KITCHEN_KEYS } from "@/lib/api/keys";

const SCOPES: BranchEventScope[] = [
  "pos",
  "order",
  "cash_register",
  "dashboard",
  "modules",
  "crm",
];

/** Una ráfaga de ventas (POS + KDS + caja) se resuelve en un solo refetch por dominio. */
const INVALIDATE_DEBOUNCE_MS = 400;

function queriesForScope(scope: BranchEventScope): string[][] {
  switch (scope) {
    case "pos":
    case "order":
      return [["orders"], [...KITCHEN_KEYS.all], ["order"], ["pending-accounts-count"], ["pending-orders-count"], ["pending-collect-count"]];
    case "cash_register":
      return [[...CASH_KEYS.all], ["cash-registers"]];
    case "dashboard":
      return [["dashboard"]];
    case "crm":
      return [[...CRM_KEYS.all], ["surveys"]];
    case "modules":
      return [["branch-modules"]];
    default:
      return [];
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
  const pendingKeys = useRef(new Map<string, string[]>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    flushTimer.current = null;
    const keys = [...pendingKeys.current.values()];
    pendingKeys.current.clear();
    for (const queryKey of keys) {
      queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient]);

  const handleMessage = useCallback(
    (message: BranchEventMessage) => {
      for (const queryKey of queriesForScope(message.scope)) {
        pendingKeys.current.set(queryKey.join(":"), queryKey);
      }
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flush, INVALIDATE_DEBOUNCE_MS);
    },
    [flush]
  );

  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, []);

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
