"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LazyMotion, domAnimation, m, AnimatePresence } from "framer-motion";
import {
  Banknote,
  ChefHat,
  ClipboardList,
  Clock,
  ExternalLink,
  Maximize2,
  Minimize2,
  PackageCheck,
  ShoppingBag,
  TriangleAlert,
  Utensils,
  X,
  XCircle,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
  cancelKitchenTicket,
  deliverKitchenTicket,
  fetchKitchenTickets,
  kitchenTicketCode,
  readyKitchenTicket,
  startKitchenTicket,
  type KitchenTicket,
} from "@/lib/api/kitchen";
import {
  fetchLowStock,
  fetchOutOfStock,
  fetchProductInventory,
} from "@/lib/api/inventory";
import { fetchOrder, fetchOrders } from "@/lib/api/orders";
import {
  getCurrentCashRegister,
  getLastClosedCashRegister,
} from "@/lib/api/cash-register";
import {
  searchProductsForSale,
  updateProduct,
  type ProductForSale,
} from "@/lib/api/products";
import { mediaUrl } from "@/lib/api/client";
import { useElapsedTime } from "@/lib/hooks/useElapsedTime";
import { useToast } from "@/lib/store/toast";
import { cn, formatCLP, orderTypeLabel } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchKitchenStations } from "@/lib/api/kitchen-stations";
import { fetchCashRegisterStations } from "@/lib/api/cash-register-stations";
import type { SalonOverlayKind } from "./venue-screens";

const OVERLAY_TITLES: Record<SalonOverlayKind, string> = {
  kitchen: "Cocina",
  inventory: "Inventario / Bodegas",
  orders: "Ventas / Órdenes",
  catalog: "Catálogo",
  deliveries: "Entregas",
  cash: "Caja",
};

function overlayWindowTitle(
  win: SalonWindow,
  kitchenStations: { id: number; name: string }[],
  cashStations: { id: number; name?: string | null }[],
) {
  if (win.kind === "kitchen" && win.kitchenStationId != null) {
    return (
      kitchenStations.find((s) => s.id === win.kitchenStationId)?.name ??
      OVERLAY_TITLES.kitchen
    );
  }
  if (win.kind === "cash" && win.cashStationId != null) {
    return (
      cashStations.find((s) => s.id === win.cashStationId)?.name?.trim() ||
      OVERLAY_TITLES.cash
    );
  }
  return OVERLAY_TITLES[win.kind];
}

/* ------------------------------------------------------------------ */
/* Paneles vivos DENTRO del salón 3D: cocina operativa, inventario y  */
/* órdenes. Nunca navegan fuera: todo pasa sobre la escena.           */
/* ------------------------------------------------------------------ */

export type SalonWindow = {
  id: string;
  kind: SalonOverlayKind;
  kitchenStationId?: number | null;
  cashStationId?: number | null;
  inventorySearch?: string;
  x?: number;
  y?: number;
  /** Cambia al reactivar: OverlayShell reubica la burbuja en el click. */
  spawn?: number;
};

function OverlayShell({
  title,
  onClose,
  onFocus,
  onToggleFullscreen,
  fullscreen,
  zIndex,
  offset,
  wide,
  bubble,
  initialPos,
  spawn,
  onPosChange,
  children,
}: {
  title: string;
  onClose: () => void;
  onFocus: () => void;
  onToggleFullscreen: () => void;
  fullscreen: boolean;
  zIndex: number;
  offset: number;
  wide?: boolean;
  /** Estilo burbuja tipo POS al abrir en el click. */
  bubble?: boolean;
  initialPos?: { x: number; y: number };
  spawn?: number;
  onPosChange?: (pos: { x: number; y: number }) => void;
  children: ReactNode;
}) {
  const [pos, setPos] = useState(
    () => initialPos ?? { x: 20 + offset * 28, y: 56 + offset * 24 },
  );
  const drag = useRef<{ ox: number; oy: number; x: number; y: number } | null>(null);
  const posRef = useRef(pos);
  posRef.current = pos;

  useEffect(() => {
    if (spawn == null || !initialPos) return;
    setPos(initialPos);
    posRef.current = initialPos;
  }, [spawn, initialPos?.x, initialPos?.y]);

  return (
    <LazyMotion features={domAnimation} strict>
      <m.aside
        initial={
          bubble
            ? { opacity: 0, scale: 0.55, y: 28 }
            : { opacity: 0, y: 14, scale: 0.98 }
        }
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={
          bubble
            ? { opacity: 0, scale: 0.7, y: 16 }
            : { opacity: 0, y: 10, scale: 0.98 }
        }
        transition={{ duration: bubble ? 0.28 : 0.2, ease: [0.16, 1, 0.3, 1] }}
        role="dialog"
        aria-label={title}
        onPointerDown={onFocus}
        className={cn(
          "absolute flex flex-col overflow-hidden border border-border bg-card text-card-foreground shadow-2xl",
          bubble ? "rounded-3xl" : "rounded-2xl",
          fullscreen
            ? "inset-3"
            : wide
              ? "h-[min(42vh,22rem)] w-[min(calc(100%-1.5rem),40rem)]"
              : bubble
                ? "h-[min(52vh,26rem)] w-[min(calc(100%-1.5rem),22.5rem)]"
                : "h-[min(48vh,22rem)] w-[min(calc(100%-1.5rem),22rem)]",
        )}
        style={
          fullscreen
            ? { zIndex }
            : { zIndex, left: pos.x, top: pos.y }
        }
      >
        <div
          className="flex h-9 shrink-0 cursor-grab items-center gap-1 px-2 active:cursor-grabbing"
          onPointerDown={(e) => {
            if (fullscreen) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { ox: e.clientX, oy: e.clientY, x: pos.x, y: pos.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const next = {
              x: Math.max(8, drag.current.x + e.clientX - drag.current.ox),
              y: Math.max(8, drag.current.y + e.clientY - drag.current.oy),
            };
            posRef.current = next;
            setPos(next);
          }}
          onPointerUp={() => {
            if (drag.current) onPosChange?.(posRef.current);
            drag.current = null;
          }}
        >
          <p className="min-w-0 flex-1 truncate px-1 text-sm font-semibold leading-none text-card-foreground">
            {title}
          </p>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleFullscreen}
            aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/40 hover:text-foreground"
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white/40 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </m.aside>
    </LazyMotion>
  );
}

export function SalonOverlays({
  windows,
  fullscreenId,
  zOrder,
  onClose,
  onFocus,
  onToggleFullscreen,
  onLocateTable,
  tableLabel,
  onWindowPos,
  canGoPos = true,
}: {
  windows: SalonWindow[];
  fullscreenId: string | null;
  zOrder: Record<string, number>;
  onClose: (id: string) => void;
  onFocus: (id: string) => void;
  onToggleFullscreen: (id: string) => void;
  onLocateTable?: (tableId: number) => void;
  tableLabel?: (tableId: number) => string | null;
  onWindowPos?: (id: string, pos: { x: number; y: number }) => void;
  /** Ir a la caja / terminal POS (módulo pos activo). */
  canGoPos?: boolean;
}) {
  const { data: kitchenStations = [] } = useQuery({
    queryKey: ["kitchen-stations"],
    queryFn: fetchKitchenStations,
    staleTime: 60_000,
    enabled: windows.some((w) => w.kind === "kitchen"),
  });
  const { data: cashStations = [] } = useQuery({
    queryKey: ["cash-register-stations"],
    queryFn: fetchCashRegisterStations,
    staleTime: 60_000,
    enabled: windows.some((w) => w.kind === "cash"),
  });

  return (
    <AnimatePresence>
      {windows.map((win, i) => (
        <OverlayShell
          key={win.id}
          title={overlayWindowTitle(win, kitchenStations, cashStations)}
          onClose={() => onClose(win.id)}
          onFocus={() => onFocus(win.id)}
          onToggleFullscreen={() => onToggleFullscreen(win.id)}
          fullscreen={fullscreenId === win.id}
          zIndex={40 + (zOrder[win.id] ?? i)}
          offset={i}
          wide={win.kind === "kitchen" || win.kind === "catalog"}
          bubble={win.kind === "orders" || win.kind === "cash"}
          spawn={win.spawn}
          initialPos={
            win.x != null && win.y != null ? { x: win.x, y: win.y } : undefined
          }
          onPosChange={(p) => onWindowPos?.(win.id, p)}
        >
          {win.kind === "kitchen" && <KitchenPanel stationId={win.kitchenStationId} />}
          {win.kind === "inventory" && (
            <InventoryPanel initialSearch={win.inventorySearch} />
          )}
          {win.kind === "orders" && (
            <OrdersPanel
              onLocateTable={onLocateTable}
              tableLabel={tableLabel}
              canGoPos={canGoPos}
            />
          )}
          {win.kind === "catalog" && <CatalogPanel />}
          {win.kind === "deliveries" && <DeliveriesPanel />}
          {win.kind === "cash" && <CashPanel stationId={win.cashStationId} />}
        </OverlayShell>
      ))}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Cocina operativa (sin salir del salón)                             */
/* ------------------------------------------------------------------ */

const KDS_COLUMNS: {
  key: KitchenTicket["status"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  chip: string;
}[] = [
  { key: "PENDING", label: "Pendientes", icon: Clock, chip: "bg-warning" },
  { key: "PREPARING", label: "En preparación", icon: ChefHat, chip: "bg-primary" },
  { key: "READY", label: "Listos", icon: Utensils, chip: "bg-success" },
];

function KitchenPanel({ stationId }: { stationId?: number | null }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [openId, setOpenId] = useState<number | null>(null);
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["kitchen-tickets", "salon-overlay", stationId ?? "all"],
    queryFn: () => fetchKitchenTickets(undefined, stationId),
    refetchInterval: 10_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["kitchen-tickets"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  };
  const onError = (e: Error) => toast.error(e.message || "No se pudo actualizar");
  const startM = useMutation({ mutationFn: startKitchenTicket, onSuccess: invalidate, onError });
  const readyM = useMutation({ mutationFn: readyKitchenTicket, onSuccess: invalidate, onError });
  const deliverM = useMutation({ mutationFn: deliverKitchenTicket, onSuccess: invalidate, onError });
  const cancelM = useMutation({ mutationFn: cancelKitchenTicket, onSuccess: invalidate, onError });

  if (isLoading) {
    return (
      <div className="grid h-full gap-3 p-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-full min-h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  const selected = tickets.find((t) => t.id === openId) ?? null;

  return (
      <div className="relative grid h-full min-h-0 gap-2 px-2.5 pb-2.5 sm:grid-cols-3">
      {selected && (
        <KitchenTicketDetail
          ticket={selected}
          busy={startM.isPending || readyM.isPending || deliverM.isPending || cancelM.isPending}
          onBack={() => setOpenId(null)}
          onStart={() => startM.mutate(selected.id)}
          onReady={() => readyM.mutate(selected.id)}
          onDeliver={() => deliverM.mutate(selected.id)}
          onCancel={() => cancelM.mutate(selected.id)}
        />
      )}
      {KDS_COLUMNS.map((col) => {
        const Icon = col.icon;
        const list = tickets.filter((t) => t.status === col.key);
        return (
          <div
            key={col.key}
            className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-muted/70"
          >
            <div className={cn("flex items-center gap-1.5 px-2.5 py-1.5 text-white", col.chip)}>
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold">{col.label}</span>
              <span className="ml-auto rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold">
                {list.length}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
              {list.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Sin comandas
                </p>
              ) : (
                list.map((t) => (
                  <KitchenTicketCard
                    key={t.id}
                    ticket={t}
                    busy={startM.isPending || readyM.isPending || deliverM.isPending || cancelM.isPending}
                    onOpen={() => setOpenId(t.id)}
                    onStart={() => startM.mutate(t.id)}
                    onReady={() => readyM.mutate(t.id)}
                    onDeliver={() => deliverM.mutate(t.id)}
                    onCancel={() => cancelM.mutate(t.id)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KitchenTicketCard({
  ticket,
  busy,
  onOpen,
  onStart,
  onReady,
  onDeliver,
  onCancel,
}: {
  ticket: KitchenTicket;
  busy: boolean;
  onOpen: () => void;
  onStart: () => void;
  onReady: () => void;
  onDeliver: () => void;
  onCancel: () => void;
}) {
  const elapsed = useElapsedTime(ticket.created ?? null, { enabled: true });
  return (
    <div className="rounded-lg border border-border bg-card p-2.5 text-card-foreground shadow-sm">
      <button type="button" onClick={onOpen} className="w-full text-left">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold">{kitchenTicketCode(ticket)}</p>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {elapsed.text}
        </span>
      </div>
      <ul className="mt-1.5 flex flex-col gap-0.5">
        {ticket.items.slice(0, 5).map((it) => (
          <li key={it.id} className="flex items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 truncate">
              {it.quantity ?? 1}× {it.product_name}
            </span>
            {it.station_name && (
              <span className="shrink-0 text-[9px] text-muted-foreground">
                {it.station_name}
              </span>
            )}
          </li>
        ))}
      </ul>
      {ticket.notes && (
        <p className="mt-1 truncate text-[10px] italic text-muted-foreground">
          {ticket.notes}
        </p>
      )}
      </button>
      <div className="mt-2 flex items-center gap-1.5">
        {ticket.status === "PENDING" && (
          <button
            type="button"
            disabled={busy}
            onClick={onStart}
            className="h-7 flex-1 rounded-md bg-primary text-[11px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Empezar
          </button>
        )}
        {ticket.status === "PREPARING" && (
          <button
            type="button"
            disabled={busy}
            onClick={onReady}
            className="h-7 flex-1 rounded-md bg-success text-[11px] font-semibold text-white hover:bg-success/90 disabled:opacity-50"
          >
            Listo
          </button>
        )}
        {ticket.status === "READY" && (
          <button
            type="button"
            disabled={busy}
            onClick={onDeliver}
            className="h-7 flex-1 rounded-md bg-foreground text-[11px] font-semibold text-background hover:opacity-90 disabled:opacity-50"
          >
            Entregar
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          aria-label="Cancelar comanda"
          className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <XCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function KitchenTicketDetail({
  ticket,
  busy,
  onBack,
  onStart,
  onReady,
  onDeliver,
  onCancel,
}: {
  ticket: KitchenTicket;
  busy: boolean;
  onBack: () => void;
  onStart: () => void;
  onReady: () => void;
  onDeliver: () => void;
  onCancel: () => void;
}) {
  const elapsed = useElapsedTime(ticket.created ?? null, { enabled: true });
  const mesa = ticket.table_number ?? ticket.table_name;
  const step =
    ticket.status === "PENDING"
      ? "Pendiente · por empezar"
      : ticket.status === "PREPARING"
        ? "En preparación"
        : ticket.status === "READY"
          ? "Lista para entregar"
          : ticket.status;
  return (
    <div className="absolute inset-0 z-10 flex flex-col overflow-y-auto bg-card p-3 text-card-foreground">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
        >
          ← Volver
        </button>
        <p className="text-sm font-semibold">{kitchenTicketCode(ticket)}</p>
      </div>
      <p className="text-xs font-medium text-primary">{step}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {mesa ? `Mesa ${mesa}` : "Sin mesa"}
        {ticket.client_name ? ` · ${ticket.client_name}` : ""}
        {` · ${elapsed.text}`}
      </p>
      {ticket.notes && (
        <p className="mt-2 rounded-lg bg-muted/70 px-2.5 py-2 text-xs italic">
          {ticket.notes}
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-1.5">
        {(ticket.items ?? []).map((it) => (
          <li
            key={it.id}
            className="flex items-baseline justify-between gap-2 rounded-lg border border-border px-2.5 py-2 text-sm"
          >
            <span>
              {it.quantity ?? 1}× {it.product_name}
            </span>
            {it.station_name && (
              <span className="text-[11px] text-muted-foreground">{it.station_name}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-auto flex gap-2 pt-4">
        {ticket.status === "PENDING" && (
          <button
            type="button"
            disabled={busy}
            onClick={onStart}
            className="h-10 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Empezar
          </button>
        )}
        {ticket.status === "PREPARING" && (
          <button
            type="button"
            disabled={busy}
            onClick={onReady}
            className="h-10 flex-1 rounded-xl bg-success text-sm font-semibold text-white disabled:opacity-50"
          >
            Marcar listo
          </button>
        )}
        {ticket.status === "READY" && (
          <button
            type="button"
            disabled={busy}
            onClick={onDeliver}
            className="h-10 flex-1 rounded-xl bg-foreground text-sm font-semibold text-background disabled:opacity-50"
          >
            Entregar
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="h-10 rounded-xl px-3 text-sm text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inventario (alertas + buscador)                                    */
/* ------------------------------------------------------------------ */

function InventoryPanel({ initialSearch }: { initialSearch?: string }) {
  const [tab, setTab] = useState<"low" | "out" | "all">(
    initialSearch ? "all" : "low",
  );
  const [search, setSearch] = useState(initialSearch ?? "");
  const [debounced, setDebounced] = useState(search);
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const low = useQuery({ queryKey: ["inventory", "low-stock"], queryFn: fetchLowStock, staleTime: 30_000 });
  const out = useQuery({ queryKey: ["inventory", "out-of-stock"], queryFn: fetchOutOfStock, staleTime: 30_000 });
  const all = useQuery({
    queryKey: ["inventory", "search", debounced],
    queryFn: () => fetchProductInventory({ search: debounced || undefined, page_size: 60 }),
    enabled: tab === "all",
    staleTime: 20_000,
  });

  const active = tab === "low" ? low : tab === "out" ? out : all;
  const items = active.data ?? [];
  const selected = items.find((p) => p.id === openId) ?? null;

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      {selected && (
        <div className="absolute inset-0 z-10 flex flex-col overflow-y-auto bg-card p-3 text-card-foreground">
          <button
            type="button"
            onClick={() => setOpenId(null)}
            className="mb-3 w-fit rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            ← Volver
          </button>
          <p className="text-sm font-semibold">{selected.name}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {selected.category_name || "Sin categoría"}
            {selected.code ? ` · ${selected.code}` : ""}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">Disponible</p>
              <p className="text-lg font-bold tabular-nums">
                {Number(selected.stock_available ?? selected.quantity ?? 0)}
              </p>
            </div>
            <div className="rounded-lg border border-border px-2.5 py-2">
              <p className="text-[10px] text-muted-foreground">Mínimo</p>
              <p className="text-lg font-bold tabular-nums">
                {Number(selected.minimum_stock ?? 0)}
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="flex shrink-0 gap-1 px-3 pt-2.5">
        {(
          [
            { k: "low", label: `Stock bajo${low.data?.length ? ` (${low.data.length})` : ""}` },
            { k: "out", label: `Sin stock${out.data?.length ? ` (${out.data.length})` : ""}` },
            { k: "all", label: "Buscar" },
          ] as const
        ).map((t) => (
          <button
            key={t.k}
            type="button"
            onClick={() => setTab(t.k)}
            className={cn(
              "h-8 rounded-lg px-2.5 text-[11px] font-medium transition-colors",
              tab === t.k
                ? "bg-primary text-primary-foreground"
                : "text-foreground/70 hover:bg-white/40",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "all" && (
        <div className="shrink-0 px-3 pt-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o código…"
            className="h-9"
            autoFocus
          />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {active.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            {tab === "low" && "Sin alertas de stock bajo. Todo sano."}
            {tab === "out" && "Nada agotado. La alacena está llena."}
            {tab === "all" && "Sin resultados para esa búsqueda."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((p) => {
              const stock = Number(p.stock_available ?? p.quantity ?? 0);
              const min = Number(p.minimum_stock ?? 0);
              const critical = stock <= 0;
              return (
                <li
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setOpenId(p.id);
                  }}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-card-foreground shadow-sm hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.category_name || "Sin categoría"}
                      {p.code ? ` · ${p.code}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      critical
                        ? "bg-danger/15 text-danger"
                        : stock <= min
                          ? "bg-warning/15 text-warning"
                          : "bg-success/15 text-success",
                    )}
                  >
                    {(critical || stock <= min) && <TriangleAlert className="h-3 w-3" />}
                    {stock} / mín {min}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Catálogo: galería de productos con gestión rápida (en venta sí/no) */
/* ------------------------------------------------------------------ */

function CatalogPanel() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", "catalog-panel", debounced],
    queryFn: () =>
      searchProductsForSale(
        debounced.trim().length >= 2 ? { search: debounced.trim() } : {},
      ),
    staleTime: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, on }: { id: number; on: boolean }) =>
      updateProduct(id, { is_for_sale: on }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Catálogo actualizado");
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo actualizar"),
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en el catálogo…"
          className="h-9"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-xl" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="py-12 text-center text-xs text-muted-foreground">
            Sin productos para mostrar.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {products.map((p) => (
              <CatalogCard
                key={p.id}
                product={p}
                busy={toggleMutation.isPending}
                onToggle={(on) => toggleMutation.mutate({ id: p.id, on })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CatalogCard({
  product,
  busy,
  onToggle,
}: {
  product: ProductForSale;
  busy: boolean;
  onToggle: (on: boolean) => void;
}) {
  const img = mediaUrl(product.primary_image || null);
  const stock = Number(product.stock_available ?? product.quantity ?? 0);
  const forSale = product.is_for_sale !== false;
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm">
      <div className="relative aspect-square w-full overflow-hidden bg-black/20">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-[repeating-linear-gradient(90deg,transparent,transparent_7px,rgba(0,0,0,0.06)_7px,rgba(0,0,0,0.06)_8px)] text-center">
            <div className="grid h-[72%] w-[72%] place-items-center rounded-lg border-2 border-dashed border-foreground/25 bg-black/15">
              <div>
                <p className="text-4xl font-black tracking-tight text-foreground/80">
                  {(product.name.trim()[0] ?? "·").toUpperCase()}
                </p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Sin foto
                </p>
              </div>
            </div>
          </div>
        )}
        {product.is_low_stock && (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-warning/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
            <TriangleAlert className="h-2.5 w-2.5" />
            Bajo
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 p-2.5">
        <p className="truncate text-xs font-semibold" title={product.name}>
          {product.name}
        </p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold tabular-nums text-primary">
            {formatCLP(Number(product.price ?? 0))}
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            stock {stock}
          </span>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggle(!forSale)}
          className={cn(
            "mt-1 h-7 rounded-md text-[10px] font-semibold transition-colors disabled:opacity-50",
            forSale
              ? "bg-success/15 text-success hover:bg-success/25"
              : "bg-danger/15 text-danger hover:bg-danger/25",
          )}
        >
          {forSale ? "En venta · quitar" : "Fuera de venta · poner"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entregados del día (cocina)                                        */
/* ------------------------------------------------------------------ */

function isToday(iso: string | null | undefined) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Tickets de cocina entregados hoy (compartido con la ventanilla 3D). */
export function useDeliveredToday(enabled = true) {
  const { data: delivered = [] } = useQuery({
    queryKey: ["kitchen-tickets", "delivered-today"],
    queryFn: () => fetchKitchenTickets("DELIVERED"),
    refetchInterval: 15_000,
    staleTime: 10_000,
    enabled,
  });
  return useMemo(
    () =>
      !enabled
        ? []
        : delivered
            .filter((t) => isToday(t.completed_at))
            .sort(
              (a, b) =>
                new Date(b.completed_at ?? 0).getTime() -
                new Date(a.completed_at ?? 0).getTime(),
            ),
    [delivered, enabled],
  );
}

function DeliveriesPanel() {
  const delivered = useDeliveredToday();

  return (
    <div className="h-full min-h-0 overflow-y-auto p-3">
      {delivered.length === 0 ? (
        <div className="grid place-items-center py-12 text-center">
          <PackageCheck className="h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-xs text-muted-foreground">
            Aún no se entrega nada hoy. La cocina está a tiempo.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {delivered.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-border bg-card px-2.5 py-2 text-card-foreground shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold">{kitchenTicketCode(t)}</p>
                <span className="text-[10px] tabular-nums text-success">
                  {t.completed_at
                    ? new Date(t.completed_at).toLocaleTimeString("es-CL", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "--:--"}
                </span>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {t.items.map((i) => `${i.quantity ?? 1}× ${i.product_name}`).join(", ")}
              </p>
              {t.prepared_by_name && (
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  por {t.prepared_by_name}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Caja registradora (estado actual)                                  */
/* ------------------------------------------------------------------ */

function CashPanel({ stationId }: { stationId?: number | null }) {
  const current = useQuery({
    queryKey: ["cash-register", "current", stationId ?? "any"],
    queryFn: () => getCurrentCashRegister(stationId),
    staleTime: 20_000,
  });
  const lastClosed = useQuery({
    queryKey: ["cash-register", "last-closed", stationId ?? "any"],
    queryFn: () => getLastClosedCashRegister(stationId),
    enabled: current.data === null,
    staleTime: 60_000,
  });

  if (current.isLoading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
    );
  }

  const reg = current.data;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-3">
      {reg ? (
        <>
          <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-success">Caja abierta</span>
              <span className="text-[10px] text-muted-foreground">
                {reg.station_name || "Estación principal"}
              </span>
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-success">
              {formatCLP(Number(reg.expected_amount ?? reg.opening_amount ?? 0))}
            </p>
            <p className="text-[10px] text-muted-foreground">esperado en efectivo</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border bg-muted/60 px-2.5 py-2 text-card-foreground">
              <p className="text-[10px] text-muted-foreground">Apertura</p>
              <p className="text-sm font-bold tabular-nums">
                {formatCLP(Number(reg.opening_amount ?? 0))}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/60 px-2.5 py-2 text-card-foreground">
              <p className="text-[10px] text-muted-foreground">Abierta por</p>
              <p className="truncate text-sm font-semibold">
                {reg.opened_by_name || "—"}
              </p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Fecha: {reg.date || "hoy"} · El arqueo y cierre se hacen desde Caja en el
            menú lateral.
          </p>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-muted/60 px-3 py-4 text-center text-card-foreground">
            <Banknote className="mx-auto h-7 w-7 text-muted-foreground/60" />
            <p className="mt-2 text-xs font-semibold">No hay caja abierta</p>
            <p className="text-[10px] text-muted-foreground">
              Ábrela desde el menú Caja para empezar a vender.
            </p>
          </div>
          {lastClosed.data && (
            <div className="rounded-lg border border-border bg-muted/60 px-2.5 py-2 text-card-foreground">
              <p className="text-[10px] text-muted-foreground">Último cierre</p>
              <p className="text-sm font-bold tabular-nums">
                {formatCLP(Number(lastClosed.data.closing_amount ?? 0))}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {lastClosed.data.date} · {lastClosed.data.closed_by_name || "—"}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ventas / Órdenes abiertas (burbuja inmersiva)                       */
/* ------------------------------------------------------------------ */

function OrdersPanel({
  onLocateTable,
  tableLabel,
  canGoPos = true,
}: {
  onLocateTable?: (tableId: number) => void;
  tableLabel?: (tableId: number) => string | null;
  canGoPos?: boolean;
}) {
  const pathname = usePathname();
  const returnTo = encodeURIComponent(pathname || "/tables/map");
  const { data, isLoading } = useQuery({
    queryKey: ["orders", "salon-open"],
    queryFn: () =>
      fetchOrders({
        payment_status: ["PENDING", "PARTIAL"],
        ordering: "-date",
        page_size: 30,
      }),
    refetchInterval: 15_000,
  });

  const orders = useMemo(
    () => (data?.results ?? []).filter((o) => o.status !== "CANCELLED"),
    [data],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 border-b border-border/60 px-3 py-2 text-[11px] text-muted-foreground">
        Ventas y órdenes activas
        {canGoPos ? " · tocá una para ver o ir a la caja" : " · tocá una para ver el detalle"}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="grid place-items-center py-12 text-center">
            <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-xs text-muted-foreground">
              No hay ventas ni órdenes abiertas.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {orders.map((o) => (
              <OrderRow
                key={o.id}
                order={o}
                returnTo={returnTo}
                canGoPos={canGoPos}
                onLocateTable={onLocateTable}
                tableLabel={tableLabel}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OrderRow({
  order,
  returnTo,
  canGoPos,
  onLocateTable,
  tableLabel,
}: {
  order: import("@/lib/api/types").YggdraSchemas["Order"];
  returnTo: string;
  canGoPos: boolean;
  onLocateTable?: (tableId: number) => void;
  tableLabel?: (tableId: number) => string | null;
}) {
  const router = useRouter();
  const elapsed = useElapsedTime(order.date ?? null, { enabled: true });
  const [open, setOpen] = useState(false);
  const { data: detail, isLoading, isError, isFetching } = useQuery({
    queryKey: ["order", order.id],
    queryFn: () => fetchOrder(order.id),
    enabled: open,
    staleTime: 20_000,
  });
  const tableText = order.table ? (tableLabel?.(order.table) ?? null) : null;
  const lines = detail?.products ?? order.products ?? [];
  const loading = open && (isLoading || isFetching) && lines.length === 0;
  const kind = order.order_type ?? "ORDER";
  const isSale = kind === "SALE";
  const stationHref = `/pos/terminal?order_id=${order.id}&return_to=${returnTo}`;

  return (
    <li className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
      >
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white",
                isSale ? "bg-primary" : "bg-sky-500",
              )}
            >
              {isSale ? (
                <ShoppingBag className="h-2.5 w-2.5" />
              ) : (
                <ClipboardList className="h-2.5 w-2.5" />
              )}
              {orderTypeLabel(kind)}
            </span>
            <p className="truncate text-xs font-semibold">
              {order.order_number ? `#${order.order_number}` : `#${order.id.slice(0, 8)}`}
              {tableText ? <span className="text-primary"> · Mesa {tableText}</span> : ""}
            </p>
          </div>
          <p className="truncate text-[10px] text-muted-foreground">
            {order.client?.name || "Sin cliente"} · {elapsed.text}
          </p>
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums text-success">
          {formatCLP(order.total_amount ?? 0)}
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-2.5 py-2">
          {loading ? (
            <p className="text-[11px] text-muted-foreground">Cargando detalle…</p>
          ) : isError ? (
            <p className="text-[11px] text-danger">No se pudo cargar el detalle.</p>
          ) : lines.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Sin productos.</p>
          ) : (
            <ul className="mb-2 flex flex-col gap-1">
              {lines.map((it) => (
                <li key={it.id} className="flex justify-between gap-2 text-[12px]">
                  <span>
                    {it.quantity ?? 1}× {it.product_name}
                  </span>
                  {it.unit_price != null && (
                    <span className="tabular-nums text-muted-foreground">
                      {formatCLP(it.unit_price)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1 flex flex-wrap gap-1.5">
            {canGoPos && (
              <button
                type="button"
                onClick={() => router.push(stationHref)}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-2 text-[11px] font-semibold text-primary-foreground hover:brightness-110"
              >
                <ExternalLink className="h-3 w-3" />
                Ir a la caja
              </button>
            )}
            {order.table && onLocateTable && (
              <button
                type="button"
                onClick={() => onLocateTable(order.table as number)}
                className="inline-flex h-8 items-center justify-center rounded-xl border border-border bg-card px-2.5 text-[11px] font-medium text-foreground hover:bg-muted"
              >
                Ver mesa
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
