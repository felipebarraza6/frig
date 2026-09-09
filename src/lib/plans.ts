// Filtro del catálogo compartido de planes: frig consume el mismo backend que
// otras apps, pero aquí solo se gestionan los planes propios (prefijo "frig-"
// en el nombre y grupo "frig" en el catálogo de venta).

/** Grupo de planes de frig en /api/plan-checkout/groups/. */
export const FRIG_GROUP_SLUG = "frig";

/** Prefijo que identifica los planes de frig en /api/shared/module-plans/. */
export const FRIG_PLAN_NAME_PREFIX = "frig-";

/** True si el nombre del plan de módulos pertenece a frig. */
export function isFrigPlanName(name: string | null | undefined): boolean {
  return !!name && name.toLowerCase().startsWith(FRIG_PLAN_NAME_PREFIX);
}
