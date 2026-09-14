"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { PRESET_THEMES, getThemeById, getBaseThemes, type ThemePalette } from "@/lib/themes";
import { TrendingUp, Package, DollarSign, ArrowUpRight } from "lucide-react";

/** Mini-card tipo dashboard dentro del preview — alto contraste. */
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
  // Card con fondo claro/oscuro definido para contraste real
  const cardBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)";
  const cardBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)";
  const labelColor = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.5)";
  const subColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";

  return (
    <div
      className="relative overflow-hidden rounded-lg p-2"
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
      }}
    >
      <div className="flex items-start justify-between">
        <p className="text-[8px] font-medium leading-tight" style={{ color: labelColor }}>
          {label}
        </p>
        <div
          className="flex h-4 w-4 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.primary + "20", color: theme.primary }}
        >
          <Icon className="h-2 w-2" />
        </div>
      </div>
      <p className="mt-0.5 text-[11px] font-bold tabular-nums" style={{ color: isDark ? "#fff" : "#111" }}>
        {value}
      </p>
      <p className="text-[7px]" style={{ color: subColor }}>
        {sub}
      </p>
    </div>
  );
}

/** Preview de un modo (light o dark) dentro del theme. */
function ThemeModePreview({
  theme,
  selected,
  mode,
  onSelect,
}: {
  theme: ThemePalette;
  selected: string;
  mode: "light" | "dark";
  onSelect: (id: string) => void;
}) {
  const isDark = mode === "dark";
  // El ID ya incluye el modo (ej: "aurora-light"), buscar la variante correcta
  const variant = PRESET_THEMES.find((t) => t.label === theme.label && t.mode === mode);
  const themeId = variant?.id ?? theme.id;
  const isSelected = selected === themeId;
  const previewTheme: ThemePalette = { ...theme, mode };

  return (
    <button
      type="button"
      onClick={() => onSelect(themeId)}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 transition-all",
        isSelected
          ? "border-primary ring-2 ring-primary/30 ring-offset-2"
          : "border-border/50 hover:border-primary/50",
      )}
      style={{
        backgroundColor: isDark ? "#0f172a" : "#fafaf9",
      }}
    >
      {/* Badge modo */}
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-semibold" style={{ color: isDark ? "#e2e8f0" : "#1c1917" }}>
          {isDark ? "Oscuro" : "Claro"}
        </span>
        {isSelected && (
          <div className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary }}>
            <svg viewBox="0 0 12 12" fill="none" className="h-3 w-3" style={{ color: "#fff" }}>
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </div>

      {/* Mini dashboard: 4 cards */}
      <div className="grid grid-cols-2 gap-1.5 px-3 pb-2">
        <DashboardMiniCard label="Ventas" value="$0" sub="0 ventas" theme={previewTheme} icon={DollarSign} />
        <DashboardMiniCard label="Productos" value="0" sub="activos" theme={previewTheme} icon={Package} />
        <DashboardMiniCard label="Ingresos" value="$0" sub="del mes" theme={previewTheme} icon={TrendingUp} />
        <DashboardMiniCard label="Clientes" value="0" sub="registrados" theme={previewTheme} icon={ArrowUpRight} />
      </div>

      {/* Barra tricolor */}
      <div className="mx-3 mb-3 flex h-1.5 overflow-hidden rounded-full">
        <div className="flex-1" style={{ backgroundColor: theme.primary }} />
        <div className="flex-1" style={{ backgroundColor: theme.secondary }} />
        <div className="flex-1" style={{ backgroundColor: theme.accent }} />
      </div>
    </button>
  );
}

/** Card de theme con light/dark lado a lado. */
function ThemePairCard({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemePalette;
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Nombre del theme */}
      <div className="flex items-center gap-2 px-1">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.primary }} />
        <span className="text-xs font-semibold">{theme.label}</span>
        <span className="text-[10px] text-muted-foreground">{theme.description}</span>
      </div>
      {/* Light / Dark lado a lado */}
      <div className="grid grid-cols-2 gap-2">
        <ThemeModePreview theme={theme} selected={selected} mode="light" onSelect={onSelect} />
        <ThemeModePreview theme={theme} selected={selected} mode="dark" onSelect={onSelect} />
      </div>
    </div>
  );
}

/** Galería: 4 themes, cada uno con light + dark lado a lado. */
export function ThemeGallery({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  // Obtener temas únicos por label
  const baseThemes = useMemo(() => {
    const seen = new Set<string>();
    return PRESET_THEMES.filter((t) => {
      if (seen.has(t.label)) return false;
      seen.add(t.label);
      return true;
    });
  }, []);

  return (
    <div className={cn("grid gap-5 sm:grid-cols-2", className)}>
      {baseThemes.map((theme) => (
        <ThemePairCard
          key={theme.id}
          theme={theme}
          selected={value}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}

/** Descriptor del theme activo. */
export function ThemeDescription({ themeId }: { themeId: string }) {
  // themeId puede ser "forest-light" o "forest-dark"
  const baseId = themeId.replace(/-(light|dark)$/, "");
  const theme = getThemeById(baseId);
  if (!theme) return null;
  const mode = themeId.endsWith("-dark") ? "dark" : "light";
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{theme.label}</span>{" "}
      <span className="text-xs">({mode === "dark" ? "oscuro" : "claro"})</span>
      {" — "}
      {theme.description}
    </p>
  );
}
