"use client";

import { memo } from "react";
import { formatCLP } from "@/lib/utils";
import type { ComboList } from "@/lib/hooks/useCatalog";

interface ComboChipProps {
  combo: ComboList;
  onClick: (combo: ComboList) => void;
}

function ComboChipRaw({ combo, onClick }: ComboChipProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(combo)}
      className="flex shrink-0 max-w-[260px] items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
      title={combo.name}
    >
      <span className="min-w-0 truncate">{combo.name}</span>
      <span className="shrink-0 opacity-80">· {combo.items_count}</span>
      <span className="shrink-0 font-semibold">
        {formatCLP(combo.combo_price ?? 0)}
      </span>
    </button>
  );
}

export const ComboChip = memo(ComboChipRaw);
