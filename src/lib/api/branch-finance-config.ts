import { apiFetch } from "./client";
import type { YggdraSchemas } from "@/lib/api/types";

export type SiiActionKey = string;

export type BranchFinanceConfig = YggdraSchemas["BranchFinanceConfig"] & {
  sii_provider_installation?: string | null;
  sii_generation_trigger?: "ON_CREATION" | "ON_COMPLETION" | "ON_PAYMENT" | "MANUAL";
  sii_document_preference?: "AUTO" | "BOLETA" | "FACTURA";
  sii_action_endpoints?: Partial<Record<SiiActionKey, string>>;
};
type PaginatedBranchFinanceConfigList = YggdraSchemas["PaginatedBranchFinanceConfigList"];

export interface BranchFinanceConfigRequest {
  branch: number;
  currency_symbol?: string;
  decimal_places?: number;
  thousand_separator?: "." | "," | " " | "";
  decimal_separator?: "," | ".";
  default_tax_rate?: string;
  show_tax_breakdown?: boolean;
  auto_generate_receipts?: boolean;
  default_expense_category_purchase_orders?: string | null;
  default_revenue_category_orders?: string | null;
  default_revenue_category_sales?: string | null;
  default_payment_method?: string | null;
  default_bank_account?: string | null;
  sii_provider_installation?: string | null;
  sii_generation_trigger?: "ON_CREATION" | "ON_COMPLETION" | "ON_PAYMENT" | "MANUAL";
  sii_document_preference?: "AUTO" | "BOLETA" | "FACTURA";
  sii_action_endpoints?: Partial<Record<SiiActionKey, string>>;
}

function asConfigList(data: unknown): BranchFinanceConfig[] {
  if (Array.isArray(data)) return data as BranchFinanceConfig[];
  if (data && typeof data === "object") {
    const rec = data as { results?: BranchFinanceConfig[]; id?: number };
    if (Array.isArray(rec.results)) return rec.results;
    if (typeof rec.id === "number") return [data as BranchFinanceConfig];
  }
  return [];
}

export async function fetchBranchFinanceConfigs(): Promise<BranchFinanceConfig[]> {
  const data = await apiFetch<unknown>("/finance/branch-configs/");
  return asConfigList(data);
}

export async function fetchBranchFinanceConfig(id: number): Promise<BranchFinanceConfig> {
  return apiFetch<BranchFinanceConfig>(`/finance/branch-configs/${id}/`);
}

export async function fetchBranchFinanceConfigByBranch(branchId: number): Promise<BranchFinanceConfig> {
  return apiFetch<BranchFinanceConfig>(`/finance/branch-configs/by_branch/${branchId}/`);
}

export async function updateBranchFinanceConfig(id: number, payload: Partial<BranchFinanceConfigRequest>): Promise<BranchFinanceConfig> {
  return apiFetch<BranchFinanceConfig>(`/finance/branch-configs/${id}/`, {
    method: "PATCH",
    body: payload,
  });
}

export async function createBranchFinanceConfig(payload: BranchFinanceConfigRequest): Promise<BranchFinanceConfig> {
  return apiFetch<BranchFinanceConfig>("/finance/branch-configs/", {
    method: "POST",
    body: payload,
  });
}
