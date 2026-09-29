// Catálogo de planes de frig: el grupo de venta es "frig". Los planes de
// módulos del backend compartido se filtran con cuidado para no esconder el
// plan gastronómico real (nombre sin prefijo "frig-").

import { FRIG_PLAN_NAME } from "@/lib/modules";
import type { GroupPlanPublic } from "@/lib/api/checkout";
import type { ModulePlan } from "@/lib/api/module-plans";

/** Grupo de planes de frig en /api/plan-checkout/groups/. */
export const FRIG_GROUP_SLUG = "frig";

/** Prefijo que identifica algunos planes de frig en /api/shared/module-plans/. */
export const FRIG_PLAN_NAME_PREFIX = "frig-";

/** True si el nombre del plan de módulos pertenece a frig. */
export function isFrigPlanName(name: string | null | undefined): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  // En el seed local los nombres son "Frig Local", "Frig Mensual", …
  // (espacio), no necesariamente el prefijo "frig-".
  return (
    lower.startsWith(FRIG_PLAN_NAME_PREFIX) ||
    lower.startsWith("frig ") ||
    lower === "frig" ||
    lower.includes(FRIG_PLAN_NAME.toLowerCase())
  );
}

/**
 * Planes de módulos ofrecibles en apply-plan / formularios de sucursal.
 * Preferimos los de frig; si no hay, mostramos todos. El plan actual de la
 * sucursal siempre entra aunque no coincida con el filtro.
 */
export function selectModulePlansForFrig(
  plans: ModulePlan[],
  currentPlanId?: number | null,
): ModulePlan[] {
  const preferred = plans.filter(
    (p) => isFrigPlanName(p.name) || (currentPlanId != null && p.id === currentPlanId),
  );
  if (preferred.length > 0) return preferred;
  if (currentPlanId != null) {
    const current = plans.find((p) => p.id === currentPlanId);
    if (current) return [current];
  }
  return plans;
}

/** Normaliza nombres de plan para cruzar catálogo comercial ↔ plan de módulos. */
function normalizePlanLabel(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^frig[\s\-]+/i, "")
    .replace(/^plan[\s\-]+/i, "")
    .trim();
}

/** Cruza el plan de la sucursal con el catálogo comercial público. */
export function matchCommercialPlan(
  plans: GroupPlanPublic[],
  planName: string | null | undefined,
  planId?: string | null,
): GroupPlanPublic | null {
  if (planId?.trim()) {
    const id = planId.trim().toLowerCase();
    const byId = plans.find((p) => p.plan_id.trim().toLowerCase() === id);
    if (byId) return byId;
  }
  if (!planName?.trim()) return null;
  const n = planName.trim().toLowerCase();
  const normalized = normalizePlanLabel(planName);
  return (
    plans.find((p) => p.display_name.trim().toLowerCase() === n) ??
    plans.find((p) => p.plan_id.trim().toLowerCase() === n) ??
    plans.find((p) => normalizePlanLabel(p.display_name) === normalized) ??
    plans.find((p) => normalizePlanLabel(p.plan_id) === normalized) ??
    null
  );
}

export function formatPlanPriceUf(priceUf: number | string | null | undefined): string {
  if (priceUf == null || priceUf === "") return "A convenir";
  const n = typeof priceUf === "number" ? priceUf : Number(priceUf);
  if (Number.isNaN(n)) return "A convenir";
  if (n === 0) return "0 UF/mes";
  return `${n} UF/mes`;
}
