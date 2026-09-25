"use client";

import { formatCLP, cn } from "@/lib/utils";

interface SparklineProps {
  data: number[];
  className?: string;
  /** Clase de color para stroke/fill (ej. text-primary, text-success). */
  toneClass?: string;
  fill?: boolean;
  /** Muestra min/máx del rango debajo. */
  showRange?: boolean;
}

/**
 * Mini evolución del período: curva suave con fill de marca, sin estirar el SVG.
 */
export function Sparkline({
  data,
  className,
  toneClass = "text-primary",
  fill = true,
  showRange = true,
}: SparklineProps) {
  if (data.length === 0) return null;

  const width = 320;
  const height = 88;
  const padX = 8;
  const padY = 10;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const getX = (i: number) => padX + (i / Math.max(data.length - 1, 1)) * chartW;
  const getY = (v: number) => padY + chartH - ((v - min) / range) * chartH;

  const path = data.reduce((acc, d, i) => {
    const px = getX(i);
    const py = getY(d);
    if (i === 0) return `M ${px},${py}`;
    const prevX = getX(i - 1);
    const prevY = getY(data[i - 1]);
    const cpX = prevX + (px - prevX) / 2;
    return `${acc} C ${cpX},${prevY} ${cpX},${py} ${px},${py}`;
  }, "");

  const areaPath = `${path} L ${getX(data.length - 1)},${height - padY} L ${getX(0)},${height - padY} Z`;
  const last = data[data.length - 1] ?? 0;
  const uid = `spark-${Math.abs(Math.round(max + min + data.length))}`;

  return (
    <div className={cn("w-full", toneClass, className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-20 w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden
      >
        <defs>
          <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Guía horizontal suave */}
        <line
          x1={padX}
          y1={getY(min + range / 2)}
          x2={width - padX}
          y2={getY(min + range / 2)}
          stroke="currentColor"
          strokeOpacity="0.08"
          strokeWidth="1"
        />
        {fill && <path d={areaPath} fill={`url(#${uid})`} />}
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={getX(data.length - 1)}
          cy={getY(last)}
          r="3.5"
          fill="currentColor"
          className="stroke-background"
          strokeWidth="2"
        />
      </svg>
      {showRange && (
        <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Mín {formatCLP(min)}</span>
          <span className="font-medium text-foreground">Último {formatCLP(last)}</span>
          <span>Máx {formatCLP(max)}</span>
        </div>
      )}
    </div>
  );
}
