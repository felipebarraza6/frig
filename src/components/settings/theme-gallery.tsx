"use client";

import { cn } from "@/lib/utils";
import { PRESET_THEMES, getThemeById, type ThemePalette } from "@/lib/themes";
import { Check } from "lucide-react";

/** Muestra una mini-card con preview del theme (fondo + bordes + acento). */
function ThemePreviewCard({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemePalette;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      className={cn(
        "group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-xl border-2 transition-all",
        selected
          ? "border-primary ring-2 ring-primary/30 ring-offset-2"
          : "border-border hover:border-primary/50",
      )}
      style={{ backgroundColor: theme.surface }}
    >
      {/* Barra superior con colores del theme */}
      <div className="flex h-10 w-full">
        <div className="h-full flex-1" style={{ backgroundColor: theme.primary }} />
        <div className="h-full flex-1" style={{ backgroundColor: theme.secondary }} />
        <div className="h-full flex-1" style={{ backgroundColor: theme.accent }} />
      </div>

      {/* Contenido mock */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Título mock */}
        <div
          className="h-3 w-2/3 rounded-full"
          style={{ backgroundColor: theme.text, opacity: 0.8 }}
        />
        {/* Línea de texto mock */}
        <div
          className="h-2 w-full rounded-full"
          style={{ backgroundColor: theme.muted, opacity: 0.4 }}
        />
        <div
          className="h-2 w-4/5 rounded-full"
          style={{ backgroundColor: theme.muted, opacity: 0.4 }}
        />
        {/* Botón mock */}
        <div className="mt-1 flex items-center gap-2">
          <div
            className="h-6 w-16 rounded-md"
            style={{ backgroundColor: theme.primary }}
          />
          <div
            className="h-6 w-16 rounded-md"
            style={{ backgroundColor: theme.secondary }}
          />
        </div>
      </div>

      {/* Nombre del theme */}
      <div
        className="border-t px-3 py-2 text-[11px] font-medium"
        style={{
          borderColor: theme.muted,
          color: theme.text,
          opacity: 0.85,
        }}
      >
        {theme.label}
      </div>

      {/* Check de seleccionado */}
      {selected && (
        <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Check className="h-3.5 w-3.5" />
        </div>
      )}
    </button>
  );
}

/** Galería completa de themes clickeables. */
export function ThemeGallery({
  value,
  onChange,
  className,
}: {
  /** ID del theme seleccionado actualmente. */
  value: string;
  /** Callback cuando el usuario elige otro theme. */
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
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

/** Texto descriptor del theme activo (para mostrar debajo del gallery). */
export function ThemeDescription({ themeId }: { themeId: string }) {
  const theme = getThemeById(themeId);
  if (!theme) return null;
  return (
    <p className="mt-2 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{theme.label}</span>
      {" — "}
      {theme.description}
    </p>
  );
}
