import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type OpportunityStage = YggdraSchemas["OpportunityStage"];
export type OpportunityStageRequest = YggdraSchemas["OpportunityStageRequest"];
export type Opportunity = YggdraSchemas["Opportunity"];
export type OpportunityList = YggdraSchemas["OpportunityList"];
export type OpportunityRequest = YggdraSchemas["OpportunityRequest"];
export type OpportunityProduct = YggdraSchemas["OpportunityProduct"];
export type OpportunityActivity = YggdraSchemas["OpportunityActivity"];
export type OpportunityActivityType = NonNullable<
  YggdraSchemas["OpportunityActivityRequest"]["activity_type"]
>;

type Paginated<T> = { count?: number; next?: string | null; results?: T[] };

function asList<T>(data: T[] | Paginated<T> | null | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

const DEFAULT_STAGES: Array<{
  name: string;
  order: number;
  probability: number;
  color: string;
  is_closed?: boolean;
  is_won?: boolean;
}> = [
  { name: "Nuevo", order: 0, probability: 10, color: "#64748b" },
  { name: "En conversación", order: 1, probability: 40, color: "#1890ff" },
  { name: "Propuesta", order: 2, probability: 70, color: "#8b5cf6" },
  { name: "Ganado", order: 3, probability: 100, color: "#16a34a", is_closed: true, is_won: true },
  { name: "Perdido", order: 4, probability: 0, color: "#ef4444", is_closed: true, is_won: false },
];

export const FOLLOW_UP_ACTIVITY_OPTIONS: Array<{
  value: OpportunityActivityType;
  label: string;
}> = [
  { value: "CALL", label: "Llamada" },
  { value: "MEETING", label: "Reunión" },
  { value: "EMAIL", label: "Email" },
  { value: "QUOTE", label: "Cotización" },
  { value: "TASK", label: "Tarea" },
  { value: "NOTE", label: "Nota" },
];

const ACTIVITY_LABELS: Record<string, string> = {
  CALL: "Llamada",
  MEETING: "Reunión",
  EMAIL: "Email",
  QUOTE: "Cotización",
  TASK: "Tarea",
  NOTE: "Nota",
  STAGE_CHANGE: "Cambio de etapa",
  OTHER: "Otro",
};

export function activityTypeLabel(value?: string | null): string {
  if (!value) return "Seguimiento";
  return ACTIVITY_LABELS[value] ?? value;
}

export interface FollowUpCategory {
  id: string;
  name: string;
  color?: string;
  order?: number;
  is_active?: boolean;
}

export type FollowUpActivity = OpportunityActivity & {
  category?: string | null;
  category_name?: string | null;
  category_color?: string | null;
};

const DEFAULT_FOLLOW_UP_CATEGORIES: Array<{ name: string; color: string; order: number }> = [
  { name: "Cobranza", color: "#f59e0b", order: 0 },
  { name: "Cotización", color: "#8b5cf6", order: 1 },
  { name: "Visita", color: "#1890ff", order: 2 },
  { name: "Postventa", color: "#16a34a", order: 3 },
  { name: "Reactivación", color: "#ef4444", order: 4 },
];

export async function fetchFollowUpCategories(): Promise<FollowUpCategory[]> {
  const data = await apiFetch<FollowUpCategory[] | Paginated<FollowUpCategory>>(
    "/crm/follow-up-categories/?page_size=50",
  );
  return asList(data)
    .filter((item) => item.is_active !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "es"));
}

export async function createFollowUpCategory(payload: {
  name: string;
  color?: string;
  order?: number;
}): Promise<FollowUpCategory> {
  return apiFetch<FollowUpCategory>("/crm/follow-up-categories/", {
    method: "POST",
    body: payload,
  });
}

export async function deleteFollowUpCategory(id: string): Promise<void> {
  await apiFetch(`/crm/follow-up-categories/${id}/`, { method: "DELETE" });
}

/** Crea las categorías base si la sucursal todavía no tiene ninguna. */
export async function ensureFollowUpCategories(): Promise<FollowUpCategory[]> {
  const existing = await fetchFollowUpCategories();
  if (existing.length > 0) return existing;
  const created: FollowUpCategory[] = [];
  for (const spec of DEFAULT_FOLLOW_UP_CATEGORIES) {
    try {
      created.push(await createFollowUpCategory(spec));
    } catch {
      // Carrera o sin permiso: se sigue con las que alcancen.
    }
  }
  return created.length > 0 ? created : fetchFollowUpCategories();
}

export async function fetchOpportunityStages(): Promise<OpportunityStage[]> {
  const data = await apiFetch<OpportunityStage[] | Paginated<OpportunityStage>>(
    "/crm/opportunity-stages/?page_size=50",
  );
  return asList(data).filter((s) => s.is_active !== false);
}

export async function createOpportunityStage(payload: {
  name: string;
  order?: number;
  probability?: number;
  color?: string;
  description?: string;
  is_closed?: boolean;
  is_won?: boolean;
}): Promise<OpportunityStage> {
  return apiFetch<OpportunityStage>("/crm/opportunity-stages/", {
    method: "POST",
    body: payload,
  });
}

/** Crea el set mínimo de etapas si la sucursal no las tiene (por nombre). */
export async function ensureDefaultOpportunityStages(): Promise<OpportunityStage[]> {
  const existing = await fetchOpportunityStages();
  const byName = new Map(existing.map((s) => [s.name.trim().toLowerCase(), s]));

  for (const spec of DEFAULT_STAGES) {
    const key = spec.name.toLowerCase();
    if (byName.has(key)) continue;
    try {
      const created = await createOpportunityStage(spec);
      byName.set(key, created);
    } catch {
      // Sin permiso o etapa ya creada en carrera: se usa lo existente.
    }
  }

  return Array.from(byName.values()).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, "es"),
  );
}

function pickOpenFollowUpStage(stages: OpportunityStage[]): OpportunityStage | null {
  const open = stages.filter((s) => !s.is_closed);
  if (open.length === 0) return stages[0] ?? null;
  const preferred =
    open.find((s) => s.name.trim().toLowerCase() === "en conversación") ??
    open.find((s) => s.name.trim().toLowerCase() === "nuevo") ??
    open[0];
  return preferred ?? null;
}

type OpportunityRow = OpportunityList & {
  lead?: string | null;
  lead_name?: string;
};

export async function fetchOpportunitiesForClient(
  clientId: number,
): Promise<OpportunityList[]> {
  const data = await apiFetch<OpportunityList[] | Paginated<OpportunityList>>(
    `/crm/opportunities/?client=${encodeURIComponent(String(clientId))}&is_active=true&page_size=20`,
  );
  return asList(data);
}

export async function fetchOpportunitiesForLead(
  leadId: string,
): Promise<OpportunityList[]> {
  const data = await apiFetch<OpportunityList[] | Paginated<OpportunityList>>(
    `/crm/opportunities/?lead=${encodeURIComponent(leadId)}&is_active=true&page_size=20`,
  );
  return asList(data);
}

export async function fetchOpportunities(filter: {
  page_size?: number;
  is_active?: boolean;
} = {}): Promise<OpportunityList[]> {
  const qs = new URLSearchParams();
  qs.set("page_size", String(filter.page_size ?? 100));
  if (filter.is_active !== undefined) {
    qs.set("is_active", filter.is_active ? "true" : "false");
  }
  const data = await apiFetch<OpportunityList[] | Paginated<OpportunityList>>(
    `/crm/opportunities/?${qs.toString()}`,
  );
  return asList(data);
}

export type OpportunityClientRef = {
  clientId: number | null;
  clientName: string;
  href: string | null;
};

/** Mapa opportunityId → cliente o prospecto para el hub de seguimientos. */
export async function fetchOpportunityClientMap(): Promise<
  Record<string, OpportunityClientRef>
> {
  const opps = (await fetchOpportunities({ page_size: 250 })) as OpportunityRow[];
  const map: Record<string, OpportunityClientRef> = {};
  for (const o of opps) {
    if (o.client) {
      map[o.id] = {
        clientId: o.client,
        clientName: o.client_name || "Cliente",
        href: `/customers?id=${o.client}`,
      };
    } else if (o.lead) {
      const name = o.lead_name || "Prospecto";
      map[o.id] = {
        clientId: null,
        clientName: name,
        href: `/customers/prospects?q=${encodeURIComponent(name)}`,
      };
    } else {
      map[o.id] = {
        clientId: null,
        clientName: o.client_name || "Sin cliente",
        href: null,
      };
    }
  }
  return map;
}

export async function createOpportunity(payload: {
  title: string;
  stage_id: string;
  client?: number | null;
  lead?: string | null;
  description?: string;
  estimated_value?: number;
}): Promise<Opportunity> {
  return apiFetch<Opportunity>("/crm/opportunities/", {
    method: "POST",
    body: payload,
  });
}

/**
 * Reutiliza la oportunidad activa del cliente o crea "Seguimiento · {name}".
 * Bootstrap de etapas incluido.
 */
export async function ensureLeadFollowUpOpportunity(input: {
  leadId: string;
  leadName: string;
}): Promise<{ opportunity: OpportunityList | Opportunity; stages: OpportunityStage[] }> {
  const stages = await ensureDefaultOpportunityStages();
  const existing = await fetchOpportunitiesForLead(input.leadId);
  if (existing.length > 0) {
    const sorted = [...existing].sort((a, b) =>
      String(a.created).localeCompare(String(b.created)),
    );
    return { opportunity: sorted[0], stages };
  }

  const stage = pickOpenFollowUpStage(stages);
  if (!stage) {
    throw new Error("No hay etapas de seguimiento disponibles en esta sucursal.");
  }

  const created = await createOpportunity({
    title: `Seguimiento · ${input.leadName || "Prospecto"}`,
    stage_id: stage.id,
    lead: input.leadId,
    estimated_value: 0,
    description: "Seguimiento comercial del prospecto",
  });

  return {
    opportunity: {
      id: created.id,
      title: created.title,
      stage: typeof created.stage === "object" && created.stage ? created.stage.id : String(created.stage ?? stage.id),
      stage_name:
        typeof created.stage === "object" && created.stage
          ? created.stage.name
          : stage.name,
      estimated_value: created.estimated_value,
      actual_value: created.actual_value,
      weighted_value: created.weighted_value,
      client: null,
      client_name: "",
      assigned_to: null,
      assigned_to_name: "",
      expected_close_date: created.expected_close_date,
      is_active: created.is_active,
      created: created.created,
      modified: created.modified,
    },
    stages,
  };
}

export async function ensureClientFollowUpOpportunity(input: {
  clientId: number;
  clientName: string;
}): Promise<{ opportunity: OpportunityList | Opportunity; stages: OpportunityStage[] }> {
  const stages = await ensureDefaultOpportunityStages();
  const existing = await fetchOpportunitiesForClient(input.clientId);
  if (existing.length > 0) {
    // Preferir la más antigua para no fragmentar el historial en varias oportunidades.
    const sorted = [...existing].sort((a, b) =>
      String(a.created).localeCompare(String(b.created)),
    );
    return { opportunity: sorted[0], stages };
  }

  const stage = pickOpenFollowUpStage(stages);
  if (!stage) {
    throw new Error("No hay etapas de seguimiento disponibles en esta sucursal.");
  }

  const created = await createOpportunity({
    title: `Seguimiento · ${input.clientName || "Cliente"}`,
    stage_id: stage.id,
    client: input.clientId,
    estimated_value: 0,
    description: "Seguimiento comercial del cliente",
  });

  return {
    opportunity: {
      id: created.id,
      title: created.title,
      stage: typeof created.stage === "object" && created.stage ? created.stage.id : String(created.stage ?? stage.id),
      stage_name:
        typeof created.stage === "object" && created.stage
          ? created.stage.name
          : stage.name,
      estimated_value: created.estimated_value,
      actual_value: created.actual_value,
      weighted_value: created.weighted_value,
      client: created.client ?? input.clientId,
      client_name: input.clientName,
      assigned_to: null,
      assigned_to_name: "",
      expected_close_date: created.expected_close_date,
      is_active: created.is_active,
      created: created.created,
      modified: created.modified,
    },
    stages,
  };
}

export async function fetchOpportunityActivities(
  opportunityId: string,
): Promise<OpportunityActivity[]> {
  const data = await apiFetch<OpportunityActivity[] | Paginated<OpportunityActivity>>(
    `/crm/opportunity-activities/?opportunity=${encodeURIComponent(opportunityId)}&page_size=50`,
  );
  return asList(data);
}

/** Listado global de actividades (hub Seguimientos). */
export async function fetchFollowUpActivities(filter: {
  is_completed?: boolean;
  page_size?: number;
  activity_type?: string;
  category?: string;
} = {}): Promise<FollowUpActivity[]> {
  const qs = new URLSearchParams();
  if (filter.is_completed !== undefined) {
    qs.set("is_completed", filter.is_completed ? "true" : "false");
  }
  if (filter.activity_type) qs.set("activity_type", filter.activity_type);
  if (filter.category) qs.set("category", filter.category);
  qs.set("page_size", String(filter.page_size ?? 50));
  const data = await apiFetch<FollowUpActivity[] | Paginated<FollowUpActivity>>(
    `/crm/opportunity-activities/?${qs.toString()}`,
  );
  return asList(data);
}

/** Actividades de todas las oportunidades activas del cliente, más recientes primero. */
export async function fetchClientFollowUpActivities(
  clientId: number,
): Promise<FollowUpActivity[]> {
  const opps = await fetchOpportunitiesForClient(clientId);
  if (opps.length === 0) return [];
  const lists = await Promise.all(opps.map((o) => fetchOpportunityActivities(o.id)));
  return lists
    .flat()
    .sort((a, b) => String(b.created).localeCompare(String(a.created)));
}

export async function createOpportunityActivity(payload: {
  opportunity: string;
  description: string;
  activity_type?: OpportunityActivityType;
  category?: string | null;
  scheduled_at?: string | null;
  assigned_to?: number | null;
}): Promise<FollowUpActivity> {
  return apiFetch<FollowUpActivity>("/crm/opportunity-activities/", {
    method: "POST",
    body: {
      activity_type: "NOTE",
      ...payload,
    },
  });
}

export async function completeOpportunityActivity(
  activityId: string,
): Promise<OpportunityActivity> {
  return apiFetch<OpportunityActivity>(
    `/crm/opportunity-activities/${activityId}/complete/`,
    { method: "POST", body: {} },
  );
}

export async function fetchOpportunity(id: string): Promise<Opportunity> {
  return apiFetch<Opportunity>(`/crm/opportunities/${id}/`);
}

export async function updateOpportunity(
  id: string,
  payload: Partial<{
    title: string;
    stage_id: string;
    client: number | null;
    lead: string | null;
    description: string;
    estimated_value: number;
    actual_value: number;
    expected_close_date: string | null;
    is_active: boolean;
  }>,
): Promise<Opportunity> {
  return apiFetch<Opportunity>(`/crm/opportunities/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteOpportunity(id: string): Promise<void> {
  await apiFetch(`/crm/opportunities/${id}/`, { method: "DELETE" });
}

export async function moveOpportunity(
  id: string,
  stageId: string,
): Promise<Opportunity> {
  try {
    return await apiFetch<Opportunity>(`/crm/opportunities/${id}/move/`, {
      method: "POST",
      body: { stage_id: stageId },
    });
  } catch {
    // Si el endpoint de acción move falla por firma de serializador, fallback a PATCH
    return await updateOpportunity(id, { stage_id: stageId });
  }
}

export async function updateOpportunityStage(
  id: string,
  payload: Partial<OpportunityStageRequest>,
): Promise<OpportunityStage> {
  return apiFetch<OpportunityStage>(`/crm/opportunity-stages/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function deleteOpportunityStage(id: string): Promise<void> {
  await apiFetch(`/crm/opportunity-stages/${id}/`, { method: "DELETE" });
}

export async function fetchOpportunityProducts(
  opportunityId: string,
): Promise<OpportunityProduct[]> {
  const data = await apiFetch<
    OpportunityProduct[] | Paginated<OpportunityProduct>
  >(`/crm/opportunity-products/?opportunity=${encodeURIComponent(opportunityId)}&page_size=50`);
  return asList(data);
}

export async function createOpportunityProduct(payload: {
  opportunity: string;
  product?: number | null;
  service?: string | null;
  quantity?: number;
  unit_price?: number;
  notes?: string;
}): Promise<OpportunityProduct> {
  return apiFetch<OpportunityProduct>("/crm/opportunity-products/", {
    method: "POST",
    body: payload,
  });
}

export async function deleteOpportunityProduct(id: string): Promise<void> {
  await apiFetch(`/crm/opportunity-products/${id}/`, { method: "DELETE" });
}
