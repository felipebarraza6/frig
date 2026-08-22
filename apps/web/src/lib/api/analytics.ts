import { apiFetch } from "./client";

export type ModuleCounts = {
  employees?: { total: number; active: number };
  suppliers?: { total: number };
  customers?: { total: number };
  inventory?: { total_products: number; low_stock: number };
  sales?: { total_orders: number; pending_orders: number; pending_sales_amount: number };
  finance?: { total_payments: number; total_expenses: number };
  scheduling?: { today_appointments: number };
  certificates?: { total: number; expiring_soon: number };
  recipes?: { total: number };
  waste?: { total_waste_materials: number; total_tank_containers: number };
  measurements?: { total: number; pending: number };
  expenses_by_supplier?: { supplier: string; count: number; total: number }[];
};

export type DashboardSummary = {
  sales: {
    count: number;
    total_amount: number;
    profit: number;
    paid_amount: number;
    completed: { count: number; total_amount: number; profit: number };
  };
  orders: {
    count: number;
    completed: number;
    in_progress: number;
    cancelled: number;
    total_amount: number;
    profit: number;
    completed_summary: { count: number; total_amount: number; profit: number };
  };
  products: {
    best_selling: { product__name: string; quantity: number; total: number }[];
    most_profitable: unknown[];
    least_selling: unknown[];
    least_profitable: unknown[];
  };
  time_series: { date: string; sales: number; orders: number }[];
  payments: { type_payment__name: string; total: number }[];
}

export type DateRange = "today" | "yesterday" | "week" | "month" | "single" | "custom";

export type IngredientConsumptionItem = {
  ingredient_id: string;
  ingredient_name: string;
  total_quantity: number;
  unit: string;
  cost: number;
};

export type IngredientConsumption = {
  period: { start: string; end: string };
  total_cost: number;
  items: IngredientConsumptionItem[];
};

export async function fetchModuleCounts(branchId?: string | number): Promise<ModuleCounts> {
  const params = new URLSearchParams();
  if (branchId) params.set("branch", String(branchId));
  const qs = params.toString();
  return apiFetch<ModuleCounts>(`/analytics/dashboard/module_counts/${qs ? `?${qs}` : ""}`);
}

export async function fetchIngredientConsumption(
  startDate?: string,
  endDate?: string,
  branchId?: string | number,
): Promise<IngredientConsumption> {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  if (branchId) params.set("branch", String(branchId));
  const qs = params.toString();
  return apiFetch<IngredientConsumption>(`/analytics/dashboard/ingredient-consumption/${qs ? `?${qs}` : ""}`);
}

export async function fetchDashboardSummary(
  startDate?: string,
  endDate?: string,
  branchId?: string | number,
): Promise<DashboardSummary> {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  if (branchId) params.set("branch", String(branchId));
  const qs = params.toString();
  return apiFetch<DashboardSummary>(`/analytics/dashboard/summary/${qs ? `?${qs}` : ""}`);
}
