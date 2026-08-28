"use client";

import { useMemo, useState } from "react";
import { Boxes, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody } from "@/components/ui/modal";
import { cn, formatCLP } from "@/lib/utils";
import type { ComboList } from "@/lib/hooks/useCatalog";

interface ComboPickerModalProps {
  combos: ComboList[];
  onSelect: (combo: ComboList) => void;
  onClose: () => void;
}

export function ComboPickerModal({ combos, onSelect, onClose }: ComboPickerModalProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return combos;
    return combos.filter((c) => c.name.toLowerCase().includes(q));
  }, [combos, query]);

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-primary" />
          Combos
        </span>
      }
      size="lg"
      hideCloseButton
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-6 py-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar combo…"
            className="h-9 pl-8 text-xs"
            autoFocus
          />
        </div>
      </div>

      <ModalBody className="px-3 py-3">
        {filtered.length === 0 ? (
          <div className="grid h-full place-items-center">
            <p className="text-sm text-muted-foreground">No se encontraron combos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filtered.map((combo) => (
              <button
                key={combo.id}
                type="button"
                onClick={() => onSelect(combo)}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border border-border/60 bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{combo.name}</p>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                    {formatCLP(parseFloat(combo.combo_price || "0"))}
                  </span>
                </div>
                {combo.items && combo.items.length > 0 && (
                  <ul className="flex flex-col gap-0.5 border-t border-border/40 pt-2">
                    {combo.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between text-xs text-muted-foreground"
                      >
                        <span className="truncate">
                          {item.quantity ?? 1}× {item.product_name}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatCLP(parseFloat(item.product_price ?? "0"))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </button>
            ))}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
