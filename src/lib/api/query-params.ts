/**
 * Helpers para query params de listados Yggdra.
 * Preferir `status__in=a,b` (django-filter) sobre claves repetidas.
 */

/** Serializa uno o varios valores: 1 → `key`, 2+ → `key__in` (si la clave aún no termina en __in). */
export function appendMulti(
  qs: URLSearchParams,
  key: string,
  value: string | number | Array<string | number> | null | undefined,
): void {
  if (value === undefined || value === null || value === "") return;
  const values = (Array.isArray(value) ? value : [value])
    .map((v) => String(v).trim())
    .filter(Boolean);
  if (values.length === 0) return;
  const suffix = values.length > 1 && !key.endsWith("__in") ? "__in" : "";
  qs.set(`${key}${suffix}`, values.join(","));
}

/** Normaliza string | string[] a string[] limpio. */
export function asStringArray(
  value: string | string[] | null | undefined,
): string[] {
  if (value === undefined || value === null || value === "") return [];
  return (Array.isArray(value) ? value : [value])
    .map((v) => String(v).trim())
    .filter(Boolean);
}
