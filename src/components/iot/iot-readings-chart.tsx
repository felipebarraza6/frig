"use client";

import { useMemo } from "react";
import type { TelemetryAlertRule, TelemetryReading, TelemetryVariable } from "@/lib/api/iot";
import { valueDomain, variableSeries } from "@/lib/iot-chart";

const W = 320;
const H = 120;
const PAD = 10;

function formatValue(value: number, unit: string): string {
  return `${value.toLocaleString("es-CL", { maximumFractionDigits: 2 })} ${unit}`.trim();
}

function VariableChart({
  variable,
  readings,
  rules,
}: {
  variable: TelemetryVariable;
  readings: TelemetryReading[];
  rules: TelemetryAlertRule[];
}) {
  const series = useMemo(() => variableSeries(readings, String(variable.id)), [readings, variable.id]);
  const thresholds = rules
    .filter((r) => r.is_active !== false && String(r.variable) === String(variable.id))
    .map((r) => ({ type: r.target_type, value: Number(r.threshold_value) }))
    .filter((t) => Number.isFinite(t.value));

  if (series.length < 2) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">{variable.name}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Hacen falta al menos dos lecturas para dibujar la curva.
        </p>
      </div>
    );
  }

  const values = series.map((p) => p.value);
  const [min, max] = valueDomain(values, thresholds.map((t) => t.value));
  const first = series[0].at;
  const span = series[series.length - 1].at - first || 1;
  const x = (at: number) => PAD + ((at - first) / span) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
  const path = series.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.at)},${y(p.value)}`).join(" ");
  const last = series[series.length - 1];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{variable.name}</p>
        <p className="text-sm font-bold tabular-nums text-foreground">
          {formatValue(last.value, variable.unit)}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-2 h-28 w-full text-primary"
        role="img"
        aria-label={`Evolución de ${variable.name}: ${series.length} lecturas`}
      >
        {thresholds.map((t, i) => (
          <line
            key={i}
            x1={PAD}
            x2={W - PAD}
            y1={y(t.value)}
            y2={y(t.value)}
            strokeDasharray="4 4"
            strokeWidth="1.5"
            className={t.type === "THRESHOLD_MAX" ? "stroke-danger" : "stroke-warning"}
          />
        ))}
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx={x(last.at)} cy={y(last.value)} r="3.5" fill="currentColor" />
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>Mín {formatValue(Math.min(...values), variable.unit)}</span>
        {thresholds.map((t, i) => (
          <span key={i} className={t.type === "THRESHOLD_MAX" ? "text-danger" : "text-warning"}>
            {t.type === "THRESHOLD_MAX" ? "Máx permitido" : "Mín permitido"}{" "}
            {formatValue(t.value, variable.unit)}
          </span>
        ))}
        <span>Máx {formatValue(Math.max(...values), variable.unit)}</span>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {new Date(first).toLocaleString("es-CL")} → {new Date(last.at).toLocaleString("es-CL")}
      </p>
    </div>
  );
}

export function IotReadingsChart({
  variables,
  readings,
  rules,
}: {
  variables: TelemetryVariable[];
  readings: TelemetryReading[];
  rules: TelemetryAlertRule[];
}) {
  if (variables.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {variables.map((v) => (
        <VariableChart key={v.id} variable={v} readings={readings} rules={rules} />
      ))}
    </div>
  );
}
