"use client";

import { cn } from "@/lib/utils";
import { PRESET_THEMES, getThemeById, type ThemePalette } from "@/lib/themes";
import { TrendingUp, Package, DollarSign, ArrowUpRight } from "lucide-react";

/** Mini-card tipo dashboard dentro del preview. */
function DashboardMiniCard({
  label,
  value,
  sub,
  theme,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  theme: ThemePalette;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const isDark = theme.mode === "dark";
  return (
    <div
      className="relative overflow-hidden rounded-lg p-2"
      style={{
        background: `linear-gradient(135deg, ${theme.primary}18 0%, ${theme.secondary}18 100%)`,
        border: `1px solid ${isDark ? theme.muted + "44" : theme.muted + "33"}`,
      }}
    >
      <div className="flex items-start justify-between">
        <p
          className="text-[8px] font-medium leading-tight"
          style={{ color: isDark ? theme.text + "99" : theme.text + "80" }}
        >
          {label}
        </p>
        <div
          className="flex h-4 w-4 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.primary + "33", color: theme.primary }}
        >
          <Icon className="h-2 w-2" />
        </div>
      </div>
      <p className="mt-0.5 text-[11px] font-bold tabular-nums" style={{ color: theme.text }}>
        {value}
      </p>
      <p className="text-[7px]" style={{ color: isDark ? theme.muted : theme.muted + "cc" }}>
        {sub}
      </p>
    </div>
  );
}

/** Preview realista con cards tipo dashboard. */
function ThemePreviewCard({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemePalette;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const isDark = theme.mode === "dark";

  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 transition-all",
        selected
          ? "border-primary ring-2 ring-primary/30 ring-offset-2"
          : "border-border hover:border-primary/50",
      )}
      style={{ backgroundColor: theme.surface }}
    >
      {/* Header: nombre + badge modo */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold" style={{ color: theme.text }}>
          {theme.label}
        </span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[8px] font-medium"
          style={{
            backgroundColor: isDark ? theme.primary + "33" : theme.primary + "22",
            color: theme.primary,
          }}
        >
          {isDark ? "Dark" : "Light"}
        </span>
      </div>

      {/* Mini dashboard: 4 cards */}
      <div className="grid grid-cols-2 gap-1.5 px-3 pb-2">
        <DashboardMiniCard label="Ventas" value="$0" sub="0 ventas" theme={theme} icon={DollarSign} />
        <DashboardMiniCard label="Productos" value="0" sub="activos" theme={theme} icon={Package} />
        <DashboardMiniCard label="Ingresos" value="$0" sub="del mes" theme={theme} icon={TrendingUp} />
        <DashboardMiniCard label="Clientes" value="0" sub="registrados" theme={theme} icon={ArrowUpRight} />
      </div>

      {/* Barra tricolor */}
      <div className="mx-3 mb-3 flex h-1.5 overflow-hidden rounded-full">
        <div className="flex-1" style={{ backgroundColor: theme.primary }} />
        <div className="flex-1" style={{ backgroundColor: theme.secondary }} />
        <div className="flex-1" style={{ backgroundColor: theme.accent }} />
      </div>

      {/* Check seleccionado */}
      {selected && (
        <div
          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full shadow-sm"
          style={{ backgroundColor: theme.primary }}
        >
          <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" style={{ color: theme.surface }}>
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </button>
  );
}

/** Galería: 4 themes × 2 modos = 8 cards. */
export function ThemeGallery({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {PRESET_THEMES.map((theme) => (
        <ThemePreviewCard
          key={theme.id}
          theme={theme}
          selected={theme.id === value}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}

/** Descriptor del theme activo. */
export function ThemeDescription({ themeId }: { themeId: string }) {
  const theme = getThemeById(themeId);
  if (!theme) return null;
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{theme.label}</span>{" "}
      <span className="text-xs">({theme.mode === "dark" ? "oscuro" : "claro"})</span>
      {" — "}
      {theme.description}
    </p>
  );
}
