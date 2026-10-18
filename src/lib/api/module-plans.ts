import { apiFetch } from "./client";
import type { ApplyPlanResponse } from "@/lib/api/types/modules";
import type { YggdraSchemas } from "@/lib/api/types";

export type BranchModulePlan = YggdraSchemas["BranchModulePlan"];

/** Plan de módulos de una organización (BranchModulePlan). */
export interface ModulePlan {
  id: number;
  name: string;
  description: string | null;
  organization: number | null;
  modules: string[];
  product_types: string[];
  submodule_config: Record<string, Record<string, boolean>>;
  allow_additional_branches: boolean;
  max_branches: number;
  max_agents: number;
  max_channels: number;
  max_llm_providers: number;
  max_ai_functions: number;
  max_knowledge_documents: number;
  is_active: boolean;
  modules_count: number;
  product_types_count: number;
  available_product_types: { key: string; label: string }[];
}

export type ModulePlanPayload = Partial<
  Omit<ModulePlan, "id" | "modules_count" | "product_types_count" | "available_product_types">
>;

/**
 * GET /api/shared/module-plans/
 *
 * Lista los planes de módulos disponibles. Si se pasa organizationId, filtra
 * por organización.
 */
export async function fetchModulePlans(organizationId?: number | string): Promise<ModulePlan[]> {
  const params = organizationId ? `?organization=${organizationId}` : "";
  const data = await apiFetch<{ results?: ModulePlan[] } | ModulePlan[]>(
    `/shared/module-plans/${params}`,
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

/** POST /api/shared/module-plans/ */
export function createModulePlan(payload: ModulePlanPayload): Promise<ModulePlan> {
  return apiFetch<ModulePlan>("/shared/module-plans/", {
    method: "POST",
    body: payload,
  });
}

/** PATCH /api/shared/module-plans/<id>/ */
export function updateModulePlan(id: number, payload: ModulePlanPayload): Promise<ModulePlan> {
  return apiFetch<ModulePlan>(`/shared/module-plans/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

/** DELETE /api/shared/module-plans/<id>/ */
export function deleteModulePlan(id: number): Promise<void> {
  return apiFetch<void>(`/shared/module-plans/${id}/`, {
    method: "DELETE",
  });
}

/**
 * POST /api/branches/{branch_id}/apply-plan/
 *
 * Aplica o cambia el plan de una sucursal. Crea/actualiza la suscripción,
 * activa los módulos del plan y sincroniza los tipos de producto.
 */
export async function applyBranchPlan(
  branchId: number,
  planId: number,
  endDate?: string,
): Promise<ApplyPlanResponse> {
  return apiFetch<ApplyPlanResponse>(`/branches/${branchId}/apply-plan/`, {
    method: "POST",
    body: { plan_id: planId, end_date: endDate },
  });
}

/**
 * POST /api/branches/{branch_id}/cancel-subscription/
 *
 * Cancela la suscripción activa de una sucursal y desactiva los módulos
 * de extensión.
 */
export async function cancelBranchSubscription(branchId: number): Promise<unknown> {
  return apiFetch<unknown>(`/branches/${branchId}/cancel-subscription/`, {
    method: "POST",
  });
}
export interface BranchSubscriptionHistoryItem {
  id: number;
  branch?: number;
  branch_name?: string;
  /** Algunas respuestas usan `plan`, otras `plan_id`. */
  plan?: number;
  plan_id?: number;
  plan_name: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "PENDING";
  start_date?: string;
  end_date?: string | null;
  created?: string;
}

/**
 * Plan actual de GET /branches/{id}/subscriptions/ (`BranchCurrentPlan` en el
 * contrato). `modules` es la lista de keys incluidas en el plan.
 */
export interface BranchCurrentPlanInfo {
  id: number;
  name: string;
  modules: string[];
  product_types: string[];
  max_branches?: number;
  submodule_config?: Record<string, unknown>;
}

/** Respuesta real de GET /branches/{id}/subscriptions/ (no es un listado DRF). */
export interface BranchSubscriptionsResponse {
  branch_id?: number;
  branch_name?: string;
  current_plan: BranchCurrentPlanInfo | null;
  subscriptions: BranchSubscriptionHistoryItem[];
}

interface BranchSubscriptionsPayload {
  branch_id?: number;
  branch_name?: string;
  current_plan?: {
    id?: number;
    name?: string;
    modules?: unknown;
    product_types?: unknown;
    max_branches?: number;
    submodule_config?: Record<string, unknown>;
  } | null;
  subscriptions?: BranchSubscriptionHistoryItem[];
  results?: BranchSubscriptionHistoryItem[];
}

function normalizeCurrentPlan(
  raw: BranchSubscriptionsPayload["current_plan"],
): BranchCurrentPlanInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "number" ? raw.id : Number(raw.id);
  if (!Number.isFinite(id)) return null;
  const name = typeof raw.name === "string" ? raw.name : "";
  const modules = Array.isArray(raw.modules)
    ? raw.modules.filter((m): m is string => typeof m === "string" && !!m.trim())
    : [];
  const product_types = Array.isArray(raw.product_types)
    ? raw.product_types.filter((t): t is string => typeof t === "string" && !!t.trim())
    : [];
  return {
    id,
    name,
    modules,
    product_types,
    max_branches: raw.max_branches,
    submodule_config: raw.submodule_config,
  };
}

/**
 * GET /api/branches/{id}/subscriptions/
 *
 * Incluye `current_plan.modules` (entitlements del plan activo) además del
 * historial. Fuente canónica para filtrar módulos instalables en la UI.
 */
export async function fetchBranchSubscriptions(
  branchId: number | string,
): Promise<BranchSubscriptionsResponse> {
  const data = await apiFetch<BranchSubscriptionsPayload | BranchSubscriptionHistoryItem[]>(
    `/branches/${branchId}/subscriptions/`,
  );
  if (Array.isArray(data)) {
    return {
      current_plan: null,
      subscriptions: data.map((item) => ({
        ...item,
        plan: item.plan ?? item.plan_id,
      })),
    };
  }
  const list = data.subscriptions ?? data.results ?? [];
  return {
    branch_id: data.branch_id,
    branch_name: data.branch_name,
    current_plan: normalizeCurrentPlan(data.current_plan),
    subscriptions: list.map((item) => ({
      ...item,
      plan: item.plan ?? item.plan_id,
    })),
  };
}

export async function fetchBranchSubscriptionHistory(
  branchId: number | string,
): Promise<BranchSubscriptionHistoryItem[]> {
  const data = await fetchBranchSubscriptions(branchId);
  return data.subscriptions;
}

export async function fetchBranchCapabilities(branchId: number | string): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/branches/${branchId}/capabilities/`);
}



