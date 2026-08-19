import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

type BranchModuleConfiguration = YggdraSchemas["BranchModuleConfiguration"];

export type ModuleName = YggdraSchemas["BranchModuleConfiguration"]["module_name"];

/** Configuración de submódulos opcionales (el backend la devuelve como objeto JSON). */
export type SubmoduleConfig = Record<string, boolean>;

export interface BranchModuleToggleResponse {
  config: BranchModuleConfiguration;
}

export interface SubmoduleUpdateResponse {
  config: BranchModuleConfiguration;
  result?: {
    branch_id: number;
    module_name: string;
    activated_submodules: string[];
    deactivated_submodules: string[];
    status: string;
  };
  message?: string;
}

export async function fetchBranchModules(branchId: number): Promise<BranchModuleConfiguration[]> {
  const qs = new URLSearchParams();
  qs.set("branch_id", String(branchId));
  const data = await apiFetch<BranchModuleConfiguration | BranchModuleConfiguration[]>(
    `/branches/module-configs/by_branch/?${qs.toString()}`,
  );
  return Array.isArray(data) ? data : [data];
}

export interface ToggleBranchModuleByNamePayload {
  branchId: number;
  moduleName: ModuleName;
  isEnabled: boolean;
}

export async function toggleBranchModuleByName({
  branchId,
  moduleName,
  isEnabled,
}: ToggleBranchModuleByNamePayload): Promise<BranchModuleConfiguration> {
  const qs = new URLSearchParams();
  qs.set("branch_id", String(branchId));
  const data = await apiFetch<BranchModuleToggleResponse>(
    `/branches/module-configs/by_branch/toggle/?${qs.toString()}`,
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
  const data = await apiFetch<SubmoduleUpdateResponse>(
    `/branches/module-configs/${moduleConfigId}/submodules/update/`,
    {
      method: "POST",
      body: { submodule_config: submoduleConfig },
    },
  );
  return data.config;
}

export async function fetchSubmoduleStatus(
  moduleConfigId: number,
): Promise<BranchModuleConfiguration> {
  return apiFetch<BranchModuleConfiguration>(`/branches/module-configs/${moduleConfigId}/submodules/status/`);
}

export async function syncBranchModules(branchId: number): Promise<{ message: string; synced: { created: number; disabled: number; total: number } }> {
  const qs = new URLSearchParams();
  qs.set("branch_id", String(branchId));
  return apiFetch<{ message: string; synced: { created: number; disabled: number; total: number } }>(
    `/branches/module-configs/by_branch/sync/?${qs.toString()}`,
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
