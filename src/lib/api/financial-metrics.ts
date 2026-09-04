import { apiFetch } from "./client";

export interface FinancialMetricsSummary {
  total_revenue?: string | number;
  total_expenses?: string | number;
  net_profit?: string | number;
  profit_margin?: string | number;
  current_month_revenue?: string | number;
  current_month_expenses?: string | number;
  current_month_profit?: string | number;
  [key: string]: unknown;
}

export interface RevenueByDateRangeItem {
  date?: string;
  total?: string | number;
  count?: number;
  [key: string]: unknown;
}

export interface RevenueByDateRange {
  results?: RevenueByDateRangeItem[];
  [key: string]: unknown;
}

export interface ExpenseByFrequency {
  frequency?: string;
  total?: string | number;
  count?: number;
  [key: string]: unknown;
}

export interface ExpensesByFrequency {
  results?: ExpenseByFrequency[];
  [key: string]: unknown;
}

export async function fetchFinancialMetricsSummary(
  branchId?: number | string,
): Promise<FinancialMetricsSummary> {
  const qs = new URLSearchParams();
  if (branchId) qs.set("branch", String(branchId));
  const q = qs.toString();
  // La ruta es profitability-reports/summary (no financial-metrics/summary): ese
  // endpoint del modelo de ratios no expone los campos planos que el dashboard lee.
  return apiFetch<FinancialMetricsSummary>(
    `/finance/profitability-reports/summary/${q ? `?${q}` : ""}`,
  );
}

export async function fetchRevenuesByDateRange(
  branchId?: number | string,
  startDate?: string,
  endDate?: string,
): Promise<RevenueByDateRange> {
  const qs = new URLSearchParams();
  if (branchId) qs.set("branch", String(branchId));
  if (startDate) qs.set("start_date", startDate);
  if (endDate) qs.set("end_date", endDate);
  const q = qs.toString();
  return apiFetch<RevenueByDateRange>(`/finance/revenues/by_date_range/${q ? `?${q}` : ""}`);
}

export async function fetchExpensesByFrequency(
  branchId?: number | string,
): Promise<ExpensesByFrequency> {
  const qs = new URLSearchParams();
  if (branchId) qs.set("branch", String(branchId));
  const q = qs.toString();
  return apiFetch<ExpensesByFrequency>(
    `/finance/fixed-expenses/by_frequency/${q ? `?${q}` : ""}`,
  );
}

function parseAmount(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === "number") return value;
  return parseFloat(String(value)) || 0;
}

export function getMetricAmount(summary: FinancialMetricsSummary | undefined, field: keyof FinancialMetricsSummary): number {
  if (!summary) return 0;
  return parseAmount(summary[field]);
}

export function getCurrentMonthRange(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(start), end: fmt(end) };
}

export interface ProfitabilityComparison {
  period?: string;
  revenue?: string | number;
  cost?: string | number;
  profit?: string | number;
  margin?: string | number;
  orders?: number;
  [key: string]: unknown;
}

export async function fetchProfitabilityComparison(
  branchId?: number | string,
  period?: string,
  limit?: number,
): Promise<ProfitabilityComparison[]> {
  const qs = new URLSearchParams();
  if (branchId) qs.set("branch", String(branchId));
  if (period) qs.set("period", period);
  if (limit) qs.set("limit", String(limit));
  const q = qs.toString();
  return apiFetch<ProfitabilityComparison[]>(
    `/finance/profitability-reports/comparison/${q ? `?${q}` : ""}`,
  );
}

export async function fetchProfitabilityReports(
  params?: { branch?: string; period?: string; start_date?: string; end_date?: string },
) {
  const qs = new URLSearchParams();
  if (params?.branch) qs.set("branch", params.branch);
  if (params?.period) qs.set("period", params.period);
  if (params?.start_date) qs.set("start_date", params.start_date);
  if (params?.end_date) qs.set("end_date", params.end_date);
  const q = qs.toString();
  return apiFetch<{ results?: Array<{
    id: string;
    branch: number;
    period: string;
    period_display: string;
    start_date: string;
    end_date: string;
    total_revenue: string;
    total_cost: string;
    gross_profit: string;
    net_profit: string;
    net_margin: string;
    is_automated: boolean;
    created: string;
  }>; count?: number }>(
    `/finance/profitability-reports/${q ? `?${q}` : ""}`,
  );
}

export interface ProfitabilityReportDetail {
  id: string;
  branch: number;
  period: string;
  period_display: string;
  start_date: string;
  end_date: string;
  total_revenue: string;
  total_cost: string;
  gross_profit: string;
  fixed_expenses: string;
  variable_expenses: string;
  product_cost: string;
  net_profit: string;
  gross_margin: string;
  net_margin: string;
  is_automated: boolean;
  notes?: string;
  created: string;
}

export async function fetchProfitabilityReport(id: string): Promise<ProfitabilityReportDetail> {
  return apiFetch<ProfitabilityReportDetail>(`/finance/profitability-reports/${id}/`);
}
