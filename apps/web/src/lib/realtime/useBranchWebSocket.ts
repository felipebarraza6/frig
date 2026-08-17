"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type BranchEventScope = "pos" | "cash_register" | "dashboard" | "order";

export type BranchEventMessage = {
  type: "branch_event";
  scope: BranchEventScope;
  event_type: string;
  payload: Record<string, unknown>;
  timestamp?: string;
};

export type WebSocketStatus = "connecting" | "open" | "closed" | "error";

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;
const DEFAULT_SCOPES: BranchEventScope[] = ["pos", "cash_register", "dashboard"];

function getWsBaseUrl(): string {
  const apiBase = process.env.NEXT_PUBLIC_YGGDRA_API_BASE ?? "http://localhost:8000/api";
  return apiBase
    .replace(/^http/, "ws")
    .replace(/\/api\/?$/, "");
}

/**
 * Hook que mantiene una conexión WebSocket con `/ws/branch/<branchId>/`.
 *
 * Reconecta automáticamente ante desconexiones y retransmite eventos del
 * backend (POS, caja, dashboard) a través de `onMessage`.
 */
export function useBranchWebSocket(
  branchId: string | number | null | undefined,
  token: string | null | undefined,
  options: {
    scopes?: BranchEventScope[];
    onMessage?: (message: BranchEventMessage) => void;
    enabled?: boolean;
  } = {}
) {
  const { scopes = DEFAULT_SCOPES, onMessage, enabled = true } = options;
  const [status, setStatus] = useState<WebSocketStatus>("closed");
  const [lastMessage, setLastMessage] = useState<BranchEventMessage | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const onMessageRef = useRef(options.onMessage);
  const connectRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    const socket = socketRef.current;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      socketRef.current = null;
    }
  }, []);

  const scheduleReconnect = useCallback(() => {
    const delay = Math.min(
      RECONNECT_DELAY_MS * 2 ** reconnectAttemptsRef.current,
      MAX_RECONNECT_DELAY_MS
    );
    reconnectAttemptsRef.current += 1;
    reconnectTimeoutRef.current = setTimeout(() => connectRef.current(), delay);
  }, []);

  const connect = useCallback(() => {
    if (
      typeof window === "undefined" ||
      !enabled ||
      !branchId ||
      !token
    ) {
      return;
    }

    cleanup();
    setStatus("connecting");

    const url = `${getWsBaseUrl()}/ws/branch/${branchId}/?token=${encodeURIComponent(
      token
    )}`;
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setStatus("open");
      socket.send(JSON.stringify({ type: "subscribe", scopes }));
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as unknown;
        if (
          data &&
          typeof data === "object" &&
          (data as { type?: string }).type === "branch_event"
        ) {
          const msg = data as BranchEventMessage;
          setLastMessage(msg);
          onMessageRef.current?.(msg);
        }
      } catch {
        // Ignorar mensajes que no sean JSON válido.
      }
    };

    socket.onerror = () => {
      setStatus("error");
    };

    socket.onclose = () => {
      setStatus("closed");
      scheduleReconnect();
    };
  }, [branchId, token, enabled, scopes, cleanup, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    // Iniciar la conexión en el siguiente tick para evitar setState
    // sincrónico durante el renderizado.
    const timeoutId = setTimeout(() => connect(), 0);
    return () => {
      clearTimeout(timeoutId);
      cleanup();
    };
  }, [connect, cleanup]);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  return {
    status,
    lastMessage,
    sendMessage,
  };
}
