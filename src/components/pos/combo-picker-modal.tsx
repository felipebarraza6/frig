"use client";

import { useMemo, useState } from "react";
import { Boxes, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody } from "@/components/ui/modal";
import { cn, formatCLP } from "@/lib/utils";
import { comboItemsCount, isComboCurrentlyValid } from "@/lib/api/combos";
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
    const base = combos.filter((c) => isComboCurrentlyValid(c));
    if (!q) return base;
    return base.filter((c) => c.name.toLowerCase().includes(q));
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
          <div className="grid h-full place-items-center px-4 py-10 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Boxes className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium">No hay combos vigentes</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Solo se muestran combos activos, con productos y dentro de su
                vigencia.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {filtered.map((combo) => {
              const n = comboItemsCount(combo);
              return (
                <button
                  key={combo.id}
                  type="button"
                  onClick={() => onSelect(combo)}
                  className={cn(
                    "flex flex-col gap-2 rounded-2xl border border-border/70 bg-card p-3.5 text-left shadow-sm transition-all",
                    "hover:border-primary/40 hover:shadow-md",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{combo.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {n} producto{n === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-bold tabular-nums text-primary">
                      {formatCLP(combo.combo_price ?? 0)}
                    </span>
                  </div>
                  {combo.items && combo.items.length > 0 && (
                    <ul className="flex flex-col gap-0.5 rounded-xl border border-border/50 bg-muted/30 px-2.5 py-2">
                      {combo.items.slice(0, 5).map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                        >
                          <span className="truncate">
                            {item.quantity ?? 1}× {item.product_name}
                          </span>
                          {"product_price" in item && item.product_price != null ? (
                            <span className="shrink-0 tabular-nums">
                              {formatCLP(item.product_price as number)}
                            </span>
                          ) : null}
                        </li>
                      ))}
                      {combo.items.length > 5 && (
                        <li className="text-[10px] text-muted-foreground">
                          +{combo.items.length - 5} más
                        </li>
                      )}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
