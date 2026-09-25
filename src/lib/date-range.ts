/**
 * Helpers de rango de fechas compartidos por el dashboard y los informes.
 * Consolidan las copias idénticas que había en reports/page, dashboard,
 * reports/sales, reports/money, finance-report y finance.
 *
 * Todas las fechas viajan como "YYYY-MM-DD" (formato de <input type="date">)
 * en hora local — nunca usar toISOString(), que devuelve UTC y puede mover
 * el día según la zona horaria.
 */

export type DatePreset =
  | "today"
  | "yesterday"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "current_month"
  | "last_month"
  | "year_to_date"
  | "custom";

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  today: "Hoy",
  yesterday: "Ayer",
  last_7_days: "Últimos 7 días",
  last_30_days: "Últimos 30 días",
  last_90_days: "Últimos 90 días",
  current_month: "Este mes",
  last_month: "Mes pasado",
  year_to_date: "Este año",
  custom: "Rango personalizado",
};

/** Todos los presets ordenados (sin "custom", que no tiene rango propio). */
export const DATE_PRESETS: DatePreset[] = [
  "today",
  "yesterday",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "current_month",
  "last_month",
  "year_to_date",
];

/** Días hacia atrás de los presets rodantes (incluye el día de hoy). */
const ROLLING_DAYS: Record<
  "today" | "last_7_days" | "last_30_days" | "last_90_days",
  number
> = {
  today: 0,
  last_7_days: 6,
  last_30_days: 29,
  last_90_days: 89,
};

/** Fecha como "YYYY-MM-DD" en hora local (apta para <input type="date">). */
export function fmtDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Fecha de hace N días como "YYYY-MM-DD". */
export function daysAgoInput(days: number): string {
  return fmtDateInput(new Date(Date.now() - days * 86_400_000));
}

/** Primer y último día del mes en curso. */
export function getCurrentMonthRange(): { start: string; end: string } {
  const today = new Date();
  return {
    start: fmtDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    end: fmtDateInput(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
  };
}

/** Rango concreto (start/end "YYYY-MM-DD") + etiqueta legible de un preset.
 *  Con "custom" usa el rango entregado; sin él cae al mes en curso. */
export function rangeDates(
  preset: DatePreset,
  custom?: { start: string; end: string } | null,
): { start: string; end: string; label: string } {
  if (preset === "custom") {
    const fallback = custom ?? getCurrentMonthRange();
    return { ...fallback, label: DATE_PRESET_LABELS.custom };
  }
  const today = new Date();
  switch (preset) {
    case "yesterday": {
      const d = new Date(today);
      d.setDate(today.getDate() - 1);
      return {
        start: fmtDateInput(d),
        end: fmtDateInput(d),
        label: DATE_PRESET_LABELS.yesterday,
      };
    }
    case "current_month":
      return { ...getCurrentMonthRange(), label: DATE_PRESET_LABELS.current_month };
    case "last_month":
      return {
        start: fmtDateInput(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        end: fmtDateInput(new Date(today.getFullYear(), today.getMonth(), 0)),
        label: DATE_PRESET_LABELS.last_month,
      };
    case "year_to_date":
      return {
        start: fmtDateInput(new Date(today.getFullYear(), 0, 1)),
        end: fmtDateInput(today),
        label: DATE_PRESET_LABELS.year_to_date,
      };
    default: {
      const days = ROLLING_DAYS[preset as keyof typeof ROLLING_DAYS];
      return {
        start: daysAgoInput(days),
        end: fmtDateInput(today),
        label: DATE_PRESET_LABELS[preset],
      };
    }
  }
}

/** Preset cuyo rango coincide exactamente con start/end, o null si el rango
 *  no corresponde a ningún preset (personalizado). */
export function matchPreset(start: string, end: string): DatePreset | null {
  for (const p of DATE_PRESETS) {
    const r = rangeDates(p);
    if (r.start === start && r.end === end) return p;
  }
  return null;
}
