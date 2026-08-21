import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

type BranchModuleConfiguration = YggdraSchemas["BranchModuleConfiguration"];

export type ModuleName = YggdraSchemas["BranchModuleConfiguration"]["module_name"];

/** Configuración de submódulos opcionales (el backend la devuelve como objeto JSON). */
export type SubmoduleConfig = Record<string, boolean>;

type BranchModulesResponse =
  | BranchModuleConfiguration
  | BranchModuleConfiguration[]
  | { results?: BranchModuleConfiguration[] };

function isPaginatedModulesResponse(
  value: BranchModulesResponse,
): value is { results?: BranchModuleConfiguration[] } {
  return !!value && typeof value === "object" && "results" in value;
}

export async function fetchBranchModules(branchId: number): Promise<BranchModuleConfiguration[]> {
  const qs = new URLSearchParams();
  qs.set("branch_id", String(branchId));
  const data = await apiFetch<BranchModulesResponse>(
    `/branches/modules/by_branch/?${qs.toString()}`,
  );
  if (Array.isArray(data)) return data;
  if (isPaginatedModulesResponse(data)) return data.results ?? [];
  if (data) return [data];
  return [];
}

export interface ToggleBranchModuleByNamePayload {
  branchId: number;
  /** ID de la configuración del módulo (BranchModuleConfiguration.id). */
  configId: number;
  moduleName: ModuleName;
  isEnabled: boolean;
}

export async function toggleBranchModuleByName({
  branchId,
  configId,
  moduleName,
  isEnabled,
}: ToggleBranchModuleByNamePayload): Promise<BranchModuleConfiguration> {
  return apiFetch<BranchModuleConfiguration>(
    `/branches/modules/${configId}/${isEnabled ? "enable" : "disable"}/`,
    {
      method: "POST",
      body: { branch: branchId, module_name: moduleName, is_enabled: isEnabled },
    },
  );
}

export interface ToggleBranchModulePayload {
  branchId: number;
  moduleName: ModuleName;
  isEnabled: boolean;
}

interface ToggleBranchModuleResponse {
  config: BranchModuleConfiguration;
  activated_submodules?: string[];
  deactivated_submodules?: string[];
}

/**
 * Activa/desactiva un módulo por nombre y sucursal.
 * El backend crea la fila si no existe y propaga el estado a los submódulos
 * cuando el módulo es compuesto (por ejemplo Nutrición → Recetas/Ingredientes).
 */
export async function toggleBranchModule({
  branchId,
  moduleName,
  isEnabled,
}: ToggleBranchModulePayload): Promise<BranchModuleConfiguration> {
  const data = await apiFetch<ToggleBranchModuleResponse>(
    "/branches/modules/by_branch/toggle/",
    {
      method: "POST",
      body: { branch_id: branchId, module_name: moduleName, is_enabled: isEnabled },
    },
  );
  return data.config;
}

export interface UpdateSubmoduleConfigPayload {
  /** ID de la configuración del módulo compuesto (BranchModuleConfiguration.id). */
  moduleConfigId: number;
  submoduleConfig: SubmoduleConfig;
}

export async function updateSubmoduleConfig({
  moduleConfigId,
  submoduleConfig,
}: UpdateSubmoduleConfigPayload): Promise<BranchModuleConfiguration> {
  return apiFetch<BranchModuleConfiguration>(
    `/branches/modules/${moduleConfigId}/submodules/update/`,
    {
      method: "POST",
      body: { submodule_config: submoduleConfig },
    },
  );
}

export async function fetchSubmoduleStatus(
  moduleConfigId: number,
): Promise<BranchModuleConfiguration> {
  return apiFetch<BranchModuleConfiguration>(`/branches/modules/${moduleConfigId}/submodules/status/`);
}

export async function syncBranchModules(branchId: number): Promise<{ message: string; synced: { created: number; disabled: number; total: number } }> {
  const qs = new URLSearchParams();
  qs.set("branch_id", String(branchId));
  return apiFetch<{ message: string; synced: { created: number; disabled: number; total: number } }>(
    `/branches/modules/by_branch/sync/?${qs.toString()}`,
    { method: "POST" },
  );
}

/** Parsea de forma defensiva el campo submodule_config que el backend entrega como objeto JSON. */
export function parseSubmoduleConfig(value: unknown): SubmoduleConfig {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as SubmoduleConfig;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as SubmoduleConfig;
      }
    } catch {
      // fallthrough
    }
  }
  return {};
}
