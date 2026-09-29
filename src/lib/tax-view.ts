import type { TaxType } from "@/lib/api/tax-types";

/**
 * Recalcula un monto según los impuestos que el usuario quiere ver.
 * - Impuesto incluido en el precio y desmarcado: se saca del monto.
 * - Impuesto no incluido y marcado: se agrega encima.
 */
export function viewAmountWithTaxes(
  amount: number,
  taxes: TaxType[],
  selectedIds: Set<string>,
): number {
  let v = amount;
  const sorted = [...taxes].sort(
    (a, b) => (a.priority ?? 100) - (b.priority ?? 100),
  );
  for (const t of sorted) {
    if (t.tax_calc && t.tax_calc !== "PERCENTAGE") continue;
    const rate = Number(t.rate ?? 0) / 100;
    if (rate <= 0) continue;
    const on = selectedIds.has(t.id);
    const included = t.is_included_in_price !== false;
    if (included && !on) v = v / (1 + rate);
    else if (!included && on) v = v * (1 + rate);
  }
  return v;
}

export function defaultSelectedTaxIds(taxes: TaxType[]): string[] {
  const included = taxes.filter((t) => t.is_included_in_price !== false);
  if (included.length > 0) return included.map((t) => t.id);
  return taxes.filter((t) => t.is_default).map((t) => t.id);
}

const storageKey = (branchId: number) => `frig-finance-tax-view:${branchId}`;
const legacyKey = (branchId: number) => `frig-ingresos-tax-view:${branchId}`;

export function loadTaxViewSelection(
  branchId: number,
  taxes: TaxType[],
): Set<string> {
  try {
    const raw =
      window.localStorage.getItem(storageKey(branchId)) ??
      window.localStorage.getItem(legacyKey(branchId));
    if (raw) {
      const ids = JSON.parse(raw) as string[];
      const known = new Set(taxes.map((t) => t.id));
      const kept = ids.filter((id) => known.has(id));
      if (kept.length > 0 || ids.length === 0) return new Set(kept);
    }
  } catch {
    /* ignore */
  }
  return new Set(defaultSelectedTaxIds(taxes));
}

export function saveTaxViewSelection(branchId: number, ids: string[]) {
  try {
    window.localStorage.setItem(storageKey(branchId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}
