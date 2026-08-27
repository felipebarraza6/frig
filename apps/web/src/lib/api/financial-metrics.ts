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

export async function fetchFinancialMetricsSummary(): Promise<FinancialMetricsSummary> {
  return apiFetch<FinancialMetricsSummary>("/finance/financial-metrics/summary/");
}

export async function fetchRevenuesByDateRange(
  startDate?: string,
  endDate?: string,
): Promise<RevenueByDateRange> {
  const qs = new URLSearchParams();
  if (startDate) qs.set("start_date", startDate);
  if (endDate) qs.set("end_date", endDate);
  const q = qs.toString();
  return apiFetch<RevenueByDateRange>(`/finance/revenues/by_date_range/${q ? `?${q}` : ""}`);
}

export async function fetchExpensesByFrequency(): Promise<ExpensesByFrequency> {
  return apiFetch<ExpensesByFrequency>("/finance/fixed-expenses/by_frequency/");
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
