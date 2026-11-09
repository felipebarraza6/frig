export type SelectOptionLike = { value: string; label: string };

/** El valor controlado puede ser número; las opciones del select son string. */
export function findSelectOption<T extends SelectOptionLike>(
  options: T[],
  value: string | number | readonly string[] | undefined,
): T | undefined {
  if (Array.isArray(value)) return undefined;
  const current = value == null ? "" : String(value);
  return options.find((option) => option.value === current);
}
