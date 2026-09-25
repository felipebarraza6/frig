"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Billboard, Html, OrbitControls, Text } from "@react-three/drei";
import * as THREE from "three";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, Calendar, CheckCircle2, Clock, Crosshair, Eye, Maximize2, Minimize2, MousePointer2, Move, Pencil, PersonStanding, Plus, Sparkles, X } from "lucide-react";
import { cn, formatCLP } from "@/lib/utils";
import { useElapsedTime } from "@/lib/hooks/useElapsedTime";
import { fetchOrder, fetchOrders } from "@/lib/api/orders";
import { fetchLowStock, fetchOutOfStock } from "@/lib/api/inventory";
import { getCashRegisters, getCurrentCashRegister } from "@/lib/api/cash-register";
import { fetchCashRegisterStations } from "@/lib/api/cash-register-stations";
import {
  bulkUpdateTableStatus,
  cleanTable,
  freeTable,
  reserveTable,
  updateTable,
  type TableStatus,
} from "@/lib/api/tables";
import { mediaUrl } from "@/lib/api/client";
import { useCurrentBranch, useSessionStore } from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { fetchKitchenTickets } from "@/lib/api/kitchen";
import { fetchKitchenStations } from "@/lib/api/kitchen-stations";
import {
  TABLE_MAP_WIDTH,
  TABLE_MAP_HEIGHT,
  tableDimensions,
  needsTableAutoLayout,
  layoutTables,
  softPlaceTable,
  clampTablePosFree,
  salonMapBounds,
  tableRect,
  occupiedAreaRatio,
  densityFitScale,
  type TableRect,
} from "@/lib/tables/layout";
import type { YggdraSchemas } from "@/lib/api/types";
import {
  SalonFloor,
  SalonLights,
  BlobShadow,
  useSalonTheme,
} from "@/components/tables/salon/salon-environment";
import {
  KdsScreen3D,
  OrdersCounter3D,
  salonWallH,
  type HotspotHoverInfo,
  type SalonOverlayKind,
} from "@/components/tables/salon/venue-screens";
import {
  InventoryMonitor3D,
  DeliveryWindow3D,
  PosBar3D,
} from "@/components/tables/salon/venue-monitors";
import {
  CatalogTotem3D,
  useCatalogProducts,
} from "@/components/tables/salon/catalog-totem";
import {
  SalonOverlays,
  useDeliveredToday,
  type SalonWindow,
} from "@/components/tables/salon/salon-overlays";
import { useSalonCapabilities } from "@/components/tables/salon/salon-modules";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/lib/store/toast";
import { HeroPlexus } from "@/components/landing/hero-plexus";

const SALON_UI_KEY = "frig.salon.ui.v1";

type SalonUiPersist = {
  windows: SalonWindow[];
  zOrder: Record<string, number>;
  fullscreenId: string | null;
  zTick: number;
  camera?: { pos: [number, number, number]; target: [number, number, number] };
};

function loadSalonUi(): SalonUiPersist | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SALON_UI_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SalonUiPersist;
  } catch {
    return null;
  }
}

function saveSalonUi(state: SalonUiPersist) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SALON_UI_KEY, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

type TableItem = YggdraSchemas["Table"];
type TableShape = NonNullable<TableItem["shape"]>;

const CANVAS_WIDTH = TABLE_MAP_WIDTH;
const CANVAS_HEIGHT = TABLE_MAP_HEIGHT;
/** px del mapa → unidades world (salón) */
const SCALE = 0.04;
/** Escala visual de la mesa vs su footprint de layout (proporción real del local). */
const TABLE_MESH_SCALE = 0.94;

const STATUS_LABELS: Record<string, string> = {
  FREE: "Libre",
  OCCUPIED: "Ocupada",
  RESERVED: "Reservada",
  CLEANING: "Limpieza",
  OUT_OF_SERVICE: "Fuera de servicio",
};

const STATUS_HEX: Record<string, string> = {
  FREE: "#22c55e",
  OCCUPIED: "#c67d52", // fallback; se pinta con brand-primary en runtime
  RESERVED: "#f59e0b",
  CLEANING: "#38bdf8",
  OUT_OF_SERVICE: "#94a3b8",
};

function mapToWorld(
  x: number,
  y: number,
  originX: number,
  originY: number,
): [number, number, number] {
  return [(x - originX) * SCALE, 0, (y - originY) * SCALE];
}

function worldToMap(
  wx: number,
  wz: number,
  originX: number,
  originY: number,
): { x: number; y: number } {
  return {
    x: wx / SCALE + originX,
    y: wz / SCALE + originY,
  };
}

/** Tamaño del salón según mesas: padding fijo, límites min/max. */
function computeSalonBounds(
  tables: TableItem[],
  positions: Map<number, { x: number; y: number }>,
) {
  if (tables.length === 0) {
    return { roomW: 520, roomH: 420, originX: 260, originY: 210 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of tables) {
    const pos = positions.get(t.id) ?? { x: t.x_position ?? 0, y: t.y_position ?? 0 };
    const dims = tableDimensions(t.capacity || 4, t.shape);
    // footprint visual aproximado (layout + boost)
    const fw = dims.width * TABLE_MESH_SCALE;
    const fh = dims.height * TABLE_MESH_SCALE;
    const cx = pos.x + dims.width / 2;
    const cy = pos.y + dims.height / 2;
    minX = Math.min(minX, cx - fw / 2);
    minY = Math.min(minY, cy - fh / 2);
    maxX = Math.max(maxX, cx + fw / 2);
    maxY = Math.max(maxY, cy + fh / 2);
  }
  const contentW = Math.max(80, maxX - minX);
  const contentH = Math.max(80, maxY - minY);
  const pad = MathUtilsClamp(130 + tables.length * 10, 140, 240);
  const roomW = MathUtilsClamp(contentW + pad * 2, 420, 1100);
  const roomH = MathUtilsClamp(contentH + pad * 2, 360, 900);
  const originX = (minX + maxX) / 2;
  const originY = (minY + maxY) / 2;
  return { roomW, roomH, originX, originY };
}

function MathUtilsClamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

interface TablesCanvasProps {
  tables: TableItem[];
  mode?: "edit" | "select";
  selectedTableId?: number | null;
  onMove?: (id: number, x: number, y: number) => void;
  onSelect?: (table: TableItem) => void;
  resolvedPositions?: Map<number, { x: number; y: number }>;
  /** Permite mover/editar mesas desde el menú de hover. */
  canManage?: boolean;
  /** Crea una mesa en el mapa (formulario + preview 3D). */
  onCreate?: (data: {
    number: string;
    capacity: number;
    shape: TableShape;
    x: number;
    y: number;
  }) => void;
  createBusy?: boolean;
  suggestedNumber?: string;
  immersive?: boolean;
  onToggleImmersive?: () => void;
}

export function TablesCanvas({
  tables,
  mode = "select",
  selectedTableId,
  onMove,
  onSelect,
  resolvedPositions,
  canManage = false,
  onCreate,
  createBusy = false,
  suggestedNumber = "1",
  immersive = false,
  onToggleImmersive,
}: TablesCanvasProps) {
  const { primary: brandPrimary, isDark } = useSalonTheme();
  const theme = useSessionStore((s) => s.theme);
  const branch = useCurrentBranch();
  const venueName = theme?.app_name || (branch ? branchName(branch) : "Local");
  const logoUrl = mediaUrl(theme?.logo ?? null);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [menuTableId, setMenuTableId] = useState<number | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 24, y: 24 });
  const [hotspotHover, setHotspotHover] = useState<HotspotHoverInfo | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 24, y: 24 });
  const skipFloorWalkUntil = useRef(0);

  const savedUi = useRef(loadSalonUi());
  const [windows, setWindows] = useState<SalonWindow[]>(
    () => savedUi.current?.windows ?? [],
  );
  const [fullscreenId, setFullscreenId] = useState<string | null>(
    () => savedUi.current?.fullscreenId ?? null,
  );
  const [zOrder, setZOrder] = useState<Record<string, number>>(
    () => savedUi.current?.zOrder ?? {},
  );
  const zTick = useRef(savedUi.current?.zTick ?? 1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cameraStateRef = useRef(savedUi.current?.camera ?? null);
  const [movingId, setMovingId] = useState<number | null>(null);
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);
  const [draft, setDraft] = useState<{
    x: number;
    y: number;
    number: string;
    capacity: number;
    shape: TableShape;
  } | null>(null);
  const createWasBusy = useRef(false);
  const toast = useToast();
  const queryClient = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      action,
    }: {
      id: number;
      action: "free" | "reserve" | "clean" | "out";
    }) => {
      if (action === "free") return freeTable(id);
      if (action === "reserve") return reserveTable(id);
      if (action === "clean") return cleanTable(id);
      return bulkUpdateTableStatus([id], "OUT_OF_SERVICE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo cambiar el estado"),
  });

  const positions = useMemo(() => {
    if (resolvedPositions) return resolvedPositions;
    if (!needsTableAutoLayout(tables)) {
      return new Map(
        tables.map((t) => [t.id, { x: t.x_position ?? 0, y: t.y_position ?? 0 }]),
      );
    }
    return new Map(layoutTables(tables).map((p) => [p.id, { x: p.x, y: p.y }]));
  }, [tables, resolvedPositions]);

  const neighborRects = useMemo(
    () =>
      tables.map((t) => ({
        id: t.id,
        ...tableRect(t, positions.get(t.id)),
      })),
    [tables, positions],
  );
  const salonFit = densityFitScale(
    occupiedAreaRatio(
      draft
        ? [...tables, { capacity: draft.capacity, shape: draft.shape }]
        : tables,
    ),
  );

  const snapDraftSize = useCallback(
    (
      cur: { x: number; y: number; capacity: number; shape: TableShape },
      next: { capacity?: number; shape?: TableShape },
      bounds?: ReturnType<typeof salonMapBounds> | null,
    ) => {
      const capacity = next.capacity ?? cur.capacity;
      const shape = next.shape ?? cur.shape;
      const prev = tableDimensions(cur.capacity, cur.shape);
      const dims = tableDimensions(capacity, shape);
      const slot = softPlaceTable(
        cur.x + prev.width / 2 - dims.width / 2,
        cur.y + prev.height / 2 - dims.height / 2,
        dims.width,
        dims.height,
        bounds,
      );
      return { capacity, shape, x: slot.x, y: slot.y };
    },
    [],
  );

  const hoveredTable = useMemo(
    () => tables.find((t) => t.id === hoveredId) ?? null,
    [tables, hoveredId],
  );
  const menuTable = useMemo(
    () => tables.find((t) => t.id === menuTableId) ?? null,
    [tables, menuTableId],
  );

  // Tooltip del cursor: hotspots. Las mesas usan el menú clavado (clickeable).
  const hoverInfo: HotspotHoverInfo | null = movingId || menuTable
    ? null
    : hotspotHover;

  const salon = useMemo(
    () => computeSalonBounds(tables, positions),
    [tables, positions],
  );
  const placeBounds = useMemo(
    () => salonMapBounds(salon.originX, salon.originY, salon.roomW, salon.roomH),
    [salon.originX, salon.originY, salon.roomW, salon.roomH],
  );
  const roomWorldW = salon.roomW * SCALE;
  const roomWorldH = salon.roomH * SCALE;
  const wallH = salonWallH(roomWorldW, roomWorldH);

  const camDist = Math.max(14, Math.max(roomWorldW, roomWorldH) * 1.08);
  // Vista cercana al cargar (altura persona)
  const camPos = useMemo<[number, number, number]>(
    () => [0, 1.72, Math.max(4.6, roomWorldH * 0.42)],
    [roomWorldH],
  );
  const camTarget = useMemo<[number, number, number]>(
    () => [0, 1.32, -roomWorldH * 0.06],
    [roomWorldH],
  );
  // Vista “reiniciar”: salón completo desde lejos
  const homePos = useMemo<[number, number, number]>(() => {
    const span = Math.max(roomWorldW, roomWorldH);
    return [0, Math.max(11, span * 0.55), Math.max(18, span * 0.85)];
  }, [roomWorldW, roomWorldH]);
  const homeTarget = useMemo<[number, number, number]>(() => [0, 0.35, 0], []);
  const [homeTick, setHomeTick] = useState(0);
  const [personTick, setPersonTick] = useState(0);
  const [viewMode, setViewMode] = useState<"person" | "overview">("person");

  const goOverview = useCallback(() => {
    setViewMode("overview");
    setHomeTick((n) => n + 1);
  }, []);
  const goPerson = useCallback(() => {
    setViewMode("person");
    setPersonTick((n) => n + 1);
  }, []);

  const salonCaps = useSalonCapabilities();

  const { data: kitchenStations = [] } = useQuery({
    queryKey: ["kitchen-stations"],
    queryFn: fetchKitchenStations,
    staleTime: 60_000,
    enabled: salonCaps.kitchen,
  });
  const { data: kitchenTickets = [] } = useQuery({
    queryKey: ["kitchen-tickets", "map-feed"],
    queryFn: () => fetchKitchenTickets(),
    refetchInterval: 12_000,
    staleTime: 8_000,
    enabled: salonCaps.kitchen,
  });
  const liveTickets = useMemo(
    () =>
      salonCaps.kitchen
        ? kitchenTickets.filter(
            (t) =>
              t.status === "PENDING" ||
              t.status === "PREPARING" ||
              t.status === "READY",
          )
        : [],
    [kitchenTickets, salonCaps.kitchen],
  );
  const { data: lowStock = [] } = useQuery({
    queryKey: ["inventory", "low-stock"],
    queryFn: fetchLowStock,
    staleTime: 60_000,
    enabled: salonCaps.inventory,
  });
  const { data: outOfStock = [] } = useQuery({
    queryKey: ["inventory", "out-of-stock"],
    queryFn: fetchOutOfStock,
    staleTime: 60_000,
    enabled: salonCaps.inventory,
  });
  const deliveredToday = useDeliveredToday(salonCaps.deliveries);
  const { data: cashRegister } = useQuery({
    queryKey: ["cash-register", "current"],
    queryFn: () => getCurrentCashRegister(),
    refetchInterval: 30_000,
    enabled: salonCaps.cash,
  });
  const { data: posStations = [] } = useQuery({
    queryKey: ["cash-register-stations"],
    queryFn: fetchCashRegisterStations,
    staleTime: 60_000,
    enabled: salonCaps.cash,
  });
  const { data: openRegistersPage } = useQuery({
    queryKey: ["cash-registers", "open-list"],
    queryFn: () => getCashRegisters({ status: "OPEN", page_size: 50 }),
    refetchInterval: 30_000,
    enabled: salonCaps.cash,
  });
  const posItems = useMemo(() => {
    if (!salonCaps.cash) return [];
    const open = openRegistersPage?.results ?? [];
    const active = posStations.filter((s) => s.is_active !== false);
    if (active.length === 0) {
      return [{ id: null, name: "Caja", register: cashRegister ?? null }];
    }
    return active.map((s) => ({
      id: s.id,
      name: s.name,
      register: open.find((r) => Number(r.station) === s.id) ?? null,
    }));
  }, [posStations, openRegistersPage, cashRegister, salonCaps.cash]);
  const { data: openOrdersPage } = useQuery({
    queryKey: ["orders", "salon-open-count"],
    queryFn: () =>
      fetchOrders({ payment_status: ["PENDING", "PARTIAL"], page_size: 1 }),
    refetchInterval: 20_000,
    enabled: salonCaps.orders,
  });
  const openOrdersCount = salonCaps.orders ? (openOrdersPage?.count ?? 0) : 0;
  const catalogProducts = useCatalogProducts(salonCaps.catalog);

  // Si un módulo se apaga, cerrar ventanas huérfanas (p. ej. cocina sin production)
  useEffect(() => {
    setWindows((prev) => {
      const next = prev.filter((w) => salonCaps[w.kind]);
      return next.length === prev.length ? prev : next;
    });
  }, [
    salonCaps.kitchen,
    salonCaps.inventory,
    salonCaps.orders,
    salonCaps.catalog,
    salonCaps.deliveries,
    salonCaps.cash,
  ]);

  const focusWindow = useCallback((id: string) => {
    zTick.current += 1;
    setZOrder((prev) => ({ ...prev, [id]: zTick.current }));
  }, []);

  const handleActivate = useCallback(
    (kind: SalonOverlayKind, stationId?: number | null) => {
      if (!salonCaps[kind]) return;
      const id =
        kind === "kitchen" && stationId != null
          ? `kitchen-${stationId}`
          : kind === "cash" && stationId != null
            ? `cash-${stationId}`
            : kind;
      const panelW = kind === "kitchen" || kind === "catalog" ? 640 : 360;
      const panelH = 420;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
      const vh = typeof window !== "undefined" ? window.innerHeight : 800;
      const raw = pointerRef.current;
      const x = Math.max(8, Math.min(vw - panelW - 8, raw.x - 24));
      const y = Math.max(8, Math.min(vh - panelH - 8, raw.y - 16));
      const spawn = performance.now();
      setWindows((prev) => {
        const existing = prev.find((w) => w.id === id);
        if (existing) {
          return prev.map((w) =>
            w.id === id ? { ...w, x, y, spawn } : w,
          );
        }
        return [
          ...prev,
          {
            id,
            kind,
            kitchenStationId: kind === "kitchen" ? (stationId ?? null) : null,
            cashStationId: kind === "cash" ? (stationId ?? null) : null,
            inventorySearch: undefined,
            x,
            y,
            spawn,
          },
        ];
      });
      focusWindow(id);
    },
    [focusWindow, salonCaps],
  );

  const closeWindow = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    setFullscreenId((cur) => (cur === id ? null : cur));
  }, []);

  const toggleWindowFs = useCallback((id: string) => {
    setFullscreenId((cur) => (cur === id ? null : id));
    focusWindow(id);
  }, [focusWindow]);

  const toggleSceneFs = useCallback(() => {
    onToggleImmersive?.();
  }, [onToggleImmersive]);

  useEffect(() => {
    saveSalonUi({
      windows,
      zOrder,
      fullscreenId,
      zTick: zTick.current,
      camera: cameraStateRef.current ?? undefined,
    });
  }, [windows, zOrder, fullscreenId]);

  useEffect(() => {
    const flush = () => {
      saveSalonUi({
        windows,
        zOrder,
        fullscreenId,
        zTick: zTick.current,
        camera: cameraStateRef.current ?? undefined,
      });
    };
    window.addEventListener("beforeunload", flush);
    const id = window.setInterval(flush, 2500);
    return () => {
      window.removeEventListener("beforeunload", flush);
      window.clearInterval(id);
      flush();
    };
  }, [windows, zOrder, fullscreenId]);

  useEffect(() => {
    if (createBusy) {
      createWasBusy.current = true;
      return;
    }
    if (createWasBusy.current) {
      createWasBusy.current = false;
      setDraft(null);
    }
  }, [createBusy]);

  // Hover estricto: mesa y menú HTML son fuentes distintas.
  // Solo se apaga cuando las DOS sueltan (si no, el Html parpadea).
  const hoverTimeout = useRef<number>(0);
  const hoverMeshId = useRef<number | null>(null);
  const hoverMenuId = useRef<number | null>(null);
  const menuTableIdRef = useRef<number | null>(null);
  const applyTableHover = useCallback(() => {
    window.clearTimeout(hoverTimeout.current);
    const id = hoverMenuId.current ?? hoverMeshId.current;
    if (id !== null) {
      setHoveredId(id);
      return;
    }
    hoverTimeout.current = window.setTimeout(() => {
      if (hoverMenuId.current != null || hoverMeshId.current != null) return;
      setHoveredId(null);
    }, 360);
  }, []);
  const handleTableHover = useCallback(
    (tableId: number, source: "mesh" | "menu", inside: boolean) => {
      const slot = source === "menu" ? hoverMenuId : hoverMeshId;
      if (inside) {
        slot.current = tableId;
        setMenuPos({ x: pointerRef.current.x, y: pointerRef.current.y });
      } else if (slot.current === tableId) {
        slot.current = null;
      }
      applyTableHover();
    },
    [applyTableHover],
  );

  const handleTableMenu = useCallback((id: number) => {
    skipFloorWalkUntil.current = performance.now() + 450;
    if (menuTableIdRef.current === id) {
      window.clearTimeout(hoverTimeout.current);
      hoverMeshId.current = null;
      hoverMenuId.current = null;
      menuTableIdRef.current = null;
      setMenuTableId(null);
      return;
    }
    menuTableIdRef.current = id;
    setMenuTableId(id);
    setHoveredId(id);
    setMenuPos({ x: pointerRef.current.x, y: pointerRef.current.y });
  }, []);

  const closeTableMenu = useCallback(() => {
    window.clearTimeout(hoverTimeout.current);
    hoverMeshId.current = null;
    hoverMenuId.current = null;
    menuTableIdRef.current = null;
    setHoveredId(null);
    setMenuTableId(null);
  }, []);

  useEffect(() => {
    const isTyping = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      );
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;

      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        goOverview();
        return;
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        goPerson();
        return;
      }
      if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        if (viewMode === "overview") goPerson();
        else goOverview();
        return;
      }

      if (e.key !== "Escape" || movingId) return;
      if (fullscreenId) {
        setFullscreenId(null);
        return;
      }
      if (draft) {
        setDraft(null);
        return;
      }
      if (editingTable) {
        setEditingTable(null);
        return;
      }
      if (windows.length > 0) {
        const top = [...windows].sort(
          (a, b) => (zOrder[b.id] ?? 0) - (zOrder[a.id] ?? 0),
        )[0];
        if (top) closeWindow(top.id);
        return;
      }
      closeTableMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    closeTableMenu,
    closeWindow,
    draft,
    editingTable,
    fullscreenId,
    goOverview,
    goPerson,
    movingId,
    viewMode,
    windows,
    zOrder,
  ]);

  const handleLocateTable = useCallback(
    (tableId: number) => {
      const table = tables.find((t) => t.id === tableId);
      if (!table) return;
      onSelect?.(table);
    },
    [tables, onSelect],
  );

  const tableLabel = useCallback(
    (tableId: number) => {
      const t = tables.find((x) => x.id === tableId);
      return t ? String(t.number) : null;
    },
    [tables],
  );

  return (
    <div
        ref={wrapRef}
        className={cn(
        "relative h-full min-h-[280px] w-full overflow-hidden rounded-2xl bg-background",
        movingId && "[&_canvas]:cursor-grabbing",
        !movingId &&
          mode === "select" &&
          (hoveredId || hotspotHover
            ? "[&_canvas]:cursor-pointer"
            : "[&_canvas]:cursor-default"),
      )}
      onContextMenu={(e) => e.preventDefault()}
      onPointerMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        pointerRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        const tip = tooltipRef.current;
        if (!tip) return;
        const x = Math.min(e.clientX - rect.left + 16, rect.width - 240);
        const y = Math.min(e.clientY - rect.top + 18, rect.height - 90);
        tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
      }}
    >
      {/* Fondo del render: nodos de la landing + tinte de marca */}
      <div className="absolute inset-0 overflow-hidden rounded-2xl border border-[var(--glass-border)] shadow-[var(--glass-shadow)]">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(130% 105% at 50% 18%, color-mix(in srgb, ${brandPrimary} 26%, #0a0c12), #07080c 82%)`,
          }}
        />
        <HeroPlexus
          idleBoost={4.2}
          className="pointer-events-none absolute inset-0 h-full w-full mix-blend-screen"
        />
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          camera={{ position: camPos, fov: 40, near: 0.1, far: 400 }}
          className="!absolute inset-0 touch-none"
          style={{ background: "transparent" }}
          onCreated={({ scene }) => {
            scene.background = null;
          }}
          onPointerMissed={closeTableMenu}
        >
          <Suspense fallback={null}>
            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.08}
              enablePan
              enableZoom
              minDistance={1.8}
              maxDistance={Math.max(48, camDist * 3.2)}
              minPolarAngle={0.12}
              maxPolarAngle={Math.PI / 2 - 0.04}
              minAzimuthAngle={-Infinity}
              maxAzimuthAngle={Infinity}
              enabled={!movingId}
              mouseButtons={{
                LEFT: THREE.MOUSE.ROTATE,
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: undefined,
              }}
            />
            <OrbitTargetInit target={camTarget} />
            <CameraHome
              tick={homeTick}
              position={homePos}
              target={homeTarget}
              onArrived={(pos, target) => {
                cameraStateRef.current = { pos, target };
              }}
            />
            <CameraHome
              tick={personTick}
              position={camPos}
              target={camTarget}
              onArrived={(pos, target) => {
                cameraStateRef.current = { pos, target };
              }}
            />
            <FloorExplore
              roomW={roomWorldW}
              roomH={roomWorldH}
              blocked={Boolean(hoveredId || menuTableId || hotspotHover || movingId)}
              cancelTick={homeTick + personTick}
              skipUntilRef={skipFloorWalkUntil}
            />
            <SalonCameraPersist
              initial={cameraStateRef.current}
              onChange={(cam) => {
                cameraStateRef.current = cam;
              }}
            />
            {canManage && onCreate && (
              <RightClickCreate
                originX={salon.originX}
                originY={salon.originY}
                blocked={Boolean(hoveredId || menuTableId || hotspotHover || movingId)}
                onCreateAt={(x, y) => {
                  setEditingTable(null);
                  closeTableMenu();
                  setMenuPos({ ...pointerRef.current });
                  setDraft((cur) => {
                    const capacity = cur?.capacity ?? 4;
                    const shape = cur?.shape ?? "ROUND";
                    const dims = tableDimensions(capacity, shape);
                    const slot = softPlaceTable(x, y, dims.width, dims.height, placeBounds);
                    return {
                      x: slot.x,
                      y: slot.y,
                      number: cur?.number || suggestedNumber,
                      capacity,
                      shape,
                    };
                  });
                }}
              />
            )}
            <SalonLights primary={brandPrimary} dark={isDark} />
            <SalonFloor
              primary={brandPrimary}
              dark={isDark}
              roomW={roomWorldW}
              roomH={roomWorldH}
            />

            <AmbientVenue
              primary={brandPrimary}
              logoUrl={logoUrl}
              venueName={venueName}
              roomW={roomWorldW}
              roomH={roomWorldH}
              dark={isDark}
            />

            {salonCaps.kitchen && (
              <KdsScreen3D
                primary={brandPrimary}
                dark={isDark}
                stations={kitchenStations}
                tickets={liveTickets}
                roomW={roomWorldW}
                roomH={roomWorldH}
                wallH={wallH}
                onActivate={handleActivate}
                onHoverChange={setHotspotHover}
              />
            )}
            {salonCaps.inventory && (
              <InventoryMonitor3D
                primary={brandPrimary}
                dark={isDark}
                roomW={roomWorldW}
                roomH={roomWorldH}
                lowStock={lowStock}
                outOfStock={outOfStock}
                onActivate={handleActivate}
                onHoverChange={setHotspotHover}
              />
            )}
            {salonCaps.orders && (
              <OrdersCounter3D
                primary={brandPrimary}
                dark={isDark}
                roomW={roomWorldW}
                roomH={roomWorldH}
                openCount={openOrdersCount}
                onActivate={handleActivate}
                onHoverChange={setHotspotHover}
              />
            )}
            {salonCaps.deliveries && (
              <DeliveryWindow3D
                primary={brandPrimary}
                dark={isDark}
                roomW={roomWorldW}
                roomH={roomWorldH}
                delivered={deliveredToday}
                onActivate={handleActivate}
                onHoverChange={setHotspotHover}
              />
            )}
            {salonCaps.cash && (
              <PosBar3D
                primary={brandPrimary}
                dark={isDark}
                roomW={roomWorldW}
                roomH={roomWorldH}
                stations={posItems}
                onActivate={handleActivate}
                onHoverChange={setHotspotHover}
              />
            )}
            {salonCaps.catalog && (
              <CatalogTotem3D
                primary={brandPrimary}
                dark={isDark}
                roomW={roomWorldW}
                roomH={roomWorldH}
                products={catalogProducts}
                onActivate={handleActivate}
                onHoverChange={setHotspotHover}
              />
            )}

            {draft && (
              <TableMesh
                table={
                  {
                    id: -1,
                    number: draft.number || suggestedNumber,
                    capacity: draft.capacity,
                    shape: draft.shape,
                    status: "FREE",
                    x_position: draft.x,
                    y_position: draft.y,
                  } as TableItem
                }
                mapX={draft.x}
                mapY={draft.y}
                originX={salon.originX}
                originY={salon.originY}
                mode="select"
                selected
                hovered
                brandPrimary={brandPrimary}
                moving={false}
                ghost
                fitScale={salonFit}
                neighbors={neighborRects}
                onHover={() => {}}
              />
            )}
            {tables.map((table) => {
              const pos = positions.get(table.id) ?? {
                x: table.x_position ?? 0,
                y: table.y_position ?? 0,
              };
              return (
                <TableMesh
                  key={table.id}
                  table={table}
                  mapX={pos.x}
                  mapY={pos.y}
                  originX={salon.originX}
                  originY={salon.originY}
                  placeBounds={placeBounds}
                  mode={mode}
                  selected={selectedTableId === table.id}
                  hovered={hoveredId === table.id || menuTableId === table.id}
                  brandPrimary={brandPrimary}
                  moving={movingId === table.id}
                  fitScale={salonFit}
                  neighbors={neighborRects.filter((r) => r.id !== table.id)}
                  showActions={
                    mode === "select" && !movingId && menuTableId === table.id
                  }
                  canManage={canManage}
                  onHover={handleTableHover}
                  onMenu={handleTableMenu}
                  onView={() => {
                    onSelect?.(table);
                    closeTableMenu();
                  }}
                  onStartMove={() => {
                    setMovingId(table.id);
                    closeTableMenu();
                  }}
                  onEdit={() => {
                    setMenuPos({ ...pointerRef.current });
                    setEditingTable(table);
                    closeTableMenu();
                  }}
                  onSetStatus={(action) => {
                    statusMutation.mutate({ id: table.id, action });
                    closeTableMenu();
                  }}
                  statusBusy={statusMutation.isPending}
                  onMove={onMove}
                  onEndMove={() => setMovingId(null)}
                />
              );
            })}
          </Suspense>
        </Canvas>
      </div>

      <div className="glass-chip pointer-events-none absolute left-3 top-3 z-10 flex max-w-[min(70%,240px)] items-center gap-2.5 rounded-xl px-2.5 py-2">
        <BrandMark logoUrl={logoUrl} name={venueName} primary={brandPrimary} />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold leading-tight text-foreground">
            {venueName}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">Salón digital</p>
        </div>
      </div>

      {mode === "select" && (
        <div className="glass-chip pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-foreground/80">
          <MousePointer2 className="h-3.5 w-3.5 text-primary" style={{ color: brandPrimary }} />
          {canManage
            ? "Mirar · click mesa = opciones · click piso camina · G/P vista · click derecho crea"
            : "Mirar · click mesa = opciones · click piso camina · G/P vista"}
        </div>
      )}

      <div className={cn(
        "glass-chip pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1.5 rounded-xl px-3 py-2",
        (draft || editingTable) && "opacity-0",
      )}>
        {Object.entries(STATUS_LABELS).map(([status, label]) => {
          const color =
            status === "OCCUPIED" || status === "FREE"
              ? brandPrimary
              : (STATUS_HEX[status] ?? brandPrimary);
          const opacity = status === "FREE" ? 0.45 : 1;
          return (
            <div key={status} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full shadow-sm ring-2 ring-white/70"
                style={{ backgroundColor: color, opacity }}
              />
              <span className="text-[11px] font-medium text-foreground/80">{label}</span>
            </div>
          );
        })}
      </div>

      {mode === "edit" && (
        <div className="glass-chip absolute right-3 top-3 z-10 rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-foreground/75">
          Arrastra las mesas para moverlas
        </div>
      )}

      {movingId && (
        <div
          className="absolute bottom-14 left-1/2 z-30 -translate-x-1/2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-xl"
          style={{ background: brandPrimary }}
        >
          Moviendo mesa · click para soltar · ESC cancela
        </div>
      )}

      <div
        ref={tooltipRef}
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-40 w-max max-w-[160px] rounded-full border border-border bg-card px-3 py-1.5 text-card-foreground shadow-lg transition-opacity duration-150",
          hoverInfo ? "opacity-100" : "opacity-0",
        )}
        style={{ willChange: "transform" }}
      >
        {hoverInfo && (
          <>
            {hoverInfo.title && (
              <p className="text-[12px] font-semibold leading-tight text-foreground">
                {hoverInfo.title}
              </p>
            )}
            {hoverInfo.subtitle && (
              <p className="text-[11px] leading-tight text-muted-foreground">
                {hoverInfo.subtitle}
              </p>
            )}
            {hoverInfo.action && (
              <p className="text-[10px] font-medium leading-tight text-primary">
                {hoverInfo.action}
              </p>
            )}
          </>
        )}
      </div>

      <SalonOverlays
        windows={windows}
        fullscreenId={fullscreenId}
        zOrder={zOrder}
        onClose={closeWindow}
        onFocus={focusWindow}
        onToggleFullscreen={toggleWindowFs}
        onLocateTable={handleLocateTable}
        tableLabel={tableLabel}
        canGoPos={salonCaps.pos}
        onWindowPos={(id, pos) => {
          setWindows((prev) =>
            prev.map((w) => (w.id === id ? { ...w, x: pos.x, y: pos.y } : w)),
          );
        }}
      />

      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={goPerson}
          aria-label="Vista persona"
          title="Vista persona (P)"
          className={cn(
            "glass-chip grid h-10 w-10 place-items-center rounded-xl hover:bg-white/50",
            viewMode === "person" ? "text-primary" : "text-foreground/80",
          )}
        >
          <PersonStanding className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={goOverview}
          aria-label="Vista general del salón"
          title="Vista general (G)"
          className={cn(
            "glass-chip grid h-10 w-10 place-items-center rounded-xl hover:bg-white/50",
            viewMode === "overview" ? "text-primary" : "text-foreground/80",
          )}
        >
          <Crosshair className="h-4 w-4" />
        </button>
        {onToggleImmersive && (
          <button
            type="button"
            onClick={toggleSceneFs}
            aria-label={immersive ? "Cerrar pestaña del salón" : "Abrir salón en otra pestaña"}
            title={immersive ? "Salir" : "Pantalla completa"}
            className="glass-chip grid h-10 w-10 place-items-center rounded-xl text-foreground/80 hover:bg-white/50"
          >
            {immersive ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        )}
      </div>

      {editingTable && (
        <TableEditPanel
          table={editingTable}
          anchor={menuPos}
          onClose={() => setEditingTable(null)}
        />
      )}

      {draft && canManage && (
        <form
          className="absolute z-30 w-[min(calc(100%-1.5rem),16.5rem)] rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-2xl"
          style={{
            left: `clamp(12px, ${menuPos.x + 16}px, calc(100% - 17rem))`,
            top: `clamp(12px, ${menuPos.y + 16}px, calc(100% - 20rem))`,
          }}
          onSubmit={(e) => {
            e.preventDefault();
            const number = draft.number.trim() || suggestedNumber;
            if (!number) return;
            onCreate?.({
              number,
              capacity: draft.capacity,
              shape: draft.shape,
              x: draft.x,
              y: draft.y,
            });
          }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Nueva mesa</p>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="rounded-lg p-1 text-muted-foreground hover:bg-white/40"
              aria-label="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-medium text-muted-foreground">
              Número
              <Input
                value={draft.number}
                onChange={(e) => setDraft({ ...draft, number: e.target.value })}
                placeholder={suggestedNumber}
                className="mt-1 h-9"
                required
              />
            </label>
            <label className="text-[11px] font-medium text-muted-foreground">
              Capacidad
              <Input
                type="number"
                min={1}
                max={20}
                value={draft.capacity}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    ...snapDraftSize(
                      draft,
                      { capacity: Number(e.target.value) || 4 },
                      placeBounds,
                    ),
                  })
                }
                className="mt-1 h-9"
              />
            </label>
            <label className="text-[11px] font-medium text-muted-foreground">
              Forma
              <Select
                value={draft.shape}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    ...snapDraftSize(
                      draft,
                      { shape: e.target.value as TableShape },
                      placeBounds,
                    ),
                  })
                }
                className="mt-1 h-9"
                options={[
                  { value: "ROUND", label: "Redonda" },
                  { value: "SQUARE", label: "Cuadrada" },
                  { value: "RECTANGLE", label: "Rectangular" },
                  { value: "OVAL", label: "Ovalada" },
                ]}
              />
            </label>
            <button
              type="submit"
              disabled={createBusy}
              className="mt-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {createBusy ? "Creando…" : "Confirmar mesa"}
            </button>
          </div>
        </form>
      )}

      {hoveredTable?.status === "OCCUPIED" && hoveredId !== selectedTableId && (
        <OccupiedTooltip table={hoveredTable} />
      )}
    </div>
  );
}

function BrandMark({
  logoUrl,
  name,
  primary,
}: {
  logoUrl: string | null;
  name: string;
  primary: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!logoUrl || failed) {
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
        style={{ backgroundColor: primary }}
      >
        {initials || "·"}
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/80">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoUrl}
        alt={name}
        className="h-full w-full object-contain p-0.5"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function useBrandFloorTexture(logoUrl: string | null, name: string, primary: string) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    let disposed = false;
    const size = 1024;
    const pad = Math.round(size * 0.16);

    const paint = (img: HTMLImageElement | null) => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;

      ctx.clearRect(0, 0, size, size);
      const avail = size - pad * 2;
      if (img && img.width > 0) {
        const scale = Math.min(avail / img.width, avail / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = primary;
        ctx.font = `bold ${Math.round(size * 0.28)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const initials = name
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join("");
        ctx.fillText(initials || "·", size / 2, size / 2);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      tex.needsUpdate = true;
      return tex;
    };

    if (!logoUrl) {
      // Async para no setear estado sincrónicamente dentro del effect
      queueMicrotask(() => {
        if (!disposed) setTexture(paint(null));
      });
      return () => {
        disposed = true;
      };
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (disposed) return;
      setTexture(paint(img));
    };
    img.onerror = () => {
      if (!disposed) setTexture(paint(null));
    };
    img.src = logoUrl;

    return () => {
      disposed = true;
    };
  }, [logoUrl, name, primary]);

  return texture;
}

/** Salón 3D: muros bajos de diorama, logo enmarcado, plantas pixel. */
function AmbientVenue({
  primary,
  logoUrl,
  venueName,
  roomW,
  roomH,
  dark,
}: {
  primary: string;
  logoUrl: string | null;
  venueName: string;
  roomW: number;
  roomH: number;
  dark: boolean;
}) {
  const logoTex = useBrandFloorTexture(logoUrl, venueName, primary);

  const w = roomW;
  const h = roomH;
  const wallH = salonWallH(w, h);
  const backZ = -h / 2 - 0.85;
  const logoSize = MathUtilsClamp(Math.min(w, h) * 0.14, 1.7, 2.5);

  const logoY = wallH * 0.66;

  const inset = 1.35;
  const entranceZ = h / 2 - 1.1;
  const wallColor = useMemo(
    () =>
      dark
        ? new THREE.Color("#232b38").lerp(new THREE.Color(primary), 0.22).getStyle()
        : new THREE.Color("#f2ece0").lerp(new THREE.Color(primary), 0.16).getStyle(),
    [dark, primary],
  );

  return (
    <group>
      {/* Muros bajos estilo diorama (la cámara frontal mira por encima) */}
      <mesh position={[0, wallH / 2, backZ]}>
        <boxGeometry args={[w + 3.2, wallH, 0.4]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={0.9}
          metalness={0.02}
          emissive={primary}
          emissiveIntensity={dark ? 0.07 : 0.03}
        />
      </mesh>
      <mesh position={[-w / 2 - 1.2, wallH / 2, 0]}>
        <boxGeometry args={[0.4, wallH, h + 2]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={0.9}
          metalness={0.02}
          emissive={primary}
          emissiveIntensity={dark ? 0.07 : 0.03}
        />
      </mesh>
      <mesh position={[w / 2 + 1.2, wallH / 2, 0]}>
        <boxGeometry args={[0.4, wallH, h + 2]} />
        <meshStandardMaterial
          color={wallColor}
          roughness={0.9}
          metalness={0.02}
          emissive={primary}
          emissiveIntensity={dark ? 0.07 : 0.03}
        />
      </mesh>

      {/* Cornisa primary luminosa coronando los muros */}
      <mesh position={[0, wallH + 0.05, backZ]}>
        <boxGeometry args={[w + 3.4, 0.14, 0.5]} />
        <meshStandardMaterial
          color={primary}
          emissive={primary}
          emissiveIntensity={dark ? 0.28 : 0.14}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[-w / 2 - 1.2, wallH + 0.05, 0]}>
        <boxGeometry args={[0.5, 0.14, h + 2.2]} />
        <meshStandardMaterial
          color={primary}
          emissive={primary}
          emissiveIntensity={dark ? 0.28 : 0.14}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[w / 2 + 1.2, wallH + 0.05, 0]}>
        <boxGeometry args={[0.5, 0.14, h + 2.2]} />
        <meshStandardMaterial
          color={primary}
          emissive={primary}
          emissiveIntensity={dark ? 0.28 : 0.14}
          roughness={0.4}
        />
      </mesh>
      {/* Zócalo primary al pie de los muros */}
      <mesh position={[0, 0.09, backZ + 0.22]}>
        <boxGeometry args={[w + 3.2, 0.18, 0.06]} />
        <meshStandardMaterial
          color={primary}
          emissive={primary}
          emissiveIntensity={dark ? 0.5 : 0.25}
          roughness={0.5}
        />
      </mesh>

      {logoTex && (
        <mesh position={[0, logoY, backZ + 0.28]}>
          <planeGeometry args={[logoSize, logoSize]} />
          <meshStandardMaterial
            map={logoTex}
            transparent
            roughness={0.35}
            metalness={0.02}
            depthWrite={false}
          />
        </mesh>
      )}

      {(
        [
          [-w / 2 - 0.35, -h / 2 - 0.25],
          [w / 2 + 0.35, -h / 2 - 0.25],
          [-w / 2 - 0.35, h / 2 + 0.25],
          [w / 2 + 0.35, h / 2 + 0.25],
        ] as [number, number][]
      ).map(([cx, cz], i) => (
        <CornerAccent key={i} x={cx} z={cz} primary={primary} phase={i} wallH={wallH} dark={dark} />
      ))}

      {/* Plantas pixel en esquinas + flancos de entrada */}
      <SalonPlant x={-w / 2 + inset} z={-h / 2 + inset} scale={1.05} sway={0} />
      <SalonPlant x={w / 2 - inset} z={-h / 2 + inset} scale={1.0} sway={1.1} />
      <SalonPlant x={-w / 2 + inset} z={h / 2 - inset} scale={1.1} sway={2.0} />
      <SalonPlant x={w / 2 - inset} z={h / 2 - inset} scale={1.05} sway={0.7} />
      <SalonPlant x={-w / 2 + inset * 1.15} z={entranceZ} scale={0.95} sway={1.6} />
      <SalonPlant x={w / 2 - inset * 1.15} z={entranceZ} scale={0.92} sway={2.5} />
    </group>
  );
}

/** Planta suave estilo diorama (Sims): maceta + follaje redondo. */
function SalonPlant({
  x,
  z,
  scale = 1,
}: {
  x: number;
  z: number;
  scale?: number;
  sway?: number;
}) {
  const potH = 0.38 * scale;
  const potR = 0.28 * scale;
  const leaf = 0.4 * scale;

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, potH / 2, 0]}>
        <cylinderGeometry args={[potR * 0.85, potR * 1.05, potH, 16]} />
        <meshStandardMaterial color="#c4a27a" roughness={0.55} metalness={0.04} />
      </mesh>
      <mesh position={[0, potH + 0.02, 0]}>
        <cylinderGeometry args={[potR * 0.78, potR * 0.78, 0.05, 16]} />
        <meshStandardMaterial color="#5a4030" roughness={0.9} />
      </mesh>
      <mesh position={[0, potH + leaf * 0.85, 0]}>
        <sphereGeometry args={[leaf * 0.95, 18, 14]} />
        <meshStandardMaterial color="#4fa86f" roughness={0.55} />
      </mesh>
      <mesh position={[leaf * 0.35, potH + leaf * 1.25, leaf * 0.15]}>
        <sphereGeometry args={[leaf * 0.62, 16, 12]} />
        <meshStandardMaterial color="#5cbf7a" roughness={0.5} />
      </mesh>
      <mesh position={[-leaf * 0.28, potH + leaf * 1.1, -leaf * 0.2]}>
        <sphereGeometry args={[leaf * 0.5, 16, 12]} />
        <meshStandardMaterial color="#3d8b5f" roughness={0.6} />
      </mesh>
      <BlobShadow radius={0.55 * scale} opacity={0.32} />
    </group>
  );
}

/** Columna de esquina: bloque pixel con cubo luminoso. */
function CornerAccent({
  x,
  z,
  primary,
  phase,
  wallH,
  dark,
}: {
  x: number;
  z: number;
  primary: string;
  phase: number;
  wallH: number;
  dark: boolean;
}) {
  const colH = wallH * 0.8;

  return (
    <group position={[x, colH / 2, z]}>
      <mesh>
        <boxGeometry args={[0.42, colH, 0.42]} />
        <meshStandardMaterial
          color={dark ? "#2c3542" : "#ece5d5"}
          roughness={0.75}
          emissive={primary}
          emissiveIntensity={dark ? 0.2 : 0.08}
        />
      </mesh>
      <mesh position={[0, colH / 2 + 0.22, 0]}>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial
          color={primary}
          emissive={primary}
          emissiveIntensity={0.55}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

function SalonCameraPersist({
  initial,
  onChange,
}: {
  initial: SalonUiPersist["camera"] | null;
  onChange: (cam: NonNullable<SalonUiPersist["camera"]>) => void;
}) {
  const { camera, controls } = useThree();
  const applied = useRef(false);
  const lastSave = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (applied.current || !initial) return;
    applied.current = true;
    camera.position.set(...initial.pos);
    const ctrl = controls as
      | { target: THREE.Vector3; update: () => void }
      | undefined
      | null;
    if (ctrl?.target) {
      ctrl.target.set(...initial.target);
      ctrl.update();
    }
  }, [camera, controls, initial]);

  useFrame(() => {
    const now = performance.now();
    if (now - lastSave.current < 900) return;
    lastSave.current = now;
    const ctrl = controls as { target?: THREE.Vector3 } | undefined | null;
    const target = ctrl?.target;
    if (!target) return;
    onChangeRef.current({
      pos: [camera.position.x, camera.position.y, camera.position.z],
      target: [target.x, target.y, target.z],
    });
  });

  return null;
}

function OrbitTargetInit({ target }: { target: [number, number, number] }) {
  const { controls } = useThree();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    const ctrl = controls as
      | { target: THREE.Vector3; update: () => void }
      | null
      | undefined;
    if (!ctrl?.target) return;
    done.current = true;
    ctrl.target.set(...target);
    ctrl.update();
  }, [controls, target]);
  return null;
}

function CameraHome({
  tick,
  position,
  target,
  onArrived,
}: {
  tick: number;
  position: [number, number, number];
  target: [number, number, number];
  onArrived?: (pos: [number, number, number], target: [number, number, number]) => void;
}) {
  const { camera, controls } = useThree();
  const lastTick = useRef(0);
  const onArrivedRef = useRef(onArrived);
  onArrivedRef.current = onArrived;

  useEffect(() => {
    if (tick === 0 || tick === lastTick.current) return;
    lastTick.current = tick;
    const ctrl = controls as
      | { target: THREE.Vector3; update: () => void }
      | null
      | undefined;
    if (!ctrl?.target) return;
    // Un solo snap: sin lerp en loop (eso pelea con el giro del usuario)
    camera.position.set(...position);
    ctrl.target.set(...target);
    ctrl.update();
    onArrivedRef.current?.(position, target);
  }, [tick, position, target, camera, controls]);

  return null;
}

function FloorExplore({
  roomW,
  roomH,
  blocked,
  cancelTick = 0,
  skipUntilRef,
}: {
  roomW: number;
  roomH: number;
  blocked: boolean;
  cancelTick?: number;
  skipUntilRef?: React.MutableRefObject<number>;
}) {
  const { camera, controls, gl, raycaster } = useThree();
  const walkTarget = useRef<THREE.Vector3 | null>(null);
  const walkCam = useRef<THREE.Vector3 | null>(null);
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const blockedRef = useRef(blocked);
  const sizeRef = useRef({ roomW, roomH });

  useEffect(() => {
    blockedRef.current = blocked;
  }, [blocked]);
  useEffect(() => {
    sizeRef.current = { roomW, roomH };
  }, [roomW, roomH]);
  useEffect(() => {
    walkTarget.current = null;
    walkCam.current = null;
  }, [cancelTick]);

  useEffect(() => {
    const el = gl.domElement;
    const ndc = new THREE.Vector2();
    const hitAt = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(floorPlane, hit)) return null;
      const { roomW: w, roomH: h } = sizeRef.current;
      if (Math.abs(hit.x) > w / 2 + 1.2 || Math.abs(hit.z) > h / 2 + 1.2) return null;
      return hit.clone();
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      down.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onUp = (e: PointerEvent) => {
      if (e.button !== 0 || !down.current || blockedRef.current) {
        down.current = null;
        return;
      }
      if (skipUntilRef && performance.now() < skipUntilRef.current) {
        down.current = null;
        return;
      }
      const dx = e.clientX - down.current.x;
      const dy = e.clientY - down.current.y;
      const dt = performance.now() - down.current.t;
      down.current = null;
      // Click corto sin arrastre = caminar al baldosín (espionaje)
      if (dt > 380 || dx * dx + dy * dy > 36) return;
      const p = hitAt(e.clientX, e.clientY);
      const ctrl = controls as { target?: THREE.Vector3 } | null | undefined;
      if (!p || !ctrl?.target) return;
      const look = new THREE.Vector3(p.x, 1.32, p.z);
      const offset = camera.position.clone().sub(ctrl.target);
      // Mantener altura de cámara al “caminar”
      offset.y = Math.max(1.1, offset.y);
      walkTarget.current = look;
      walkCam.current = look.clone().add(offset);
    };
    const onWheel = (e: WheelEvent) => {
      if (blockedRef.current) return;
      const p = hitAt(e.clientX, e.clientY);
      const ctrl = controls as { target?: THREE.Vector3 } | null | undefined;
      if (!p || !ctrl?.target) return;
      // Zoom hacia el punto bajo el cursor, no al fondo del salón
      ctrl.target.lerp(new THREE.Vector3(p.x, 1.32, p.z), 0.42);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [camera, controls, floorPlane, gl, hit, raycaster]);

  useFrame(() => {
    if (!walkTarget.current || !walkCam.current) return;
    const ctrl = controls as
      | { target: THREE.Vector3; update: () => void }
      | null
      | undefined;
    if (!ctrl?.target) return;
    ctrl.target.lerp(walkTarget.current, 0.12);
    camera.position.lerp(walkCam.current, 0.12);
    ctrl.update();
    if (ctrl.target.distanceTo(walkTarget.current) < 0.06) {
      walkTarget.current = null;
      walkCam.current = null;
    }
  });

  return null;
}

function RightClickCreate({
  originX,
  originY,
  blocked,
  onCreateAt,
}: {
  originX: number;
  originY: number;
  blocked: boolean;
  onCreateAt: (x: number, y: number) => void;
}) {
  const { camera, gl, pointer, raycaster } = useThree();
  const glRef = useRef(gl);
  const blockedRef = useRef(blocked);
  const originRef = useRef({ originX, originY, onCreateAt });
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const down = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    glRef.current = gl;
  }, [gl]);
  useEffect(() => {
    blockedRef.current = blocked;
  }, [blocked]);
  useEffect(() => {
    originRef.current = { originX, originY, onCreateAt };
  }, [originX, originY, onCreateAt]);

  useEffect(() => {
    const el = glRef.current.domElement;
    const onDown = (e: MouseEvent) => {
      if (e.button === 2) down.current = { x: e.clientX, y: e.clientY };
    };
    const onCtx = (e: MouseEvent) => {
      e.preventDefault();
      if (blockedRef.current) return;
      const start = down.current;
      if (
        start &&
        Math.hypot(e.clientX - start.x, e.clientY - start.y) > 8
      ) {
        return;
      }
      raycaster.setFromCamera(pointer, camera);
      if (!raycaster.ray.intersectPlane(floorPlane, hit)) return;
      const { originX: ox, originY: oy, onCreateAt: create } = originRef.current;
      const cell = tableDimensions(4, "ROUND");
      const { x, y } = worldToMap(
        hit.x - (cell.width * SCALE) / 2,
        hit.z - (cell.height * SCALE) / 2,
        ox,
        oy,
      );
      create(
        Math.max(0, Math.min(CANVAS_WIDTH - cell.width, x)),
        Math.max(0, Math.min(CANVAS_HEIGHT - cell.height, y)),
      );
    };
    el.addEventListener("mousedown", onDown);
    el.addEventListener("contextmenu", onCtx);
    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("contextmenu", onCtx);
    };
  }, [camera, floorPlane, hit, pointer, raycaster]);

  return null;
}

function TableMesh({
  table,
  mapX,
  mapY,
  originX,
  originY,
  placeBounds = null,
  mode,
  selected,
  hovered,
  brandPrimary,
  moving,
  onHover,
  onMenu,
  onView,
  onStartMove,
  onEdit,
  onSetStatus,
  statusBusy = false,
  onMove,
  onEndMove,
  showActions = false,
  canManage = false,
  ghost = false,
  fitScale = 1,
  neighbors = [],
}: {
  table: TableItem;
  mapX: number;
  mapY: number;
  originX: number;
  originY: number;
  placeBounds?: import("@/lib/tables/layout").MapBounds | null;
  mode: "edit" | "select";
  selected: boolean;
  hovered: boolean;
  brandPrimary: string;
  moving: boolean;
  showActions?: boolean;
  canManage?: boolean;
  ghost?: boolean;
  fitScale?: number;
  neighbors?: TableRect[];
  statusBusy?: boolean;
  onHover: (tableId: number, source: "mesh" | "menu", inside: boolean) => void;
  onMenu?: (id: number) => void;
  onView?: () => void;
  onStartMove?: () => void;
  onEdit?: () => void;
  onSetStatus?: (action: "free" | "reserve" | "clean" | "out") => void;
  onMove?: (id: number, x: number, y: number) => void;
  onEndMove?: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const visual = useRef<THREE.Group>(null);
  const marker = useRef<THREE.Group>(null);
  const topMat = useRef<THREE.MeshStandardMaterial>(null);
  const dragging = useRef(false);
  const moved = useRef(false);
  const lastDrag = useRef(new THREE.Vector3());
  const lastSnap = useRef({ x: mapX, y: mapY });
  const justFinished = useRef(false);
  const statusPulse = useRef(0);
  const actionPop = useRef(0);
  const { camera, gl, raycaster, pointer } = useThree();
  // Cursor del canvas vía ref: mutar el renderer (valor de hook) en callbacks
  // rompe las reglas de inmutabilidad de react-hooks.
  const glRef = useRef(gl);
  useEffect(() => {
    glRef.current = gl;
  }, [gl]);
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);

  const dims = tableDimensions(table.capacity || 4, table.shape);
  const w = dims.width * SCALE * TABLE_MESH_SCALE * fitScale;
  const d = dims.height * SCALE * TABLE_MESH_SCALE * fitScale;
  const status = table.status ?? "FREE";
  // Colores de estado, pero el acento interactivo siempre es primary
  const color =
    status === "OCCUPIED"
      ? brandPrimary
      : status === "FREE"
        ? new THREE.Color(brandPrimary).lerp(new THREE.Color("#ffffff"), 0.55).getStyle()
        : (STATUS_HEX[status] ?? brandPrimary);
  const topColor = new THREE.Color(color).lerp(new THREE.Color("#ffffff"), 0.35).getStyle();
  const bodyColor = new THREE.Color(brandPrimary).lerp(new THREE.Color("#1b1e19"), 0.25).getStyle();
  const surfaceOpacity = ghost ? 0.42 : 1;

  // Centrar la mesa en su celda de layout (no en el mesh ampliado)
  const [wx, , wz] = mapToWorld(mapX, mapY, originX, originY);
  const layoutW = dims.width * SCALE;
  const layoutD = dims.height * SCALE;
  const ox = wx + layoutW / 2;
  const oz = wz + layoutD / 2;

  useEffect(() => {
    lastSnap.current = { x: mapX, y: mapY };
  }, [mapX, mapY]);

  useEffect(() => {
    if (!group.current || dragging.current || moving) return;
    group.current.position.set(ox, 0, oz);
  }, [ox, oz, moving]);

  useFrame(() => {
    // Seguir al cursor: drag clásico (modo edit) o mover continuo (menú)
    if ((dragging.current || moving) && group.current) {
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.ray.intersectPlane(floorPlane, hit)) {
        const raw = worldToMap(
          hit.x - layoutW / 2,
          hit.z - layoutD / 2,
          originX,
          originY,
        );
        // Arrastre libre: solo límites del mapa. El snap suave es para marcar y guardar.
        const free = clampTablePosFree(raw.x, raw.y, dims.width, dims.height, placeBounds);
        const snapped = softPlaceTable(raw.x, raw.y, dims.width, dims.height, placeBounds);
        const [fx, , fz] = mapToWorld(free.x, free.y, originX, originY);
        const px = fx + layoutW / 2;
        const pz = fz + layoutD / 2;
        group.current.position.x = px;
        group.current.position.z = pz;
        lastDrag.current.set(px, 0, pz);
        lastSnap.current = snapped;
        const [sx, , sz] = mapToWorld(snapped.x, snapped.y, originX, originY);
        if (marker.current) {
          marker.current.position.set(sx + layoutW / 2 - px, 0.02, sz + layoutD / 2 - pz);
          marker.current.visible = true;
        }
        moved.current = true;
      }
    } else if (marker.current) {
      marker.current.visible = false;
    }

    if (!visual.current) return;
    const t = performance.now();
    const active = hovered || selected || moving;

    // Pulso al cambiar estado / al abrir acciones
    if (statusPulse.current > 0.01) {
      statusPulse.current = THREE.MathUtils.lerp(statusPulse.current, 0, 0.08);
    }
    if (actionPop.current > 0.01) {
      actionPop.current = THREE.MathUtils.lerp(actionPop.current, 0, 0.1);
    }

    const pulse = statusPulse.current;
    const pop = actionPop.current;
    // Bounce elástico al cambiar estado
    const bounce = Math.sin(pulse * Math.PI) * pulse * 0.14;
    const squash = 1 + Math.sin(pulse * Math.PI * 2) * pulse * 0.06;

    const targetScale = moving || ghost ? 1 : active ? 1.045 : 1;
    const targetY = moving ? 0.08 : ghost ? 0.02 : active ? 0.07 : 0;
    // Ligera inclinación hacia cámara en hover
    const targetTiltX = active && !moving && !ghost ? -0.04 : 0;
    const targetSpinY =
      status === "CLEANING" && !moving
        ? Math.sin(t * 0.003) * 0.04
        : status === "RESERVED" && !moving
          ? Math.sin(t * 0.002) * 0.025
          : 0;

    const s = targetScale * (1 + bounce) * squash * (1 + pop * 0.08);
    visual.current.scale.x = THREE.MathUtils.lerp(visual.current.scale.x, s, 0.16);
    visual.current.scale.y = THREE.MathUtils.lerp(
      visual.current.scale.y,
      targetScale * (1 + bounce * 1.2) * (1 - bounce * 0.35) * (1 + pop * 0.1),
      0.16,
    );
    visual.current.scale.z = THREE.MathUtils.lerp(visual.current.scale.z, s, 0.16);
    visual.current.position.y = THREE.MathUtils.lerp(
      visual.current.position.y,
      targetY + bounce * 0.35 + pop * 0.12,
      0.14,
    );
    visual.current.rotation.x = THREE.MathUtils.lerp(
      visual.current.rotation.x,
      targetTiltX,
      0.12,
    );
    visual.current.rotation.y = THREE.MathUtils.lerp(
      visual.current.rotation.y,
      targetSpinY,
      0.1,
    );

    if (topMat.current) {
      const wantEmissive = ghost
        ? 0.08
        : pulse > 0.2
          ? 0.55
          : active
            ? 0.28
            : status === "OCCUPIED"
              ? 0.14
              : status === "CLEANING"
                ? 0.2 + Math.sin(t * 0.008) * 0.08
                : status === "RESERVED"
                  ? 0.16
                  : 0.04;
      topMat.current.emissiveIntensity = THREE.MathUtils.lerp(
        topMat.current.emissiveIntensity,
        wantEmissive,
        0.14,
      );
    }
  });

  const endDrag = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    // En select el cursor lo gobierna la clase CSS del contenedor (hover);
    // el inline solo se usa para grab/grabbing en modo edit.
    glRef.current.domElement.style.cursor = mode === "edit" ? "grab" : "";
    if (moved.current && onMove) {
      onMove(table.id, lastSnap.current.x, lastSnap.current.y);
    }
    moved.current = false;
  }, [
    mode,
    onMove,
    table.id,
  ]);

  useEffect(() => {
    const up = () => endDrag();
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [endDrag]);

  // Mover continuo: el SIGUIENTE click suelta (guarda), ESC cancela.
  // Se arma con delay para no consumir el click de "Mover".
  const finishMoveRef = useRef<(save: boolean) => void>(() => {});
  useEffect(() => {
    finishMoveRef.current = (save: boolean) => {
      if (save && moved.current && onMove) {
        onMove(table.id, lastSnap.current.x, lastSnap.current.y);
      } else if (!save && group.current) {
        group.current.position.set(ox, 0, oz);
      }
      moved.current = false;
      justFinished.current = true;
      window.setTimeout(() => {
        justFinished.current = false;
      }, 80);
      onEndMove?.();
    };
  });

  useEffect(() => {
    if (!moving) return;
    let armed = false;
    const armTimer = window.setTimeout(() => {
      armed = true;
    }, 140);
    const onPointerDown = () => {
      if (!armed) return;
      finishMoveRef.current(true);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") finishMoveRef.current(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", key);
    return () => {
      window.clearTimeout(armTimer);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", key);
    };
  }, [moving]);

  useEffect(() => {
    if (group.current) group.current.position.set(ox, 0, oz);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo mount
  }, []);

  const shape = (table.shape ?? "ROUND") as TableShape;
  const isRound = shape === "ROUND" || shape === "OVAL";
  const radius = Math.max(w, d) / 2;
  const seats = Math.max(1, table.capacity || 2);
  const prevStatus = useRef(status);
  const [celebrateUntil, setCelebrateUntil] = useState(0);
  const prevShowActions = useRef(showActions);
  useEffect(() => {
    if (prevStatus.current !== status) {
      statusPulse.current = 1;
      if (prevStatus.current !== "FREE" && status === "FREE") {
        const until = performance.now() + 2400;
        setCelebrateUntil(until);
        const t = window.setTimeout(() => setCelebrateUntil(0), 2500);
        prevStatus.current = status;
        return () => window.clearTimeout(t);
      }
    }
    prevStatus.current = status;
  }, [status]);
  useEffect(() => {
    if (showActions && !prevShowActions.current) {
      actionPop.current = 1;
    }
    prevShowActions.current = showActions;
  }, [showActions]);
  return (
    <group
      ref={group}
      onPointerEnter={(e) => {
        e.stopPropagation();
        if (moving) return;
        onHover(table.id, "mesh", true);
        glRef.current.domElement.style.cursor = mode === "edit" ? "grab" : "";
      }}
      onPointerLeave={() => {
        if (dragging.current || moving) return;
        window.requestAnimationFrame(() => {
          if (document.querySelector(`[data-table-menu="${table.id}"]:hover`)) {
            onHover(table.id, "menu", true);
            return;
          }
          onHover(table.id, "mesh", false);
        });
        glRef.current.domElement.style.cursor = "";
      }}
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        if (moving || ghost) return;
        if (e.nativeEvent.button === 2) {
          onMenu?.(table.id);
          return;
        }
        if (e.nativeEvent.button === 0 && mode === "select") {
          onMenu?.(table.id);
          return;
        }
        if (mode === "edit") {
          dragging.current = true;
          moved.current = false;
          glRef.current.domElement.style.cursor = "grabbing";
          (e.target as unknown as { setPointerCapture?: (id: number) => void })
            ?.setPointerCapture?.(e.pointerId);
        }
      }}
      onContextMenu={(e) => {
        e.stopPropagation();
        if (!ghost) onMenu?.(table.id);
      }}
    >
      {showActions && !ghost && (
        <TableActionBar
          tableId={table.id}
          status={status}
          canManage={canManage}
          statusBusy={statusBusy}
          onHover={onHover}
          onView={onView}
          onStartMove={onStartMove}
          onEdit={onEdit}
          onSetStatus={onSetStatus}
        />
      )}
      {/* Hitbox = tapa real. Las sillas no cuentan para no “enganchar” al lado. */}
      {isRound ? (
        <mesh
          position={[0, 0.72, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={
            shape === "OVAL"
              ? [1, Math.max(0.55, d / Math.max(w, 0.01)), 1]
              : [1, 1, 1]
          }
        >
          <circleGeometry args={[radius, 24]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            colorWrite={false}
          />
        </mesh>
      ) : (
        <mesh position={[0, 0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            colorWrite={false}
          />
        </mesh>
      )}
      <BlobShadow radius={radius + 0.42} opacity={ghost ? 0.16 : 0.38} />
      {(moving || ghost) && (
        <group ref={marker} visible={ghost}>
          <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            {isRound ? (
              <ringGeometry args={[radius * 0.72, radius + 0.18, 48]} />
            ) : (
              <planeGeometry args={[w + 0.32, d + 0.32]} />
            )}
            <meshBasicMaterial
              color={brandPrimary}
              transparent
              opacity={0.45}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          {!isRound && (
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
              <planeGeometry args={[w, d]} />
              <meshBasicMaterial
                color={brandPrimary}
                transparent
                opacity={0.18}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>
      )}

      <group ref={visual}>
        {/* Base: bloque central o 4 patas según forma */}
        {isRound ? (
          <mesh position={[0, 0.28, 0]} raycast={() => null}>
            <boxGeometry args={[radius * 0.55, 0.56, radius * 0.55]} />
            <meshStandardMaterial
              color={bodyColor}
              roughness={0.6}
              metalness={0.08}
              transparent={ghost}
              opacity={surfaceOpacity}
            />
          </mesh>
        ) : (
          <>
            {[
              [-w * 0.32, -d * 0.32],
              [w * 0.32, -d * 0.32],
              [-w * 0.32, d * 0.32],
              [w * 0.32, d * 0.32],
            ].map(([lx, lz], i) => (
              <mesh key={i} position={[lx, 0.28, lz]} raycast={() => null}>
                <boxGeometry args={[0.14, 0.56, 0.14]} />
                <meshStandardMaterial
                  color={bodyColor}
                  roughness={0.6}
                  metalness={0.08}
                  transparent={ghost}
                  opacity={surfaceOpacity}
                />
              </mesh>
            ))}
          </>
        )}

        {/* Tapa */}
        {isRound ? (
          <mesh
            position={[0, 0.62, 0]}
            scale={shape === "OVAL" ? [1, 1, Math.max(0.55, d / Math.max(w, 0.01))] : [1, 1, 1]}
            raycast={() => null}
          >
            <cylinderGeometry args={[radius, radius, 0.14, 32]} />
            <meshStandardMaterial
              ref={topMat}
              color={topColor}
              roughness={0.4}
              metalness={0.1}
              emissive={brandPrimary}
              emissiveIntensity={0.03}
              transparent={ghost}
              opacity={surfaceOpacity}
            />
          </mesh>
        ) : (
          <mesh position={[0, 0.62, 0]} raycast={() => null}>
            <boxGeometry args={[w, 0.14, d]} />
            <meshStandardMaterial
              ref={topMat}
              color={topColor}
              roughness={0.4}
              metalness={0.1}
              emissive={brandPrimary}
              emissiveIntensity={0.03}
              transparent={ghost}
              opacity={surfaceOpacity}
            />
          </mesh>
        )}

        {/* Sillas estilo Gubi / mid-century — una por cara si es cuadrada/4 */}
        {seatSlots(Math.min(seats, 8), w, d, isRound, radius).map((slot, i) => (
            <GubiChair
              key={i}
              position={[slot.x, 0, slot.z]}
              rotationY={slot.rot}
              wood={bodyColor}
              primary={brandPrimary}
              ghost={ghost}
              opacity={surfaceOpacity}
              lit={hovered && !ghost}
            />
          ))}

        <TableStatusFx
          status={status}
          radius={radius}
          primary={brandPrimary}
          celebrateUntil={celebrateUntil}
        />

        <group position={[0, 1.08, 0]}>
          <Billboard follow>
            <mesh raycast={() => null}>
              <planeGeometry
                args={[
                  Math.max(0.52, String(table.number).length * 0.24 + 0.34),
                  0.36,
                ]}
              />
              <meshBasicMaterial
                color={hovered || selected ? brandPrimary : "#f4efe6"}
                transparent
                opacity={ghost ? 0.5 : hovered || selected ? 0.94 : 0.88}
                depthWrite={false}
              />
            </mesh>
            <Text
              position={[0, 0, 0.01]}
              anchorX="center"
              anchorY="middle"
              fontSize={0.22}
              color={hovered || selected ? "#ffffff" : "#2c261e"}
              raycast={() => null}
            >
              {String(table.number)}
            </Text>
          </Billboard>
        </group>
      </group>

      {/* Indicador 3D de mover continuo */}
      {moving && (
        <group position={[0, 2.35, 0]}>
          <Billboard follow>
            <mesh>
              <planeGeometry args={[2.3, 0.36]} />
              <meshBasicMaterial
                color={brandPrimary}
                transparent
                opacity={0.95}
                depthWrite={false}
              />
            </mesh>
            <Text
              position={[0, 0, 0.01]}
              fontSize={0.15}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.01}
              outlineColor="#000000"
            >
              Suelta con click · ESC cancela
            </Text>
          </Billboard>
        </group>
      )}
    </group>
  );
}

/** Acomodo de sillas: redonda = anillo mirando al centro; rectangular = lados. */
function seatSlots(
  count: number,
  w: number,
  d: number,
  isRound: boolean,
  radius: number,
): { x: number; z: number; rot: number }[] {
  const n = Math.max(1, Math.min(count, 8));
  const gap = 0.62;

  if (isRound) {
    return Array.from({ length: n }, (_, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const dist = radius + gap;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      // Respaldo en -Z local → mirar al centro = atan2(-x, -z)
      return { x, z, rot: Math.atan2(-x, -z) };
    });
  }

  // Lados: N(-Z), E(+X), S(+Z), W(-X) — rotaciones para mirar hacia adentro
  const sides: {
    count: number;
    axis: "x" | "z";
    sign: 1 | -1;
    rot: number;
    len: number;
  }[] = [
    { count: 0, axis: "x", sign: -1, rot: 0, len: w },
    { count: 0, axis: "z", sign: 1, rot: -Math.PI / 2, len: d },
    { count: 0, axis: "x", sign: 1, rot: Math.PI, len: w },
    { count: 0, axis: "z", sign: -1, rot: Math.PI / 2, len: d },
  ];

  // Preferir lados largos al repartir extras (4 → una por cara)
  const order = w >= d ? [0, 2, 1, 3] : [1, 3, 0, 2];
  for (let i = 0; i < n; i++) {
    sides[order[i % 4]].count += 1;
  }

  const out: { x: number; z: number; rot: number }[] = [];
  for (const side of sides) {
    if (side.count === 0) continue;
    for (let i = 0; i < side.count; i++) {
      const t = (i + 1) / (side.count + 1);
      const along = (t - 0.5) * side.len * 0.78;
      if (side.axis === "x") {
        out.push({ x: along, z: side.sign * (d / 2 + gap), rot: side.rot });
      } else {
        out.push({ x: side.sign * (w / 2 + gap), z: along, rot: side.rot });
      }
    }
  }
  return out;
}

/** Menú lineal tipo Sims: botones seguidos, fáciles de recorrer. */
function TableActionBar({
  tableId,
  status,
  canManage,
  statusBusy,
  onHover,
  onView,
  onStartMove,
  onEdit,
  onSetStatus,
}: {
  tableId: number;
  status: string;
  canManage: boolean;
  statusBusy: boolean;
  onHover: (tableId: number, source: "mesh" | "menu", inside: boolean) => void;
  onView?: () => void;
  onStartMove?: () => void;
  onEdit?: () => void;
  onSetStatus?: (action: "free" | "reserve" | "clean" | "out") => void;
}) {
  type Act = {
    key: string;
    tip: string;
    tone: string;
    icon: typeof Eye;
    onClick?: () => void;
    show: boolean;
  };
  const acts: Act[] = [
    {
      key: "view",
      tip: "Ver orden",
      tone: "bg-primary text-primary-foreground hover:brightness-110",
      icon: Eye,
      onClick: onView,
      show: Boolean(onView),
    },
    {
      key: "move",
      tip: "Mover mesa",
      tone: "bg-card text-foreground hover:brightness-95",
      icon: Move,
      onClick: onStartMove,
      show: canManage && Boolean(onStartMove),
    },
    {
      key: "edit",
      tip: "Editar mesa",
      tone: "bg-card text-foreground hover:brightness-95",
      icon: Pencil,
      onClick: onEdit,
      show: canManage && Boolean(onEdit),
    },
    {
      key: "reserve",
      tip: "Reservar",
      tone: "bg-warning text-white hover:brightness-110",
      icon: Calendar,
      onClick: () => onSetStatus?.("reserve"),
      show: canManage && Boolean(onSetStatus) && status !== "RESERVED" && status !== "OCCUPIED",
    },
    {
      key: "clean",
      tip: "En limpieza",
      tone: "bg-sky-500 text-white hover:brightness-110",
      icon: Sparkles,
      onClick: () => onSetStatus?.("clean"),
      show: canManage && Boolean(onSetStatus) && status !== "CLEANING" && status !== "OCCUPIED",
    },
    {
      key: "out",
      tip: "No disponible",
      tone: "bg-zinc-700 text-white hover:brightness-110 dark:bg-zinc-600",
      icon: Ban,
      onClick: () => onSetStatus?.("out"),
      show: canManage && Boolean(onSetStatus) && status !== "OUT_OF_SERVICE",
    },
    {
      key: "free",
      tip: "Dejar libre",
      tone: "bg-success text-white hover:brightness-110",
      icon: CheckCircle2,
      onClick: () => onSetStatus?.("free"),
      show: canManage && Boolean(onSetStatus) && status !== "FREE",
    },
  ].filter((a) => a.show);

  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const t = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(t);
  }, []);

  return (
    <Html
      position={[0, 1.38, 0]}
      center
      sprite
      zIndexRange={[40, 50]}
      style={{ pointerEvents: "none" }}
    >
      <div
        data-table-menu={tableId}
        className="pointer-events-auto flex items-center gap-0.5 rounded-2xl border border-border bg-card p-1 shadow-lg"
        onPointerDown={(ev) => ev.stopPropagation()}
        onPointerEnter={() => onHover(tableId, "menu", true)}
        onPointerLeave={() => onHover(tableId, "menu", false)}
        style={{
          transform: entered ? "translateY(0) scale(1)" : "translateY(8px) scale(0.92)",
          transition: "transform 280ms cubic-bezier(0.34, 1.45, 0.64, 1)",
        }}
      >
        {acts.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.key}
              type="button"
              disabled={statusBusy && a.key !== "view" && a.key !== "move" && a.key !== "edit"}
              title={a.tip}
              aria-label={a.tip}
              className={cn(
                "group relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-transparent transition-transform duration-150 hover:z-10 hover:scale-110 active:scale-95 disabled:grayscale disabled:brightness-75",
                a.tone,
              )}
              onClick={(ev) => {
                ev.stopPropagation();
                a.onClick?.();
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2 py-1 text-[10px] font-semibold text-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
                {a.tip}
              </span>
            </button>
          );
        })}
      </div>
    </Html>
  );
}

/** Silla de comedor adulta (proporción Gubi / mid-century), no miniatura. */
function GubiChair({
  position,
  rotationY,
  wood,
  primary,
  ghost,
  opacity,
  lit,
}: {
  position: [number, number, number];
  rotationY: number;
  wood: string;
  primary: string;
  ghost: boolean;
  opacity: number;
  lit: boolean;
}) {
  const seat = "#b8956c";
  const metal = "#2e3338";
  const matProps = {
    transparent: ghost,
    opacity,
  } as const;
  return (
    <group position={position} rotation={[0, rotationY, 0]} raycast={() => null}>
      {/* Patas altas abiertas — asiento a ~45 cm */}
      {(
        [
          [-0.16, -0.15, 0.14],
          [0.16, -0.15, -0.14],
          [-0.16, 0.15, 0.14],
          [0.16, 0.15, -0.14],
        ] as const
      ).map(([lx, lz, lean], i) => (
        <mesh
          key={i}
          position={[lx, 0.22, lz]}
          rotation={[lean * 0.1, 0, -Math.sign(lx) * 0.14]}
          raycast={() => null}
        >
          <cylinderGeometry args={[0.022, 0.032, 0.44, 8]} />
          <meshStandardMaterial
            color={metal}
            roughness={0.32}
            metalness={0.6}
            {...matProps}
          />
        </mesh>
      ))}
      {/* Asiento amplio */}
      <mesh position={[0, 0.46, 0.04]} raycast={() => null}>
        <boxGeometry args={[0.42, 0.055, 0.4]} />
        <meshStandardMaterial
          color={seat}
          roughness={0.5}
          metalness={0.04}
          emissive={primary}
          emissiveIntensity={lit ? 0.08 : 0}
          {...matProps}
        />
      </mesh>
      <mesh position={[0, 0.49, 0.04]} raycast={() => null}>
        <boxGeometry args={[0.38, 0.03, 0.36]} />
        <meshStandardMaterial
          color="#c9a87a"
          roughness={0.65}
          metalness={0.02}
          {...matProps}
        />
      </mesh>
      {/* Respaldo alto */}
      <mesh position={[0, 0.72, -0.14]} rotation={[0.22, 0, 0]} raycast={() => null}>
        <boxGeometry args={[0.4, 0.42, 0.045]} />
        <meshStandardMaterial
          color={wood}
          roughness={0.48}
          metalness={0.08}
          emissive={primary}
          emissiveIntensity={lit ? 0.06 : 0}
          {...matProps}
        />
      </mesh>
      {/* Apoyabrazos */}
      <mesh position={[-0.2, 0.58, 0.02]} rotation={[0.08, 0, 0.12]} raycast={() => null}>
        <boxGeometry args={[0.045, 0.05, 0.32]} />
        <meshStandardMaterial color={wood} roughness={0.48} metalness={0.08} {...matProps} />
      </mesh>
      <mesh position={[0.2, 0.58, 0.02]} rotation={[0.08, 0, -0.12]} raycast={() => null}>
        <boxGeometry args={[0.045, 0.05, 0.32]} />
        <meshStandardMaterial color={wood} roughness={0.48} metalness={0.08} {...matProps} />
      </mesh>
    </group>
  );
}

/** Efectos por estado: limpieza (polvo/agua), fuera (conos), libre (festejo). */
function TableStatusFx({
  status,
  radius,
  primary,
  celebrateUntil,
}: {
  status: string;
  radius: number;
  primary: string;
  celebrateUntil: number;
}) {
  const cleanRef = useRef<THREE.Points>(null);
  const burstRef = useRef<THREE.Points>(null);
  const cleanCount = 48;
  const burstCount = 64;

  const cleanGeo = useMemo(() => {
    const pos = new Float32Array(cleanCount * 3);
    const vel = new Float32Array(cleanCount * 3);
    for (let i = 0; i < cleanCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * radius * 0.85;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0.7 + Math.random() * 0.2;
      pos[i * 3 + 2] = Math.sin(a) * r;
      vel[i * 3] = (Math.random() - 0.5) * 0.4;
      vel[i * 3 + 1] = 0.35 + Math.random() * 0.55;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    (g as THREE.BufferGeometry & { userData: { vel: Float32Array } }).userData = { vel };
    return g;
  }, [cleanCount, radius]);

  const burstGeo = useMemo(() => {
    const pos = new Float32Array(burstCount * 3);
    const vel = new Float32Array(burstCount * 3);
    for (let i = 0; i < burstCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const elev = Math.random() * Math.PI * 0.45;
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0.75;
      pos[i * 3 + 2] = 0;
      const sp = 1.2 + Math.random() * 1.8;
      vel[i * 3] = Math.cos(a) * Math.cos(elev) * sp;
      vel[i * 3 + 1] = Math.sin(elev) * sp + 0.8;
      vel[i * 3 + 2] = Math.sin(a) * Math.cos(elev) * sp;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    (g as THREE.BufferGeometry & { userData: { vel: Float32Array } }).userData = { vel };
    return g;
  }, [burstCount]);

  const mistGeo = useMemo(() => {
    const p = new Float32Array(24 * 3);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      p[i * 3] = Math.cos(a) * radius * 0.55;
      p[i * 3 + 1] = 0.72;
      p[i * 3 + 2] = Math.sin(a) * radius * 0.55;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [radius]);

  const celebrating = celebrateUntil > 0;

  useEffect(() => {
    if (!celebrating || !burstRef.current) return;
    const attr = burstRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
    const vel = (burstRef.current.geometry as THREE.BufferGeometry & { userData: { vel: Float32Array } })
      .userData.vel;
    for (let i = 0; i < burstCount; i++) {
      attr.array[i * 3] = 0;
      attr.array[i * 3 + 1] = 0.75;
      attr.array[i * 3 + 2] = 0;
      const a = Math.random() * Math.PI * 2;
      const elev = Math.random() * Math.PI * 0.45;
      const sp = 1.2 + Math.random() * 1.8;
      vel[i * 3] = Math.cos(a) * Math.cos(elev) * sp;
      vel[i * 3 + 1] = Math.sin(elev) * sp + 0.8;
      vel[i * 3 + 2] = Math.sin(a) * Math.cos(elev) * sp;
    }
    attr.needsUpdate = true;
  }, [celebrating, burstCount, celebrateUntil]);

  useFrame((_, dt) => {
    if (status === "CLEANING" && cleanRef.current) {
      const attr = cleanRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      const vel = (cleanRef.current.geometry as THREE.BufferGeometry & { userData: { vel: Float32Array } })
        .userData.vel;
      for (let i = 0; i < cleanCount; i++) {
        attr.array[i * 3] += vel[i * 3] * dt;
        attr.array[i * 3 + 1] += vel[i * 3 + 1] * dt;
        attr.array[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (attr.array[i * 3 + 1] > 1.85) {
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * radius * 0.85;
          attr.array[i * 3] = Math.cos(a) * r;
          attr.array[i * 3 + 1] = 0.68;
          attr.array[i * 3 + 2] = Math.sin(a) * r;
        }
      }
      attr.needsUpdate = true;
    }
    if (celebrating && burstRef.current) {
      const attr = burstRef.current.geometry.getAttribute("position") as THREE.BufferAttribute;
      const vel = (burstRef.current.geometry as THREE.BufferGeometry & { userData: { vel: Float32Array } })
        .userData.vel;
      for (let i = 0; i < burstCount; i++) {
        attr.array[i * 3] += vel[i * 3] * dt;
        attr.array[i * 3 + 1] += vel[i * 3 + 1] * dt;
        attr.array[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3 + 1] -= 3.2 * dt;
      }
      attr.needsUpdate = true;
      const mat = burstRef.current.material as THREE.PointsMaterial;
      const left = Math.max(0, celebrateUntil - performance.now());
      mat.opacity = Math.min(1, left / 600);
    }
  });

  return (
    <group raycast={() => null}>
      {status === "CLEANING" && (
        <>
          <points ref={cleanRef} geometry={cleanGeo} raycast={() => null}>
            <pointsMaterial
              color="#7ec8ff"
              size={0.07}
              transparent
              opacity={0.85}
              depthWrite={false}
              sizeAttenuation
            />
          </points>
          <points geometry={mistGeo} raycast={() => null}>
            <pointsMaterial
              color="#e8f4ff"
              size={0.05}
              transparent
              opacity={0.7}
              depthWrite={false}
            />
          </points>
        </>
      )}

      {status === "OUT_OF_SERVICE" &&
        [0, 1, 2].map((i) => {
          const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
          const r = radius + 0.28;
          return (
            <group
              key={i}
              position={[Math.cos(a) * r, 0, Math.sin(a) * r]}
              rotation={[0, -a, 0]}
              raycast={() => null}
            >
              <mesh position={[0, 0.28, 0]} raycast={() => null}>
                <coneGeometry args={[0.14, 0.48, 12]} />
                <meshStandardMaterial color="#f5a623" roughness={0.55} metalness={0.05} />
              </mesh>
              <mesh position={[0, 0.22, 0]} raycast={() => null}>
                <cylinderGeometry args={[0.145, 0.145, 0.06, 12]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
              </mesh>
              <mesh position={[0, 0.34, 0]} raycast={() => null}>
                <cylinderGeometry args={[0.12, 0.12, 0.05, 12]} />
                <meshStandardMaterial color="#f5f5f5" roughness={0.7} />
              </mesh>
            </group>
          );
        })}

      {celebrating && (
        <points ref={burstRef} geometry={burstGeo} raycast={() => null}>
          <pointsMaterial
            color={primary}
            size={0.09}
            transparent
            opacity={1}
            depthWrite={false}
            sizeAttenuation
          />
        </points>
      )}
    </group>
  );
}

/** Panel de edición rápida de mesa (sin salir del salón). */
function TableEditPanel({
  table,
  onClose,
  anchor,
}: {
  table: TableItem;
  onClose: () => void;
  anchor: { x: number; y: number };
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [number, setNumber] = useState(String(table.number));
  const [capacity, setCapacity] = useState(table.capacity || 4);
  const [shape, setShape] = useState<TableShape>((table.shape ?? "ROUND") as TableShape);
  const [area, setArea] = useState(table.area ?? "");
  const [status, setStatus] = useState<TableStatus>((table.status ?? "FREE") as TableStatus);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: async () => {
      await updateTable(table.id, {
        number: number.trim(),
        capacity,
        shape,
        area: area.trim() || null,
      });
      const current = (table.status ?? "FREE") as TableStatus;
      if (status === current) return;
      if (status === "FREE") return freeTable(table.id);
      if (status === "RESERVED") return reserveTable(table.id);
      if (status === "CLEANING") return cleanTable(table.id);
      if (status === "OUT_OF_SERVICE") {
        return bulkUpdateTableStatus([table.id], "OUT_OF_SERVICE");
      }
      if (status === "OCCUPIED") {
        // Ocupar solo tiene sentido con orden; no forzar desde el salón.
        return;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message || "No se pudo guardar la mesa"),
  });

  return (
    <div
      className="absolute z-30 w-[min(calc(100%-1.5rem),16.5rem)] rounded-2xl border border-border bg-card p-3 text-card-foreground shadow-2xl"
      style={{
        left: `clamp(12px, ${anchor.x + 18}px, calc(100% - 17.2rem))`,
        top: `clamp(12px, ${anchor.y - 12}px, calc(100% - 22rem))`,
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Editar mesa {table.number}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="rounded-lg p-1 text-muted-foreground hover:bg-white/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!number.trim()) return;
          mutation.mutate();
        }}
      >
        <label className="text-[11px] font-medium text-muted-foreground">
          Número
          <Input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            className="mt-1 h-9"
            required
          />
        </label>
        <label className="text-[11px] font-medium text-muted-foreground">
          Capacidad (puestos)
          <Input
            type="number"
            min={1}
            max={20}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value) || 4)}
            className="mt-1 h-9"
          />
        </label>
        <label className="text-[11px] font-medium text-muted-foreground">
          Forma
          <Select
            value={shape}
            onChange={(e) => setShape(e.target.value as TableShape)}
            className="mt-1 h-9"
            options={[
              { value: "ROUND", label: "Redonda" },
              { value: "SQUARE", label: "Cuadrada" },
              { value: "RECTANGLE", label: "Rectangular" },
              { value: "OVAL", label: "Ovalada" },
            ]}
          />
        </label>
        <label className="text-[11px] font-medium text-muted-foreground">
          Estado
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as TableStatus)}
            className="mt-1 h-9"
            options={[
              { value: "FREE", label: "Libre" },
              { value: "RESERVED", label: "Reservada" },
              { value: "CLEANING", label: "Limpieza" },
              { value: "OUT_OF_SERVICE", label: "Fuera de servicio" },
              ...(status === "OCCUPIED"
                ? [{ value: "OCCUPIED", label: "Ocupada" }]
                : []),
            ]}
          />
        </label>
        <label className="text-[11px] font-medium text-muted-foreground">
          Área (opcional)
          <Input
            value={area}
            onChange={(e) => setArea(e.target.value)}
            placeholder="Terraza, Salón…"
            className="mt-1 h-9"
          />
        </label>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="mt-1 inline-flex h-10 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {mutation.isPending ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}

function OccupiedTooltip({ table }: { table: TableItem }) {
  const elapsed = useElapsedTime(table.occupied_since, {
    enabled: table.status === "OCCUPIED",
  });
  const orderId = table.current_order_id || null;
  const { data: order } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId as string),
    enabled: Boolean(orderId),
    staleTime: 30_000,
  });
  const total = order ? Number(order.total_amount ?? 0) : 0;

  return (
    <div className="pointer-events-none absolute bottom-14 right-3 z-10 max-w-[200px] rounded-xl border border-border bg-card px-3 py-2 text-xs text-card-foreground shadow-lg">
      <p className="font-semibold text-foreground">Mesa {table.number}</p>
      <p className="text-muted-foreground">{table.area || "Sin área"}</p>
      <p className="mt-1 flex items-center gap-1 font-medium text-primary">
        <Clock className="h-3 w-3" />
        {elapsed.text} en consumo
      </p>
      {order && (
        <p className="mt-1 font-bold tabular-nums text-success">
          {formatCLP(total)} consumidos
        </p>
      )}
    </div>
  );
}

export { CANVAS_WIDTH, CANVAS_HEIGHT };
export { needsTableAutoLayout, layoutTables } from "@/lib/tables/layout";
