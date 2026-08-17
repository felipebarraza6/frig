import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

type BranchModuleConfiguration = YggdraSchemas["BranchModuleConfiguration"];

export type ModuleName = YggdraSchemas["BranchModuleConfiguration"]["module_name"];

export async function fetchBranchModules(branchId: number): Promise<BranchModuleConfiguration[]> {
  const qs = new URLSearchParams();
  qs.set("branch_id", String(branchId));
  return apiFetch<BranchModuleConfiguration[]>(`/branches/modules/by_branch/?${qs.toString()}`);
}

export async function enableBranchModule(id: number): Promise<BranchModuleConfiguration> {
  return apiFetch<BranchModuleConfiguration>(`/branches/modules/${id}/`, {
    method: "PATCH",
    body: { is_enabled: true },
  });
}

export async function disableBranchModule(id: number): Promise<BranchModuleConfiguration> {
  return apiFetch<BranchModuleConfiguration>(`/branches/modules/${id}/`, {
    method: "PATCH",
    body: { is_enabled: false },
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
