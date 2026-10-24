/**
 * Fábrica central de query keys (docs/plan-madurez-api.md, Fase 1).
 *
 * Regla: toda lista/detail vive bajo la raíz de su dominio, de modo que una
 * invalidación por prefijo refresque todas las vistas a la vez:
 *
 *   queryClient.invalidateQueries({ queryKey: CRM_KEYS.all })
 *
 * Nada de claves paralelas por vista ("hub-count" vs "nav-counter" vs
 * "reports/crm"): una misma petición comparte caché, y toda mutación de CRM
 * invalida la raíz.
 */

export const CRM_KEYS = {
  all: ["crm"] as const,
  leads: {
    root: () => [...CRM_KEYS.all, "leads"] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...CRM_KEYS.leads.root(), "list", filters] as const,
    counter: () => [...CRM_KEYS.leads.root(), "counter"] as const,
  },
  leadSources: {
    root: () => [...CRM_KEYS.all, "lead-sources"] as const,
  },
  opportunities: {
    root: () => [...CRM_KEYS.all, "opportunities"] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...CRM_KEYS.opportunities.root(), "list", filters] as const,
    counter: () => [...CRM_KEYS.opportunities.root(), "counter"] as const,
    clientMap: () => [...CRM_KEYS.opportunities.root(), "client-map"] as const,
  },
  stages: {
    root: () => [...CRM_KEYS.all, "opportunity-stages"] as const,
  },
  activities: {
    root: () => [...CRM_KEYS.all, "activities"] as const,
    list: (filters: Record<string, unknown> = {}) =>
      [...CRM_KEYS.activities.root(), "list", filters] as const,
    counter: () => [...CRM_KEYS.activities.root(), "counter"] as const,
  },
  followUpCategories: {
    root: () => [...CRM_KEYS.all, "follow-up-categories"] as const,
  },
} as const;

/**
 * Caja y estaciones. La sucursal no va en la key: cada sucursal tiene su
 * propio QueryClient. Una misma estación comparte caché entre terminal,
 * carrito, hub, salón y modal de cobro.
 */
export const CASH_KEYS = {
  all: ["cash-register"] as const,
  stations: ["cash-register-stations"] as const,
  openList: ["cash-registers", "open-list"] as const,
  current: (stationId?: string | number | null) =>
    ["cash-register", "current", stationId ?? null] as const,
  dailySummary: (stationId?: string | number | null, registerId?: string | number | null) =>
    ["cash-register", "daily-summary", stationId ?? null, registerId ?? null] as const,
} as const;

/** Tickets de cocina. El scope `pos`/`order` invalida el prefijo y refresca todas las vistas. */
export const KITCHEN_KEYS = {
  all: ["kitchen-tickets"] as const,
  list: (stationId?: string | number | null) =>
    ["kitchen-tickets", stationId ?? "all"] as const,
  ready: ["kitchen-tickets", "READY"] as const,
} as const;
