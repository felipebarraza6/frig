"use client";

import Link from "next/link";
import { Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Kit de informes: navegación entre reportes y tarjetas KPI con comparación
 * período-a-período (metodología PoP estándar de BI: valor actual + delta %
 * vs el período anterior equivalente + mini-tendencia).
 */

export const REPORT_TABS = [
  { href: "/reports/sales", label: "Ventas" },
  { href: "/reports/dinero", label: "Dinero" },
  { href: "/reports/ingresos", label: "Ingresos" },
  { href: "/reports/gastos", label: "Gastos" },
] as const;

/** Navegación entre informes: pestañas enlazadas, la activa resaltada. */
export function ReportNav({ active }: { active: string }) {
  return (
    <nav
      aria-label="Informes"
      className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/40 p-1"
    >
      {REPORT_TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={active === t.href ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            active === t.href
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

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

/** Mini-tendencia SVG (polyline normalizada) para tarjetas KPI. */
export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const pts = values.filter((v) => Number.isFinite(v));
  if (pts.length < 2) return null;
  const max = Math.max(...pts, 1);
  const min = Math.min(...pts, 0);
  const range = max - min || 1;
  const w = 96;
  const h = 28;
  const step = w / (pts.length - 1);
  const d = pts
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - min) / range) * (h - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-7 w-24", className)} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
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

const KPI_TONE_GRADIENT: Record<ReportKpiTone, string> = {
  emerald: "from-emerald-500/10 via-background to-background",
  rose: "from-danger/10 via-background to-background",
  blue: "from-primary/10 via-background to-background",
  amber: "from-warning/10 via-background to-background",
  slate: "from-muted/40 via-background to-background",
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

/** Tarjeta KPI de informe: fondo con gradiente del tono, chip circular de
 *  ícono y delta PoP. Visual alineado con StatCard del Dashboard. */
export function ReportKpi({ label, value, icon: Icon, tone = "slate", hint, delta }: ReportKpiProps) {
  return (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-gradient-to-br p-5 shadow-sm transition-transform hover:-translate-y-0.5",
        KPI_TONE_GRADIENT[tone],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform group-hover:scale-110",
            KPI_TONE_CHIP[tone],
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-bold tabular-nums tracking-tight">{value}</span>
        {delta}
      </div>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
