import {
  kitchenItemNotesForDisplay,
  kitchenModifierOptionNames,
  type KitchenModifierLike,
} from "@/lib/kds-item-extras";
import { cn } from "@/lib/utils";

/**
 * Líneas de extras y nota de un ítem de cocina, legibles en pantalla KDS.
 * No duplica "+ extra" si `notes` ya las incluye.
 */
export function KdsItemExtras({
  modifiers,
  notes,
  className,
}: {
  modifiers?: readonly KitchenModifierLike[] | null;
  notes?: string | null;
  className?: string;
}) {
  const optionNames = kitchenModifierOptionNames(modifiers);
  const note = kitchenItemNotesForDisplay(notes, optionNames);
  if (optionNames.length === 0 && !note) return null;

  return (
    <div className={cn("mt-0.5 space-y-0.5 text-xs leading-snug", className)}>
      {optionNames.map((name) => (
        <p key={name} className="font-medium text-foreground/90">
          + {name}
        </p>
      ))}
      {note ? (
        <p className="whitespace-pre-line text-warning">{note}</p>
      ) : null}
    </div>
  );
}
