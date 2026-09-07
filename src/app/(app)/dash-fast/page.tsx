"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ShoppingBag,
  Banknote,
  ChefHat,
  Package,
  Users,
  Wallet,
  Store,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchModuleCounts, fetchDashboardSummary, type DateRange } from "@/lib/api/analytics";
import { fetchKitchenTickets } from "@/lib/api/kitchen";
import { formatCLP } from "@/lib/utils";
import { useCurrentBranch, useSessionStore } from "@/lib/store/session";
import { branchName } from "@/lib/types";

interface CubeFace {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  value: string;
  sub: string;
  tint: string;
  stats: { label: string; value: string }[];
}

const FACES_ORDER = ["front", "right", "back", "left", "top", "bottom"] as const;
const SIDE_INDEXES = [0, 1, 2, 3];

function faceTarget(face: (typeof FACES_ORDER)[number]): { ry: number; rx: number | null } {
  switch (face) {
    case "front":
      return { ry: -28, rx: null };
    case "right":
      return { ry: -118, rx: null };
    case "back":
      return { ry: -208, rx: null };
    case "left":
      return { ry: -298, rx: null };
    case "top":
      return { ry: -28, rx: -70 };
    case "bottom":
      return { ry: -28, rx: 70 };
  }
}

function faceTransform(face: (typeof FACES_ORDER)[number], popped: boolean): string {
  const depth = popped ? "calc(var(--cube-half) + 36px)" : "var(--cube-half)";
  switch (face) {
    case "front":
      return `translateZ(${depth})`;
    case "back":
      return `rotateY(180deg) translateZ(${depth})`;
    case "right":
      return `rotateY(90deg) translateZ(${depth})`;
    case "left":
      return `rotateY(-90deg) translateZ(${depth})`;
    case "top":
      return `rotateX(90deg) translateZ(${depth})`;
    case "bottom":
      return `rotateX(-90deg) translateZ(${depth})`;
  }
}

export default function DashFastPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const branch = useCurrentBranch();
  const sessionBranches = useSessionStore((s) => s.branches);
  const [filterBranch, setFilterBranch] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>("today");
  const activeBranch =
    filterBranch === "" ? undefined : (filterBranch ?? (branch?.branch_id !== undefined ? String(branch.branch_id) : undefined));
  const brandTheme = useSessionStore((s) => s.theme);
  const brandPrimary = brandTheme?.primary_color || "#2f6b3c";
  const brandSecondary = brandTheme?.secondary_color || "#e9bd4a";
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tilt, setTilt] = useState(14);
  const dragMoved = useRef(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const rangeBounds = useMemo(() => {
    const end = new Date();
    const start = new Date();
    if (range === "week") start.setDate(end.getDate() - 6);
    else if (range === "month") start.setDate(end.getDate() - 29);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
  }, [range]);

  const rangeLabel = range === "today" ? "hoy" : range === "week" ? "7 días" : "30 días";

  const countsQuery = useQuery({
    queryKey: ["dash-fast", "module-counts", activeBranch ?? "all"],
    queryFn: () => fetchModuleCounts(activeBranch),
  });

  const summaryQuery = useQuery({
    queryKey: ["dash-fast", "summary", activeBranch ?? "all", rangeBounds.start, rangeBounds.end],
    queryFn: () => fetchDashboardSummary(rangeBounds.start, rangeBounds.end, activeBranch),
  });

  const kitchenQuery = useQuery({
    queryKey: ["dash-fast", "kitchen", activeBranch ?? "all"],
    queryFn: () => fetchKitchenTickets(undefined, undefined, activeBranch),
    refetchInterval: 30_000,
  });

  const counts = countsQuery.data;
  const summary = summaryQuery.data;
  const ticketCounts = useMemo(() => {
    const tickets = kitchenQuery.data ?? [];
    let pending = 0;
    let preparing = 0;
    let ready = 0;
    for (const t of tickets) {
      if (t.status === "PENDING") pending += 1;
      else if (t.status === "PREPARING") preparing += 1;
      else if (t.status === "READY") ready += 1;
    }
    return { pending, preparing, ready, active: pending + preparing };
  }, [kitchenQuery.data]);

  const faces: CubeFace[] = useMemo(
    () => [
      {
        id: "front",
        label: "Ventas",
        href: "/sales",
        icon: ShoppingBag,
        value: summary ? String(summary.sales.count) : "—",
        sub: `ventas ${rangeLabel}`,
        tint: brandPrimary,
        stats: [
          { label: "Ventas", value: summary ? String(summary.sales.count) : "—" },
          { label: "Monto", value: summary ? formatCLP(summary.sales.total_amount) : "—" },
          { label: "Cobrado", value: summary ? formatCLP(summary.sales.paid_amount) : "—" },
        ],
      },
      {
        id: "right",
        label: "Por cobrar",
        href: "/payments",
        icon: Banknote,
        value: counts?.sales?.pending_sales_amount !== undefined ? formatCLP(counts.sales.pending_sales_amount) : "—",
        sub: "monto pendiente",
        tint: brandSecondary,
        stats: [
          { label: "Monto", value: counts?.sales?.pending_sales_amount !== undefined ? formatCLP(counts.sales.pending_sales_amount) : "—" },
          { label: "Cuentas", value: counts?.sales?.pending_orders !== undefined ? String(counts.sales.pending_orders) : "—" },
          { label: "Pagos", value: counts?.finance?.total_payments !== undefined ? String(counts.finance.total_payments) : "—" },
        ],
      },
      {
        id: "back",
        label: "Cocina",
        href: "/kds",
        icon: ChefHat,
        value: String(ticketCounts.active),
        sub: "tickets activos",
        tint: brandPrimary,
        stats: [
          { label: "Pendientes", value: String(ticketCounts.pending) },
          { label: "En cocina", value: String(ticketCounts.preparing) },
          { label: "Listos", value: String(ticketCounts.ready) },
        ],
      },
      {
        id: "left",
        label: "Inventario",
        href: "/inventory",
        icon: Package,
        value: counts?.inventory?.low_stock !== undefined ? String(counts.inventory.low_stock) : "—",
        sub: "con stock bajo",
        tint: brandSecondary,
        stats: [
          { label: "Stock bajo", value: counts?.inventory?.low_stock !== undefined ? String(counts.inventory.low_stock) : "—" },
          { label: "Productos", value: counts?.inventory?.total_products !== undefined ? String(counts.inventory.total_products) : "—" },
          { label: "Recetas", value: counts?.recipes?.total !== undefined ? String(counts.recipes.total) : "—" },
        ],
      },
      {
        id: "top",
        label: "Clientes",
        href: "/customers",
        icon: Users,
        value: counts?.customers?.total !== undefined ? String(counts.customers.total) : "—",
        sub: "registrados",
        tint: brandPrimary,
        stats: [
          { label: "Registrados", value: counts?.customers?.total !== undefined ? String(counts.customers.total) : "—" },
          { label: "Proveedores", value: counts?.suppliers?.total !== undefined ? String(counts.suppliers.total) : "—" },
        ],
      },
      {
        id: "bottom",
        label: "Finanzas",
        href: "/finance",
        icon: Wallet,
        value: counts?.finance?.total_payments !== undefined ? String(counts.finance.total_payments) : "—",
        sub: "movimientos",
        tint: brandSecondary,
        stats: [
          { label: "Pagos", value: counts?.finance?.total_payments !== undefined ? String(counts.finance.total_payments) : "—" },
          { label: "Egresos", value: counts?.finance?.total_expenses !== undefined ? String(counts.finance.total_expenses) : "—" },
          { label: "Por cobrar", value: counts?.sales?.pending_sales_amount !== undefined ? formatCLP(counts.sales.pending_sales_amount) : "—" },
        ],
      },
    ],
    [counts, summary, ticketCounts, brandPrimary, brandSecondary, rangeLabel],
  );

  const go = useCallback((dir: 1 | -1) => {
    setIndex((i) => (i + dir + FACES_ORDER.length) % FACES_ORDER.length);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const target = faceTarget(FACES_ORDER[index]);
  const rotY = target.ry + drag.x;
  const rotX = Math.max(-80, Math.min(80, (target.rx ?? tilt) + drag.y));
  const active = faces[index];
  const offline = countsQuery.isError && kitchenQuery.isError;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Dash rápido</h1>
          <p className="text-xs text-muted-foreground">El negocio en un cubo, arrastra o usa las flechas</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Ver dashboard clásico
          </Link>
        </div>
      </header>

      <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-background px-4 py-2.5 sm:px-6" role="group" aria-label="Filtros del tablero">
        {([
          { id: "today", label: "Hoy" },
          { id: "week", label: "7 días" },
          { id: "month", label: "30 días" },
        ] as { id: DateRange; label: string }[]).map((r) => (
          <button
            key={r.id}
            onClick={() => setRange(r.id)}
            aria-pressed={range === r.id}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
              range === r.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
        {sessionBranches.length > 1 && (
          <>
            <span aria-hidden className="h-5 w-px shrink-0 bg-border" />
            <Store className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <button
            onClick={() => setFilterBranch(null)}
            aria-pressed={filterBranch === null}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
              filterBranch === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Mi sucursal
          </button>
          <button
            onClick={() => setFilterBranch("")}
            aria-pressed={filterBranch === ""}
            className={cn(
              "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
              filterBranch === ""
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Todas
          </button>
          {sessionBranches.map((b) => {
            const id = String(b.branch_id);
            const selected = filterBranch === id;
            return (
              <button
                key={id}
                onClick={() => setFilterBranch(id)}
                aria-pressed={selected}
                className={cn(
                  "h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {branchName(b)}
              </button>
            );
          })}
          </>
        )}
      </div>

      <div className="mx-auto grid min-h-[68dvh] w-full max-w-4xl flex-1 content-center items-center justify-items-center gap-8 px-6 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="relative flex w-full items-center justify-center py-8" style={{ perspective: "1200px", minHeight: "min(78vw, 360px)" }}>
          <AnimatePresence>
            {!reduceMotion && (
              <motion.div
                key={index}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: `radial-gradient(circle, ${active.tint}44, transparent 65%)` }}
                initial={{ opacity: 0.9, scale: 0.7 }}
                animate={{ opacity: 0, scale: 1.25 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
            style={{ background: `radial-gradient(circle, ${active.tint}55, transparent 70%)` }}
          />
          {!reduceMotion && (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
              {active.stats.map((st, i) => (
                <motion.span
                  key={`${active.id}-${st.label}`}
                  className="absolute rounded-full border bg-card/90 px-2.5 py-1 text-[10px] font-semibold tabular-nums shadow-sm backdrop-blur"
                  style={{
                    borderColor: `${active.tint}66`,
                    left: i === 0 ? "2%" : i === 1 ? undefined : "12%",
                    right: i === 1 ? "2%" : undefined,
                    top: i === 0 ? "12%" : i === 1 ? "30%" : "78%",
                  }}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: [0, 1, 1, 0.85], scale: 1, y: [6, -6, 6] }}
                  transition={{ opacity: { duration: 0.4 }, scale: { duration: 0.4 }, y: { duration: 4 + i, repeat: Infinity, ease: "easeInOut" } }}
                >
                  {st.value} {st.label}
                </motion.span>
              ))}
              {[0, 1, 2, 3, 4, 5].map((d) => (
                <motion.span
                  key={`${active.id}-dot-${d}`}
                  className="absolute rounded-full"
                  style={{
                    width: 4,
                    height: 4,
                    background: active.tint,
                    left: `${18 + d * 11}%`,
                    top: d % 2 === 0 ? "8%" : "88%",
                  }}
                  animate={{ y: [0, d % 2 === 0 ? 14 : -14, 0], opacity: [0.2, 0.7, 0.2] }}
                  transition={{ duration: 3 + d * 0.5, repeat: Infinity, ease: "easeInOut" }}
                />
              ))}
            </div>
          )}
          <div
            className="w-full cursor-grab select-none active:cursor-grabbing"
            style={
              {
                touchAction: "none",
                overscrollBehavior: "contain",
                "--cube": "min(58vw, 260px)",
                "--cube-half": "calc(min(58vw, 260px) / 2)",
              } as CSSProperties
            }
            onPointerDown={(e) => {
              dragStart.current = { x: e.clientX, y: e.clientY };
              dragMoved.current = false;
            }}
            onPointerMove={(e) => {
              if (dragStart.current === null) return;
              const dx = e.clientX - dragStart.current.x;
              const dy = e.clientY - dragStart.current.y;
              if (Math.abs(dx) + Math.abs(dy) > 8) dragMoved.current = true;
              setDrag({ x: dx * 0.4, y: dy * 0.25 });
            }}
            onPointerUp={() => {
              if (dragStart.current === null) return;
              dragStart.current = null;
              const steps = Math.round(drag.x / -90);
              if (SIDE_INDEXES.includes(index)) {
                setIndex((i) => {
                  const pos = SIDE_INDEXES.indexOf(i);
                  return SIDE_INDEXES[(pos + steps + SIDE_INDEXES.length * 4) % SIDE_INDEXES.length];
                });
              } else if (steps !== 0) {
                setIndex(drag.x < 0 ? 1 : 3);
              }
              setTilt((t) => Math.max(-60, Math.min(60, t + drag.y)));
              setDrag({ x: 0, y: 0 });
            }}
            onPointerLeave={() => {
              dragStart.current = null;
              setDrag({ x: 0, y: 0 });
            }}
          >
            <motion.div
              className="relative mx-auto"
              style={{ width: "var(--cube)", height: "var(--cube)", transformStyle: "preserve-3d" }}
              animate={{ rotateY: rotY, rotateX: rotX, y: reduceMotion ? 0 : [0, -10, 0] }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      rotateY: { type: "spring", stiffness: 90, damping: 18 },
                      rotateX: { type: "spring", stiffness: 90, damping: 18 },
                      y: { duration: 5, repeat: Infinity, ease: "easeInOut" },
                    }
              }
            >
              {faces.map((face, i) => {
                const isActive = FACES_ORDER[index] === face.id;
                const isHovered = hovered === face.id;
                return (
                  <button
                    key={face.id}
                    onClick={() => {
                      if (dragMoved.current) return;
                      setIndex(i);
                    }}
                    onMouseEnter={() => setHovered(face.id)}
                    onMouseLeave={() => setHovered((h) => (h === face.id ? null : h))}
                    onMouseMove={(e) => {
                      const r = e.currentTarget.getBoundingClientRect();
                      e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                      e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
                    }}
                    aria-label={`${face.label}: ${face.value} ${face.sub}`}
                    className={cn(
                      "absolute inset-0 flex flex-col items-center justify-center gap-1 border p-4 text-center backdrop-blur transition-[filter,box-shadow,border-color,background] duration-300",
                      isActive ? "border-transparent" : "border-white/10",
                    )}
                    style={{
                      transform: faceTransform(face.id as (typeof FACES_ORDER)[number], isActive),
                      backfaceVisibility: "hidden",
                      background:
                        isActive || isHovered
                          ? `radial-gradient(circle 130px at var(--mx, 50%) var(--my, 50%), ${face.tint}4d, transparent 70%), color-mix(in oklab, ${face.tint} 16%, var(--card))`
                          : "var(--card)",
                      boxShadow:
                        isActive || isHovered ? `0 0 0 2px ${face.tint}, 0 0 44px -6px ${face.tint}` : "none",
                      filter: isHovered ? "brightness(1.06) saturate(1.2)" : undefined,
                    }}
                  >
                    <span
                      className="transition-transform duration-300"
                      style={{ transform: isHovered ? "scale(1.25) rotate(-6deg)" : undefined }}
                    >
                      <face.icon className="h-8 w-8" style={{ color: face.tint }} aria-hidden />
                    </span>
                    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{face.label}</span>
                    <motion.span
                      key={face.value}
                      initial={{ opacity: 0.3, scale: 0.94 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.25 }}
                      className="text-2xl font-extrabold tabular-nums tracking-tight"
                    >
                      {countsQuery.isLoading || summaryQuery.isLoading ? "…" : face.value}
                    </motion.span>
                    <span className="text-xs text-muted-foreground">{face.sub}</span>
                  </button>
                );
              })}
            </motion.div>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 lg:mx-0 lg:max-w-none">
          <button
            onClick={() => router.push(active.href)}
            className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-colors hover:border-primary/50"
          >
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: `linear-gradient(120deg, color-mix(in oklab, ${active.tint} 22%, transparent), transparent 60%)` }}>
              <active.icon className="h-6 w-6 shrink-0" style={{ color: active.tint }} aria-hidden />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-semibold">{active.label}</p>
                <p className="truncate text-xs text-muted-foreground">{active.sub} · toca para entrar</p>
              </div>
              <p className="shrink-0 text-lg font-extrabold tabular-nums">{active.value}</p>
            </div>
            <div className="flex flex-wrap gap-2 px-4 pb-4">
              {active.stats.map((st) => (
                <span key={st.label} className="inline-flex items-baseline gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs">
                  <span className="font-bold tabular-nums">{st.value}</span>
                  <span className="text-muted-foreground">{st.label}</span>
                </span>
              ))}
            </div>
          </button>
          {offline && (
            <p className="text-xs text-amber-600">Sin conexión, mostrando últimos datos</p>
          )}
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/80 px-3 py-2 shadow-sm backdrop-blur" style={{ overscrollBehavior: "contain" }}>
          <StepButton label="Anterior" onClick={() => go(-1)} />
          <div className="flex gap-1.5" role="tablist" aria-label="Caras del cubo">
            {faces.map((face, i) => (
              <button
                key={face.id}
                role="tab"
                aria-selected={i === index}
                aria-label={face.label}
                onClick={() => {
                  setIndex(i);
                }}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === index ? "w-6 bg-primary" : "w-2 bg-border hover:bg-muted-foreground",
                )}
              />
            ))}
          </div>
          <StepButton label="Siguiente" onClick={() => go(1)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex h-9 items-center rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {label}
    </button>
  );
}
