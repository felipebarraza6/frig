import { apiFetch } from "./client";

// Gestión del catálogo de planes de venta (PlanGroup / GroupPlan).
// Contrato: /api/plan-checkout/groups/... (ver manage_router del backend).

/** Item editable de un plan del catálogo (GroupPlan). */
export interface GroupPlanEditable {
  id: number;
  plan_id: string;
  display_name: string;
  description: string;
  features: string[];
  limits: Record<string, unknown>;
  /** Precio en UF; string decimal o null (contacto manual). */
  price_uf: string | number | null;
  branch_module_plan: number | null;
  sort_order: number;
  highlighted: boolean;
  badge: string | null;
  is_active: boolean;
}

/** Grupo de planes visible en el selector (resumen). */
export interface ManageableGroup {
  name: string;
  display_name: string;
  is_active: boolean;
}

/** Detalle completo del grupo + sus planes (activos e inactivos). */
export interface PlanGroupDetail extends ManageableGroup {
  description: string;
  contact_email: string;
  pricing_note: string;
  hero_headline: string;
  hero_subhead: string;
  hero_cta_label: string;
  landing_features: { icon: string; title: string; description: string }[];
  frontend_url: string;
  integration_uf: string | number;
  plans: GroupPlanEditable[];
}

export type GroupPlanPayload = Partial<Omit<GroupPlanEditable, "id">>;

/** GET /api/plan-checkout/groups/ — grupos gestionables por el usuario. */
export function fetchManageableGroups(): Promise<ManageableGroup[]> {
  return apiFetch<ManageableGroup[]>("/plan-checkout/groups/");
}

/** GET /api/plan-checkout/groups/<slug>/ — detalle + planes del grupo. */
export function fetchGroupDetail(slug: string): Promise<PlanGroupDetail> {
  return apiFetch<PlanGroupDetail>(`/plan-checkout/groups/${slug}/`);
}

/** POST /api/plan-checkout/groups/<slug>/plans/ — crea un plan del grupo. */
export function createGroupPlan(slug: string, payload: GroupPlanPayload): Promise<GroupPlanEditable> {
  return apiFetch<GroupPlanEditable>(`/plan-checkout/groups/${slug}/plans/`, {
    method: "POST",
    body: payload,
  });
}

/** PATCH /api/plan-checkout/groups/<slug>/plans/<id>/ — actualiza un plan. */
export function updateGroupPlan(
  slug: string,
  planPk: number,
  payload: GroupPlanPayload,
): Promise<GroupPlanEditable> {
  return apiFetch<GroupPlanEditable>(`/plan-checkout/groups/${slug}/plans/${planPk}/`, {
    method: "PATCH",
    body: payload,
  });
}

/**
 * DELETE /api/plan-checkout/groups/<slug>/plans/<id>/ — elimina físicamente
 * un plan. Responde 409 si el plan tiene contrataciones asociadas (FK
 * PROTECT); en ese caso la baja correcta es is_active=false.
 */
export function deleteGroupPlan(slug: string, planPk: number): Promise<void> {
  return apiFetch<void>(`/plan-checkout/groups/${slug}/plans/${planPk}/`, {
    method: "DELETE",
  });
}
