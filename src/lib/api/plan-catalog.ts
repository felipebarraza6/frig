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

/** Campos editables del grupo (name es de solo lectura en el backend). */
export type PlanGroupUpdatePayload = Partial<
  Pick<
    PlanGroupDetail,
    | "display_name"
    | "description"
    | "contact_email"
    | "pricing_note"
    | "hero_headline"
    | "hero_subhead"
    | "hero_cta_label"
    | "landing_features"
    | "frontend_url"
    | "integration_uf"
    | "is_active"
  >
>;

/** GET /api/plan-checkout/groups/ — grupos gestionables por el usuario. */
export async function fetchManageableGroups(): Promise<ManageableGroup[]> {
  const data = await apiFetch<
    ManageableGroup[] | ManageableGroup | { results?: ManageableGroup[] }
  >("/plan-checkout/groups/");
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && "results" in data) {
    return data.results ?? [];
  }
  if (data && typeof data === "object" && "name" in data) {
    return [data as ManageableGroup];
  }
  return [];
}

/** GET /api/plan-checkout/groups/<slug>/ — detalle + planes del grupo. */
export function fetchGroupDetail(slug: string): Promise<PlanGroupDetail> {
  return apiFetch<PlanGroupDetail>(`/plan-checkout/groups/${slug}/`);
}

/** PATCH /api/plan-checkout/groups/<slug>/ — actualiza copy y UF del grupo. */
export function updateGroup(slug: string, payload: PlanGroupUpdatePayload): Promise<PlanGroupDetail> {
  return apiFetch<PlanGroupDetail>(`/plan-checkout/groups/${slug}/`, {
    method: "PATCH",
    body: payload,
  });
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
