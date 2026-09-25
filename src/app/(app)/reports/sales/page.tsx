"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  FileText,
  Layers,
  Loader2,
  Receipt,
  Store,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { PageHeader } from "@/components/page-header";
import { previousWindow, DeltaChip, ReportTabPanels } from "@/components/reports/report-kit";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody } from "@/components/ui/modal";
import { useCurrentBranch } from "@/lib/store/session";
import {
  downloadOrderA4Pdf,
  fetchOrders,
} from "@/lib/api/orders";
import { useDownloadFile } from "@/lib/hooks/useDownloadFile";
import { formatCLP, cn, orderStatusLabel, orderTypeLabel } from "@/lib/utils";

type OrderRow = {
  id: string;
  order_number?: string;
  order_type: string;
  status: string;
  date: string;
  total_amount?: number | string;
  total_cost?: number | string;
  client?: { name?: string } | null;
};

type TabKey = "resumen" | "ordenes" | "ventas" | "cliente";

// Entrada escalonada (convención de la app).
const container: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 24 } },
};


const TABS: { key: TabKey; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "ordenes", label: "Órdenes" },
  { key: "ventas", label: "Ventas" },
  { key: "cliente", label: "Clientes" },
];

const MAX_PAGES = 20;
const PAGE_SIZE = 200;

function fmtDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoInput(days: number): string {
  return fmtDateInput(new Date(Date.now() - days * 86_400_000));
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${v}`;
}


interface GroupRow {
  key: string;
  count: number;
  total: number;
  cost: number;
  margin: number;
}

function buildGroups(orders: OrderRow[], dimension: (o: OrderRow) => string): GroupRow[] {
  const map = new Map<string, GroupRow>();
  for (const o of orders) {
    const key = dimension(o) || "—";
    const g = map.get(key) ?? { key, count: 0, total: 0, cost: 0, margin: 0 };
    g.count += 1;
    const total = num(o.total_amount);
    const cost = num(o.total_cost);
    g.total += total;
    g.cost += cost;
    g.margin = g.total - g.cost;
    map.set(key, g);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: "bg-success/10 text-success",
  PENDING: "bg-warning/10 text-warning",
  IN_PROGRESS: "bg-primary/10 text-primary",
  CANCELLED: "bg-danger/10 text-danger",
  RETURNED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-muted text-muted-foreground",
  DRAFT: "bg-muted text-muted-foreground",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATUS_BADGE[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {orderStatusLabel(status)}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
        <Receipt className="h-4.5 w-4.5 text-muted-foreground" />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function SectionHeading({
  title,
  hint,
  icon: Icon,
}: {
  title: string;
  hint?: string;
  icon: typeof Users;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} />
        <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
      </div>
      {hint ? (
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}

const KPI_TONE: Record<
  "success" | "danger" | "warning" | "primary",
  { surface: string; chip: string; value: string }
> = {
  success: {
    surface: "glass border-l-[3px] border-l-success/45",
    chip: "bg-success/15 text-success",
    value: "text-success",
  },
  primary: {
    surface: "glass border-l-[3px] border-l-primary/45",
    chip: "bg-primary/15 text-primary",
    value: "text-primary",
  },
  warning: {
    surface: "glass border-l-[3px] border-l-warning/45",
    chip: "bg-warning/15 text-warning",
    value: "text-warning",
  },
  danger: {
    surface: "glass border-l-[3px] border-l-danger/45",
    chip: "bg-danger/15 text-danger",
    value: "text-danger",
  },
};

/** KPI del informe: explicación clara + superficie glass teñida por tema. */
function KpiTile({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  delta,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon: typeof Users;
  tone: keyof typeof KPI_TONE;
  delta?: ReactNode;
}) {
  const t = KPI_TONE[tone];
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl p-4 transition-colors sm:p-5",
        t.surface,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", t.chip)}>
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">{label}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>
          </div>
        </div>
        {delta}
      </div>
      <p className={cn("font-display text-2xl font-semibold tabular-nums tracking-tight", t.value)}>
        {value}
      </p>
    </div>
  );
}

/** Galería de clientes: bloques con hover que revela info + click abre viewer. */
function ClientGallery({
  rows,
  limit,
  onSelect,
  selectedKey,
}: {
  rows: GroupRow[];
  limit?: number;
  onSelect: (key: string) => void;
  selectedKey?: string | null;
}) {
  const list = limit ? rows.slice(0, limit) : rows;
  const totalAll = rows.reduce((acc, r) => acc + r.total, 0);
  const compact = Boolean(limit);

  if (list.length === 0) {
    return <EmptyState message="Sin clientes en el período." />;
  }

  return (
    <div className={cn("flex flex-col gap-3", compact && "mx-auto w-full max-w-3xl")}>
      <ul
        className={cn(
          "grid gap-2.5",
          compact
            ? "grid-cols-2 sm:grid-cols-3 justify-items-stretch"
            : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3",
        )}
      >
        {list.map((g, i) => {
          const share = totalAll > 0 ? Math.round((g.total / totalAll) * 100) : 0;
          const active = selectedKey === g.key;
          const initials = g.key
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase() ?? "")
            .join("");

          return (
            <li key={g.key} className={compact ? "min-w-0" : undefined}>
              <motion.button
                type="button"
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: Math.min(i, 12) * 0.03,
                  type: "spring",
                  stiffness: 280,
                  damping: 26,
                }}
                onClick={() => onSelect(g.key)}
                className={cn(
                  "group relative flex w-full flex-col overflow-hidden rounded-xl border text-left outline-none transition-[border-color,box-shadow,transform] duration-300",
                  "border-border/70 bg-gradient-to-br from-background via-background to-muted/30",
                  "hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md",
                  "focus-visible:ring-2 focus-visible:ring-primary/40",
                  active && "border-primary/50 ring-1 ring-primary/25",
                  compact ? "h-[6.75rem]" : "h-[11.5rem] rounded-2xl",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute font-display font-semibold leading-none tabular-nums text-foreground/[0.04] transition-colors duration-300 group-hover:text-primary/[0.08]",
                    compact
                      ? "-right-0.5 -top-1 text-[2.75rem]"
                      : "-right-1 -top-3 text-[4.5rem]",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>

                <div
                  className={cn(
                    "relative z-[1] flex min-h-0 flex-1 flex-col",
                    compact ? "gap-1.5 p-2.5 sm:p-3" : "p-4",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "flex shrink-0 items-center justify-center rounded-lg font-display font-semibold tracking-tight transition-colors duration-300",
                        compact ? "h-7 w-7 text-[11px] rounded-md" : "h-10 w-10 rounded-xl text-sm",
                        i === 0
                          ? "bg-primary/15 text-primary"
                          : "bg-muted/80 text-muted-foreground group-hover:bg-primary/12 group-hover:text-primary",
                      )}
                    >
                      {initials || "·"}
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p
                        className={cn(
                          "truncate font-display font-semibold tracking-tight text-foreground",
                          compact ? "text-[12px] sm:text-[13px]" : "text-[15px]",
                        )}
                      >
                        {g.key}
                      </p>
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        {g.count} venta{g.count === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <p
                      className={cn(
                        "font-display font-semibold tabular-nums tracking-tight",
                        compact ? "text-base sm:text-lg" : "text-2xl",
                      )}
                    >
                      {fmtCompact(g.total)}
                    </p>
                    <div className={cn("overflow-hidden rounded-full bg-muted", compact ? "mt-1 h-0.5" : "mt-2 h-1")}>
                      <motion.div
                        className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-primary/55")}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, share)}%` }}
                        transition={{ duration: 0.45, ease: "easeOut", delay: 0.04 }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  className={cn(
                    "absolute inset-x-0 bottom-0 z-[2] translate-y-[calc(100%-0.25rem)] border-t border-border/60 bg-background/95 backdrop-blur-md transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    "group-hover:translate-y-0 group-focus-visible:translate-y-0",
                    active && "translate-y-0",
                    compact ? "px-2.5 pb-2 pt-1.5" : "px-4 pb-3.5 pt-3",
                  )}
                >
                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0 space-y-0.5 text-[10px] tabular-nums sm:text-[11px]">
                      <p className="text-muted-foreground">
                        {share}%
                        <span className="hidden sm:inline"> part.</span>
                      </p>
                      <p
                        className={cn(
                          "font-medium",
                          g.margin >= 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {fmtCompact(g.margin)}
                      </p>
                    </div>
                    <span className="shrink-0 text-[10px] font-semibold text-primary sm:text-[11px]">
                      Ver →
                    </span>
                  </div>
                </div>
              </motion.button>
            </li>
          );
        })}
      </ul>

      {limit && rows.length > limit ? (
        <p className="text-center text-[11px] text-muted-foreground">
          +{rows.length - limit} clientes más en la pestaña Clientes
        </p>
      ) : !limit ? (
        <div className="flex items-center justify-between border-t border-border/50 pt-3 text-[11px] font-medium">
          <span className="text-muted-foreground">
            {rows.length} cliente{rows.length === 1 ? "" : "s"} · hover para más · click para viewer
          </span>
          <span className="tabular-nums">{formatCLP(totalAll)}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Mix por origen (SALE / ORDER / …): barra + ranking. */
function TypeMix({ rows }: { rows: GroupRow[] }) {
  const totalAll = rows.reduce((acc, r) => acc + r.total, 0);

  if (rows.length === 0) {
    return <EmptyState message="Sin datos en el período." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {rows.map((g, i) => {
          const pct = totalAll > 0 ? (g.total / totalAll) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={g.key}
              className={cn(
                "h-full first:rounded-l-full last:rounded-r-full",
                i === 0 && "bg-primary",
                i === 1 && "bg-primary/60",
                i === 2 && "bg-primary/35",
                i >= 3 && "bg-primary/20",
              )}
              style={{ width: `${pct}%` }}
              title={`${g.key}: ${pct.toFixed(0)}%`}
            />
          );
        })}
      </div>

      <ul className="flex flex-col gap-2.5">
        {rows.map((g, i) => {
          const share = totalAll > 0 ? Math.round((g.total / totalAll) * 100) : 0;
          return (
            <li key={g.key} className="flex flex-col gap-1 rounded-xl bg-muted/30 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    i === 0 && "bg-primary",
                    i === 1 && "bg-primary/60",
                    i === 2 && "bg-primary/35",
                    i >= 3 && "bg-primary/20",
                  )}
                />
                <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{g.key}</p>
                <span className="w-9 shrink-0 text-right font-display text-sm font-semibold tabular-nums">
                  {share}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pl-4 text-[11px] tabular-nums text-muted-foreground">
                <span>
                  {g.count} reg · {fmtCompact(g.total)}
                </span>
                <span className={cn(g.margin >= 0 ? "text-success" : "text-danger")}>
                  Margen {fmtCompact(g.margin)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Panel emergente de origen (equivalente UX al resumen del negocio). */
function OrigenPanel({ rows }: { rows: GroupRow[] }) {
  const totalAll = rows.reduce((acc, r) => acc + r.total, 0);
  const countAll = rows.reduce((acc, r) => acc + r.count, 0);
  const marginAll = rows.reduce((acc, r) => acc + r.margin, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/60 bg-background/60 p-3 text-xs">
        <div>
          <p className="text-muted-foreground">Total período</p>
          <p className="font-semibold tabular-nums">{formatCLP(totalAll)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Registros</p>
          <p className="font-semibold tabular-nums">{countAll}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Orígenes</p>
          <p className="font-semibold tabular-nums">{rows.length}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Margen</p>
          <p
            className={cn(
              "font-semibold tabular-nums",
              marginAll >= 0 ? "text-success" : "text-danger",
            )}
          >
            {formatCLP(marginAll)}
          </p>
        </div>
      </div>
      <TypeMix rows={rows} />
    </div>
  );
}

function OrdersTable({
  rows,
  emptyMessage,
  showType = false,
  hideClient = false,
  embedded = false,
}: {
  rows: OrderRow[];
  emptyMessage: string;
  showType?: boolean;
  /** Oculta columna cliente (p. ej. modal ya filtrado por uno). */
  hideClient?: boolean;
  /** Layout plano para modal: más padding, thead sticky, scroll interno. */
  embedded?: boolean;
}) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const { download: downloadPdf } = useDownloadFile();

  async function handleDownloadA4(order: OrderRow) {
    setDownloading(order.id);
    try {
      const slug = order.order_number ?? order.id.slice(0, 8);
      await downloadPdf(() => downloadOrderA4Pdf(order.id), {
        filename: `boleta_${slug}_a4.pdf`,
      });
    } finally {
      setDownloading(null);
    }
  }

  const colSpan =
    5 + (showType ? 1 : 0) + (hideClient ? 0 : 1) + 1; /* + PDF */

  const cellPad = embedded ? "px-4 py-3.5" : "px-3 py-2.5";
  const headPad = embedded ? "px-4 pb-3 pt-1" : "px-3 pb-2";

  function DownloadBtn({ order }: { order: OrderRow }) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={cn(
          "gap-1 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20",
          embedded ? "h-8 px-2.5 text-xs" : "h-7 px-1.5 text-[10px]",
        )}
        onClick={() => handleDownloadA4(order)}
        isLoading={downloading === order.id}
        title="Descargar boleta A4"
      >
        <FileText className={embedded ? "h-3.5 w-3.5" : "h-3.5 w-3.5"} />
        A4
      </Button>
    );
  }

  return (
    <section className={cn(embedded && "flex min-h-0 flex-1 flex-col")}>
      {!embedded && (
        <p className="mb-3 text-xs text-muted-foreground">
          {rows.length} registro{rows.length === 1 ? "" : "s"} en el período · PDF A4 en cada fila
        </p>
      )}

      <div
        className={cn(
          "hidden md:block",
          embedded && "min-h-0 flex-1 overflow-auto rounded-xl border border-border/50",
        )}
      >
        <table className={cn("w-full text-[13px]", embedded ? "min-w-[720px]" : "min-w-[820px]")}>
          <thead
            className={cn(
              embedded && "sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border)/0.6)]",
            )}
          >
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className={cn("pr-3 font-medium", headPad, embedded && "pl-4")}>Fecha</th>
              <th className={cn("font-medium", headPad)}>N°</th>
              {showType ? <th className={cn("font-medium", headPad)}>Origen</th> : null}
              <th className={cn("font-medium", headPad)}>Estado</th>
              {!hideClient ? <th className={cn("font-medium", headPad)}>Cliente</th> : null}
              <th className={cn("text-right font-medium", headPad)}>Total</th>
              <th className={cn("text-right font-medium", headPad)}>Margen</th>
              <th className={cn("pl-3 text-right font-medium", headPad, embedded && "pr-4")}>PDF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan}>
                  <EmptyState message={emptyMessage} />
                </td>
              </tr>
            ) : (
              rows.map((o) => {
                const margin = num(o.total_amount) - num(o.total_cost);
                return (
                  <tr key={o.id} className="transition-colors hover:bg-muted/20">
                    <td className={cn("pr-3 text-muted-foreground", cellPad, embedded && "pl-4")}>
                      {new Date(o.date).toLocaleDateString("es-CL")}
                    </td>
                    <td className={cn("text-muted-foreground", cellPad)}>{o.order_number || "—"}</td>
                    {showType ? (
                      <td className={cellPad}>
                        <span
                          className={cn(
                            "inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                            o.order_type === "ORDER"
                              ? "bg-primary/10 text-primary"
                              : o.order_type === "SALE"
                                ? "bg-success/10 text-success"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {orderTypeLabel(o.order_type)}
                        </span>
                      </td>
                    ) : null}
                    <td className={cellPad}>
                      <StatusBadge status={o.status} />
                    </td>
                    {!hideClient ? (
                      <td className={cn("max-w-[180px] truncate", cellPad)}>
                        {o.client?.name ?? "Sin cliente"}
                      </td>
                    ) : null}
                    <td className={cn("text-right font-semibold tabular-nums", cellPad)}>
                      {formatCLP(num(o.total_amount))}
                    </td>
                    <td
                      className={cn(
                        "text-right tabular-nums",
                        cellPad,
                        margin >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {formatCLP(margin)}
                    </td>
                    <td className={cn("pl-3 text-right", cellPad, embedded && "pr-4")}>
                      <div className="flex justify-end">
                        <DownloadBtn order={o} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div
        className={cn(
          "md:hidden",
          embedded ? "min-h-0 flex-1 space-y-0 overflow-auto" : "divide-y divide-border/50",
        )}
      >
        {rows.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          rows.map((o) => {
            const margin = num(o.total_amount) - num(o.total_cost);
            return (
              <div
                key={o.id}
                className={cn(
                  "flex flex-col gap-2",
                  embedded
                    ? "border-b border-border/50 px-1 py-4 last:border-b-0"
                    : "py-3 first:pt-0",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCLP(num(o.total_amount))}
                  </span>
                  <StatusBadge status={o.status} />
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    {o.order_number || "Sin N°"}
                    {showType ? ` · ${orderTypeLabel(o.order_type)}` : ""}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {new Date(o.date).toLocaleDateString("es-CL")}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  {!hideClient ? (
                    <span className="truncate text-foreground/80">
                      {o.client?.name ?? "Sin cliente"}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        margin >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      Margen {formatCLP(margin)}
                    </span>
                  )}
                  {!hideClient ? (
                    <span
                      className={cn(
                        "shrink-0 font-medium tabular-nums",
                        margin >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      Margen {formatCLP(margin)}
                    </span>
                  ) : null}
                </div>
                <div className="flex justify-end pt-0.5">
                  <DownloadBtn order={o} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/** Escala suave (raíz) para que un pico no aplaste al resto. El valor real va en la etiqueta. */
function visualRatio(value: number, max: number): number {
  if (max <= 0 || value <= 0) return 0;
  return Math.sqrt(value / max);
}

/**
 * Barras CSS: valor siempre arriba, hover = zoom sutil, click = modal con detalle.
 */
function DailyChart({
  daily,
  orders,
}: {
  daily: { day: string; total: number }[];
  orders: OrderRow[];
}) {
  const totals = daily.map((d) => d.total);
  const maxVal = Math.max(...totals, 1);
  const positive = totals.filter((v) => v > 0);
  const minVal = positive.length > 0 ? Math.min(...positive) : 0;
  const midVal = median(positive.length > 0 ? positive : totals);
  const barMaxH = 160;

  const byDay = useMemo(() => {
    const map = new Map<string, OrderRow[]>();
    for (const o of orders) {
      const d = (o.date || "").slice(0, 10);
      if (!d) continue;
      const list = map.get(d) ?? [];
      list.push(o);
      map.set(d, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => num(b.total_amount) - num(a.total_amount));
    }
    return map;
  }, [orders]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { download: downloadPdf } = useDownloadFile();
  const selectedOrders = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const selectedTotal = selectedOrders.reduce((s, o) => s + num(o.total_amount), 0);

  async function handleDownloadA4(order: OrderRow) {
    setDownloadingId(order.id);
    try {
      await downloadPdf(() => downloadOrderA4Pdf(order.id), {
        filename: `boleta_${order.order_number ?? order.id.slice(0, 8)}_a4.pdf`,
      });
    } finally {
      setDownloadingId(null);
    }
  }

  function fmtDayLabel(day: string) {
    const [y, m, d] = day.split("-").map(Number);
    if (!y || !m || !d) return day;
    return new Date(y, m - 1, d).toLocaleDateString("es-CL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5">
          <span className="text-muted-foreground">Máx</span>
          <span className="font-semibold tabular-nums text-primary">{formatCLP(maxVal)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5">
          <span className="text-muted-foreground">Medio</span>
          <span className="font-semibold tabular-nums">{formatCLP(midVal)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5">
          <span className="text-muted-foreground">Mín</span>
          <span className="font-semibold tabular-nums">{formatCLP(minVal)}</span>
        </span>
      </div>

      <div className="flex items-end gap-1 overflow-x-auto pb-1 sm:gap-1.5">
        {daily.map((s) => {
          const ratio = visualRatio(s.total, maxVal);
          const h = s.total > 0 ? Math.max(8, ratio * barMaxH) : 0;
          const isMax = s.total === maxVal && s.total > 0;
          const dayOrders = byDay.get(s.day) ?? [];
          const orderCount = dayOrders.length;
          const interactive = orderCount > 0;
          const isSelected = selectedDay === s.day;
          // Solo cabe el número si la barra es suficientemente alta.
          const showCountInside = h >= 28 && orderCount > 0;
          const avgPerOrder = orderCount > 0 ? s.total / orderCount : 0;

          return (
            <button
              key={s.day}
              type="button"
              disabled={!interactive}
              aria-label={`${fmtDayLabel(s.day)}: ${formatCLP(s.total)}, ${orderCount} orden${orderCount === 1 ? "" : "es"}, promedio ${formatCLP(avgPerOrder)} por orden. Abrir detalle.`}
              onClick={() => {
                if (interactive) setSelectedDay(s.day);
              }}
              className={cn(
                "group flex min-w-[1.75rem] flex-1 shrink-0 flex-col items-center gap-1 sm:min-w-[2rem]",
                interactive ? "cursor-pointer" : "cursor-default opacity-40",
              )}
            >
              <span
                className={cn(
                  "relative z-10 rounded px-0.5 text-[10px] font-semibold tabular-nums leading-none bg-background",
                  isMax || isSelected ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
              >
                {s.total > 0 ? fmtCompact(s.total) : "·"}
              </span>
              <div
                className={cn(
                  "relative flex w-full max-w-[32px] items-end justify-center overflow-hidden rounded-t-md transition-colors duration-200",
                  isMax || isSelected
                    ? "bg-primary"
                    : "bg-primary/55 group-hover:bg-primary",
                  isSelected && "ring-2 ring-primary/25 ring-offset-1 ring-offset-background",
                )}
                style={{ height: `${h}px` }}
              >
                {showCountInside ? (
                  <span className="pb-1 text-[10px] font-bold tabular-nums leading-none text-white">
                    {orderCount}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] tabular-nums text-muted-foreground group-hover:text-foreground">
                {s.day.slice(8)}
              </span>
            </button>
          );
        })}
      </div>

      <Modal
        open={Boolean(selectedDay)}
        onClose={() => setSelectedDay(null)}
        size="sm"
        title={selectedDay ? fmtDayLabel(selectedDay) : "Detalle del día"}
        description={
          selectedDay
            ? `${formatCLP(selectedTotal)} · ${selectedOrders.length} orden${selectedOrders.length === 1 ? "" : "es"} · promedio ${formatCLP(selectedOrders.length ? selectedTotal / selectedOrders.length : 0)} / orden`
            : undefined
        }
      >
        <ModalBody className="pt-2">
          {selectedOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin órdenes este día.</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {selectedOrders.map((o) => {
                const busy = downloadingId === o.id;
                return (
                  <li
                    key={o.id}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[13px] font-medium">
                        {o.order_number || `#${o.id.slice(0, 8)}`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {orderTypeLabel(o.order_type)}
                        <span className="mx-1.5 text-border">·</span>
                        <span className="tabular-nums">{formatCLP(num(o.total_amount))}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadA4(o)}
                      disabled={Boolean(downloadingId)}
                      title="Descargar boleta A4"
                      aria-label={`Descargar PDF A4 de ${o.order_number || o.id.slice(0, 8)}`}
                      className={cn(
                        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium transition-colors",
                        "hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                      PDF A4
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ModalBody>
      </Modal>
    </div>
  );
}

export default function SalesReportPage() {
  const branch = useCurrentBranch();

  const [start, setStart] = useState(daysAgoInput(29));
  const [end, setEnd] = useState(fmtDateInput(new Date()));
  const [tab, setTab] = useState<TabKey>("resumen");
  const [showOrigen, setShowOrigen] = useState(false);
  const [clientDetail, setClientDetail] = useState<string | null>(null);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["sales-report", "orders", start, end, branch?.branch_id],
    queryFn: async () => {
      const all: OrderRow[] = [];
      let next: string | null | undefined = undefined;
      for (let page = 0; page < MAX_PAGES && (page === 0 || next); page++) {
        const data = await fetchOrders({
          start_date: start || undefined,
          end_date: end || undefined,
          page_size: PAGE_SIZE,
          next: page === 0 ? undefined : next,
        });
        all.push(...(data.results ?? []) as unknown as OrderRow[]);
        next = data.next;
      }
      return all;
    },
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  const rows = orders ?? [];
  const orderOnlyRows = useMemo(
    () => rows.filter((o) => o.order_type === "ORDER"),
    [rows],
  );
  const saleOnlyRows = useMemo(
    () => rows.filter((o) => o.order_type === "SALE"),
    [rows],
  );

  // Período anterior de igual duración: base de la comparación PoP.
  const prevWindow = useMemo(() => previousWindow(start, end), [start, end]);
  const { data: prevOrders } = useQuery({
    queryKey: ["sales-report", "orders-prev", prevWindow, branch?.branch_id],
    queryFn: async () => {
      const all: OrderRow[] = [];
      let next: string | null | undefined = undefined;
      for (let page = 0; page < MAX_PAGES && (page === 0 || next); page++) {
        const data = await fetchOrders({
          start_date: prevWindow.start || undefined,
          end_date: prevWindow.end || undefined,
          page_size: PAGE_SIZE,
          next: page === 0 ? undefined : next,
        });
        all.push(...(data.results ?? []) as unknown as OrderRow[]);
        next = data.next;
      }
      return { results: all };
    },
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });

  // fetchOrders devuelve el objeto paginado: extraer el array de resultados.
  const prevRows = useMemo(() => prevOrders?.results ?? [], [prevOrders]);

  const prevKpis = useMemo(() => {
    let total = 0;
    let cost = 0;
    const clients = new Set<string>();
    for (const o of prevRows) {
      total += num(o.total_amount);
      cost += num(o.total_cost);
      const c = (o.client as { name?: string } | null)?.name;
      if (c) clients.add(c);
    }
    return { total, margin: total - cost, count: prevRows.length, clients: clients.size };
  }, [prevRows]);

  const kpis = useMemo(() => {
    let total = 0;
    let cost = 0;
    for (const o of rows) {
      total += num(o.total_amount);
      cost += num(o.total_cost);
    }
    const margin = total - cost;
    return {
      total,
      margin,
      count: rows.length,
      avgPerOrder: rows.length > 0 ? total / rows.length : 0,
      marginPct: total > 0 ? Math.round((margin / total) * 100) : 0,
    };
  }, [rows]);

  // Vuelta de comparación por KPI (solo si hay datos del período anterior).
  const hasBase = prevKpis.count > 0 || prevRows.length > 0;

  const daily = useMemo(() => {
    const map = new Map<string, { day: string; total: number }>();
    for (const o of rows) {
      const d = (o.date || "").slice(0, 10);
      if (!d) continue;
      const g = map.get(d) ?? { day: d, total: 0 };
      g.total += num(o.total_amount);
      map.set(d, g);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [rows]);

  const byClient = useMemo(
    () => buildGroups(rows, (o) => o.client?.name ?? "Sin cliente"),
    [rows],
  );
  const byOrigen = useMemo(
    () => buildGroups(rows, (o) => orderTypeLabel(o.order_type)),
    [rows],
  );

  const clientDetailOrders = useMemo(() => {
    if (!clientDetail) return [];
    return rows.filter((o) => (o.client?.name ?? "Sin cliente") === clientDetail);
  }, [rows, clientDetail]);

  const clientDetailStats = useMemo(() => {
    let total = 0;
    let margin = 0;
    for (const o of clientDetailOrders) {
      total += num(o.total_amount);
      margin += num(o.total_amount) - num(o.total_cost);
    }
    return { total, margin, count: clientDetailOrders.length };
  }, [clientDetailOrders]);

  return (
    <div className="relative mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <PageHeader
        title="Informe de ventas"
        subtitle="Analiza ventas del período: resumen, órdenes, ventas y clientes."
        icon={<TrendingUp className="h-5 w-5" />}
        className="sticky top-0 z-20 glass-strong border-b"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="tablist"
              aria-label="Secciones del informe"
              className="glass-chip inline-flex rounded-xl p-1"
            >
              {TABS.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    tab === t.key
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="glass-chip inline-flex items-center gap-1 rounded-xl p-1">
              <input
                id="sv-start"
                type="date"
                value={start}
                max={end}
                onChange={(e) => {
                  const next = e.target.value;
                  setStart(next);
                  if (end < next) setEnd(next);
                }}
                className="rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus:bg-muted"
              />
              <span className="text-xs text-muted-foreground">-</span>
              <input
                id="sv-end"
                type="date"
                value={end}
                min={start}
                onChange={(e) => {
                  const next = e.target.value;
                  setEnd(next);
                  if (start > next) setStart(next);
                }}
                className="rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus:bg-muted"
              />
            </div>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <ReportTabPanels activeKey={tab}>
            {tab === "resumen" ? (
          <div className="flex flex-col gap-5">
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            >
              <motion.div variants={item}>
                <KpiTile
                  icon={TrendingUp}
                  label="Ventas"
                  value={formatCLP(kpis.total)}
                  hint="Suma de montos de todas las órdenes del período"
                  tone="success"
                  delta={hasBase ? <DeltaChip curr={kpis.total} prev={prevKpis.total} goodWhenUp /> : undefined}
                />
              </motion.div>
              <motion.div variants={item}>
                <KpiTile
                  icon={Receipt}
                  label="Órdenes"
                  value={String(kpis.count)}
                  hint={`Cantidad de ventas · promedio ${formatCLP(kpis.avgPerOrder)} por orden`}
                  tone="primary"
                  delta={hasBase ? <DeltaChip curr={kpis.count} prev={prevKpis.count} goodWhenUp /> : undefined}
                />
              </motion.div>
              <motion.div variants={item}>
                <KpiTile
                  icon={Layers}
                  label="Margen"
                  value={formatCLP(kpis.margin)}
                  hint="Ventas menos el costo estimado de lo vendido"
                  tone="warning"
                  delta={hasBase ? <DeltaChip curr={kpis.margin} prev={prevKpis.margin} goodWhenUp /> : undefined}
                />
              </motion.div>
              <motion.div variants={item}>
                <KpiTile
                  icon={Users}
                  label="Clientes"
                  value={String(byClient.length)}
                  hint="Personas o empresas distintas que compraron en el período"
                  tone="danger"
                  delta={hasBase ? <DeltaChip curr={byClient.length} prev={prevKpis.clients} goodWhenUp /> : undefined}
                />
              </motion.div>
            </motion.div>

            <section>
              <SectionHeading
                title="Ventas por día"
                hint={`${daily.length} día${daily.length === 1 ? "" : "s"}`}
                icon={CalendarDays}
              />
              {daily.length === 0 ? (
                <EmptyState message="Sin ventas en el período." />
              ) : (
                <DailyChart daily={daily} orders={rows} />
              )}
            </section>

            <div className="grid min-w-0 gap-6 lg:grid-cols-12 lg:gap-8">
              <section className="min-w-0 lg:col-span-8">
                <div className="mx-auto w-full max-w-3xl">
                  <SectionHeading
                    title="Top clientes"
                    hint={`Top ${Math.min(6, byClient.length)} de ${byClient.length}`}
                    icon={Users}
                  />
                  <ClientGallery
                    rows={byClient}
                    limit={6}
                    onSelect={setClientDetail}
                    selectedKey={clientDetail}
                  />
                </div>
              </section>
              <section className="min-w-0 border-t border-border/60 pt-5 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                <SectionHeading title="Origen" hint={`${byOrigen.length}`} icon={Store} />
                <button
                  type="button"
                  onClick={() => setShowOrigen(true)}
                  className="glass group flex w-full flex-col gap-3 rounded-2xl p-4 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/12 text-primary">
                      <Target className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold tracking-tight">Ver por origen</p>
                      <p className="text-[11px] text-muted-foreground">
                        Ventas, órdenes y convenios del período
                      </p>
                    </div>
                  </div>
                  {byOrigen.length > 0 ? (
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                      {byOrigen.map((g, i) => {
                        const totalAll = byOrigen.reduce((a, r) => a + r.total, 0);
                        const pct = totalAll > 0 ? (g.total / totalAll) * 100 : 0;
                        if (pct <= 0) return null;
                        return (
                          <div
                            key={g.key}
                            className={cn(
                              "h-full first:rounded-l-full last:rounded-r-full",
                              i === 0 && "bg-primary",
                              i === 1 && "bg-primary/60",
                              i === 2 && "bg-primary/35",
                              i >= 3 && "bg-primary/20",
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Sin datos en el período.</p>
                  )}
                  <span className="text-[11px] font-medium text-primary group-hover:underline">
                    Abrir resumen de origen →
                  </span>
                </button>
              </section>
            </div>
          </div>
        ) : tab === "ordenes" ? (
          <OrdersTable
            rows={orderOnlyRows}
            emptyMessage="Sin órdenes (pedidos) en el período."
          />
        ) : tab === "ventas" ? (
          <OrdersTable
            rows={saleOnlyRows}
            emptyMessage="Sin ventas directas en el período."
          />
        ) : (
          <section>
            <p className="mb-4 text-xs text-muted-foreground">
              {byClient.length} cliente{byClient.length === 1 ? "" : "s"} · galería · hover revela margen · click abre viewer
            </p>
            <ClientGallery
              rows={byClient}
              onSelect={setClientDetail}
              selectedKey={clientDetail}
            />
          </section>
        )}
          </ReportTabPanels>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowOrigen(true)}
        className="glass-strong fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-foreground shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        <Target className="h-4 w-4 text-primary" />
        Origen
      </button>

      <Modal
        open={showOrigen}
        onClose={() => setShowOrigen(false)}
        title="Origen"
        size="sm"
      >
        <ModalBody>
          <OrigenPanel rows={byOrigen} />
        </ModalBody>
      </Modal>

      <Modal
        open={Boolean(clientDetail)}
        onClose={() => setClientDetail(null)}
        title={clientDetail ?? "Cliente"}
        size="xl"
        className="sm:h-[min(92vh,52rem)]"
        description={
          clientDetail
            ? `${clientDetailStats.count} registro${clientDetailStats.count === 1 ? "" : "s"} · ${formatCLP(clientDetailStats.total)} · margen ${formatCLP(clientDetailStats.margin)}`
            : undefined
        }
      >
        <ModalBody className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-4 sm:px-6">
          <div className="flex shrink-0 flex-wrap items-baseline gap-x-5 gap-y-1 border-b border-border/50 pb-3 text-xs">
            <span>
              <span className="text-muted-foreground">Registros </span>
              <span className="font-semibold tabular-nums">{clientDetailStats.count}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Total </span>
              <span className="font-semibold tabular-nums">{formatCLP(clientDetailStats.total)}</span>
            </span>
            <span>
              <span className="text-muted-foreground">Margen </span>
              <span
                className={cn(
                  "font-semibold tabular-nums",
                  clientDetailStats.margin >= 0 ? "text-success" : "text-danger",
                )}
              >
                {formatCLP(clientDetailStats.margin)}
              </span>
            </span>
            <span className="ml-auto text-muted-foreground">PDF A4 por fila</span>
          </div>
          <OrdersTable
            rows={clientDetailOrders}
            emptyMessage="Sin ventas de este cliente en el período."
            showType
            hideClient
            embedded
          />
        </ModalBody>
      </Modal>
    </div>
  );
}
