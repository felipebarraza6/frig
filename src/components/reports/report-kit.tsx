"use client";

import { Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn, formatCLP } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  DATE_PRESET_LABELS,
  matchPreset,
  rangeDates,
  type DatePreset,
} from "@/lib/date-range";

/**
 * Kit de informes: filtros de fecha, tarjetas KPI con comparación
 * período-a-período (PoP: valor actual + delta % vs el período anterior
 * equivalente) y secciones agrupadas con barra de participación.
 * La navegación entre informes vive solo en el menú lateral.
 */

/** Ventana del período anterior de igual duración, inmediatamente anterior. */
export function previousWindow(
  start: string,
  end: string,
): { start: string; end: string } {
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
  };
  const fmt = (ts: number) => new Date(ts).toISOString().slice(0, 10);
  const s = parse(start || fmtDateToday());
  const e = parse(end || fmtDateToday());
  const len = Math.max(1, Math.round((e - s) / 86_400_000) + 1);
  return { start: fmt(s - len * 86_400_000), end: fmt(s - 86_400_000) };
}

function fmtDateToday(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Cambio porcentual curr vs prev (null cuando no hay base comparable). */
export function pctChange(curr: number, prev: number): number | null {
  if (prev <= 0) return curr > 0 ? null : 0;
  return ((curr - prev) / prev) * 100;
}

/** Chip de delta: ▲/▼ con % coloreado según si subir es bueno o malo. */
export function DeltaChip({
  curr,
  prev,
  goodWhenUp = true,
}: {
  curr: number;
  prev: number;
  goodWhenUp?: boolean;
}) {
  const pct = pctChange(curr, prev);
  if (pct === null || !Number.isFinite(pct) || prev <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Minus className="h-3 w-3" /> sin base de comparación
      </span>
    );
  }
  if (pct === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Minus className="h-3 w-3" /> sin cambio
      </span>
    );
  }
  const up = pct > 0;
  const good = goodWhenUp ? up : !up;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
        good ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
      )}
      title={`${pct > 0 ? "+" : ""}${pct.toFixed(1)}% vs período anterior`}
    >
      {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
    </span>
  );
}

/** Chip circular de ícono con tono (mismo lenguaje que el Dashboard). */
export type ReportKpiTone = "emerald" | "rose" | "blue" | "amber" | "slate";

const KPI_TONE_CHIP: Record<ReportKpiTone, string> = {
  emerald: "bg-success/12 text-success",
  rose: "bg-danger/12 text-danger",
  blue: "bg-primary/10 text-primary",
  amber: "bg-warning/12 text-warning",
  slate: "bg-muted/12 text-muted-foreground",
};

const KPI_TONE_ACCENT: Record<ReportKpiTone, string> = {
  emerald: "border-l-[3px] border-l-success/45",
  rose: "border-l-[3px] border-l-danger/45",
  blue: "border-l-[3px] border-l-primary/45",
  amber: "border-l-[3px] border-l-warning/45",
  slate: "border-l-[3px] border-l-border",
};

interface ReportKpiProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: ReportKpiTone;
  hint?: string;
  /** Chip de delta PoP (▲/▼ vs período anterior). */
  delta?: React.ReactNode;
}

/** Tarjeta KPI de informe: superficie glass + chip de tono (alineada a StatCard). */
export function ReportKpi({ label, value, icon: Icon, tone = "slate", hint, delta }: ReportKpiProps) {
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-2 overflow-hidden rounded-2xl glass p-5 transition-colors hover:brightness-[1.02]",
        KPI_TONE_ACCENT[tone],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            KPI_TONE_CHIP[tone],
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
        {delta}
      </div>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** Transición suave al cambiar de pestaña en informes. */
export function ReportTabPanels({
  activeKey,
  children,
  className,
}: {
  activeKey: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={activeKey}
        role="tabpanel"
        className={className}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** Presets que ReportDateFilters muestra por defecto. */
const DEFAULT_DATE_PRESETS: DatePreset[] = [
  "today",
  "last_7_days",
  "last_30_days",
  "current_month",
  "last_month",
];

interface ReportDateFiltersProps {
  start: string;
  end: string;
  onChange: (range: { start: string; end: string }) => void;
  /** Presets en píldora; por defecto hoy, 7d, 30d, este mes y mes pasado. */
  presets?: DatePreset[];
  /** Prefijo de los ids/labels de los inputs (para ids únicos por página). */
  idPrefix?: string;
}

/** Filtros de fecha de informes: inputs Desde/Hasta + presets en píldoras +
 *  etiqueta del rango activo. Controlado: el estado vive en la página y la
 *  píldora activa se detecta comparando el rango con cada preset. */
export function ReportDateFilters({
  start,
  end,
  onChange,
  presets = DEFAULT_DATE_PRESETS,
  idPrefix = "rdf",
}: ReportDateFiltersProps) {
  const activePreset = matchPreset(start, end);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-start`} className="text-xs text-muted-foreground">
          Desde
        </label>
        <Input
          id={`${idPrefix}-start`}
          type="date"
          value={start}
          onChange={(e) => onChange({ start: e.target.value, end })}
          className="h-9 w-[150px]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${idPrefix}-end`} className="text-xs text-muted-foreground">
          Hasta
        </label>
        <Input
          id={`${idPrefix}-end`}
          type="date"
          value={end}
          onChange={(e) => onChange({ start, end: e.target.value })}
          className="h-9 w-[150px]"
        />
      </div>
      <div className="flex gap-1 pb-0.5">
        {presets.map((p) => {
          const r = rangeDates(p);
          const active = activePreset === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ start: r.start, end: r.end })}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50",
              )}
            >
              {DATE_PRESET_LABELS[p]}
            </button>
          );
        })}
      </div>
      <span className="pb-1 text-[11px] text-muted-foreground">
        {rangeDates(activePreset ?? "custom", { start, end }).label}
      </span>
    </div>
  );
}

/** Barra horizontal de participación (value sobre max) con % al costado. */
export function ShareBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <div className="h-1.5 min-w-4 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-[10px] font-medium tabular-nums text-muted-foreground">
        {pct}%
      </span>
    </div>
  );
}

export interface ReportGroupRow {
  key: string;
  count: number;
  total: number;
  /** Métrica secundaria opcional (ej. margen o neto); se colorea por signo. */
  secondary?: number;
}

interface GroupPanelProps {
  title: string;
  icon: LucideIcon;
  rows: ReportGroupRow[];
  /** Encabezados de las columnas de datos. */
  columns: { count: string; total: string; secondary?: string };
  /** true cuando va embebido en un contenedor compartido (sin borde propio). */
  full?: boolean;
  emptyMessage?: string;
}

/** Sección agrupada de un informe: título con ícono, tabla en escritorio /
 *  tarjetas en móvil, barra de participación y fila de totales. */
export function GroupPanel({
  title,
  icon: Icon,
  rows,
  columns,
  full,
  emptyMessage = "Sin datos en el período.",
}: GroupPanelProps) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  const totalAll = rows.reduce((acc, r) => acc + r.total, 0);
  const totalCount = rows.reduce((acc, r) => acc + r.count, 0);
  const totalSecondary = rows.reduce((acc, r) => acc + (r.secondary ?? 0), 0);
  return (
    <section
      className={cn(
        "min-w-0",
        !full && "glass overflow-hidden rounded-2xl",
      )}
    >
      <div className={cn("flex items-center gap-2.5", full ? "px-4 pt-4 pb-3 sm:px-5" : "p-4 pb-3")}>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{rows.length} grupo(s)</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <>
          {/* Tabla en escritorio */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-y border-border/60 bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2 font-medium sm:px-5">Detalle</th>
                  <th className="px-3 py-2 text-center font-medium">{columns.count}</th>
                  <th className="px-3 py-2 text-right font-medium">{columns.total}</th>
                  {columns.secondary && (
                    <th className="px-3 py-2 text-right font-medium">{columns.secondary}</th>
                  )}
                  <th className="w-32 px-4 py-2 font-medium sm:px-5">Participación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((g) => (
                  <tr key={g.key} className="transition-colors hover:bg-muted/30">
                    <td className="max-w-[200px] truncate px-4 py-2.5 font-medium sm:px-5">{g.key}</td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-muted-foreground">{g.count}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatCLP(g.total)}</td>
                    {columns.secondary && (
                      <td
                        className={cn(
                          "px-3 py-2.5 text-right tabular-nums",
                          (g.secondary ?? 0) >= 0 ? "text-success" : "text-danger",
                        )}
                      >
                        {formatCLP(g.secondary ?? 0)}
                      </td>
                    )}
                    <td className="px-4 py-2.5 sm:px-5">
                      <ShareBar value={g.total} max={max} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/60 bg-muted/20 text-[13px] font-semibold">
                  <td className="px-4 py-2.5 sm:px-5">Total</td>
                  <td className="px-3 py-2.5 text-center tabular-nums">{totalCount}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatCLP(totalAll)}</td>
                  {columns.secondary && (
                    <td
                      className={cn(
                        "px-3 py-2.5 text-right tabular-nums",
                        totalSecondary >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {formatCLP(totalSecondary)}
                    </td>
                  )}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          {/* Tarjetas en móvil */}
          <div className="divide-y divide-border/60 border-t border-border/60 md:hidden">
            {rows.map((g) => (
              <div key={g.key} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{g.key}</span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{formatCLP(g.total)}</span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    {g.count} · {columns.count.toLowerCase()}
                  </span>
                  {columns.secondary && (
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        (g.secondary ?? 0) >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {columns.secondary} {formatCLP(g.secondary ?? 0)}
                    </span>
                  )}
                </div>
                <ShareBar value={g.total} max={max} />
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
