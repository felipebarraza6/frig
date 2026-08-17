import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

type BranchModuleConfiguration = YggdraSchemas["BranchModuleConfiguration"];

export type ModuleName = YggdraSchemas["BranchModuleConfiguration"]["module_name"];

export async function fetchBranchModules(branchId: number): Promise<BranchModuleConfiguration[]> {
  const qs = new URLSearchParams();
  qs.set("branch_id", String(branchId));
  const data = await apiFetch<BranchModuleConfiguration | BranchModuleConfiguration[]>(
    `/branches/modules/by_branch/?${qs.toString()}`,
  );
  return Array.isArray(data) ? data : [data];
}

export interface ToggleBranchModulePayload {
  /** ID de la configuración de módulo (BranchModuleConfiguration). */
  id: number;
  isEnabled: boolean;
}

export async function toggleBranchModule({
  id,
  isEnabled,
}: ToggleBranchModulePayload): Promise<BranchModuleConfiguration> {
  return apiFetch<BranchModuleConfiguration>(`/branches/modules/${id}/`, {
    method: "PATCH",
    body: { is_enabled: isEnabled },
  });
}

export async function syncBranchModules(branchId: number): Promise<{ message: string; synced: { created: number; disabled: number; total: number } }> {
  const qs = new URLSearchParams();
  qs.set("branch_id", String(branchId));
  return apiFetch<{ message: string; synced: { created: number; disabled: number; total: number } }>(
    `/branches/modules/by_branch/sync/?${qs.toString()}`,
    { method: "POST" },
  );
}
