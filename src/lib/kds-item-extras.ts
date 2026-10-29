/**
 * Helpers compartidos para mostrar extras y notas de ítems en cocina (KDS).
 * Acepta tanto KitchenTicketItem.modifiers (option_name) como
 * OrderProduct.modifiers (modifier_option_name).
 */

export type KitchenModifierLike = {
  option_name?: string | null;
  modifier_option_name?: string | null;
};

export function kitchenModifierOptionNames(
  modifiers: readonly KitchenModifierLike[] | null | undefined,
): string[] {
  if (!modifiers?.length) return [];
  const names: string[] = [];
  for (const m of modifiers) {
    const name = (m.option_name ?? m.modifier_option_name ?? "").trim();
    if (name) names.push(name);
  }
  return names;
}

/**
 * Nota del ítem para pantalla de cocina: quita líneas "+ <extra>" que ya
 * se muestran desde el array de modifiers (evita duplicar).
 */
export function kitchenItemNotesForDisplay(
  notes: string | null | undefined,
  optionNames: readonly string[],
): string | null {
  const raw = (notes ?? "").trim();
  if (!raw) return null;
  if (optionNames.length === 0) return raw;

  const optionSet = new Set(optionNames.map((n) => n.toLowerCase()));
  const lines = raw
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const filtered = lines.filter((line) => {
    const m = line.match(/^\+\s*(.+)$/);
    if (m && optionSet.has(m[1]!.trim().toLowerCase())) return false;
    return true;
  });
  if (filtered.length === 0) return null;
  return filtered.join("\n");
}
