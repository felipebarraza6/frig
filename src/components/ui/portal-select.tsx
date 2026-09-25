"use client";

import { useState, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownPortal } from "./dropdown-portal";

export interface PortalSelectOption {
  value: string;
  label: string;
  /** Segunda línea descriptiva (banco, N° de cuenta, etc.). */
  description?: string;
}

interface PortalSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: PortalSelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  /** Alineación del panel de opciones respecto al trigger. */
  align?: "left" | "right";
}

/**
 * Select para usar DENTRO de modales y overlays. Un <select> nativo dibuja su
 * lista a nivel de SO/ventana: flota por fuera del modal, se corta con otros
 * elementos y rompe la lectura ("elementos entre medios"). Este componente
 * abre las opciones en un portal con posición fija sobre todo lo demás.
 */
export function PortalSelect({
  value,
  onChange,
  options,
  placeholder = "Selecciona…",
  className,
  disabled,
  ariaLabel,
  align = "left",
}: PortalSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-background px-2.5 text-left text-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50",
          className,
        )}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      <DropdownPortal
        triggerRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        align={align}
        className="max-h-60 min-w-[180px] overflow-auto rounded-xl border border-border bg-background p-1 shadow-lg scrollbar-thin"
      >
        <div role="listbox" aria-label={ariaLabel}>
          {options.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Sin opciones</p>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                o.value === value
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-foreground hover:bg-muted",
              )}
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate">{o.label}</span>
                {o.description && (
                  <span className="truncate text-[11px] text-muted-foreground">{o.description}</span>
                )}
              </span>
              {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
            </button>
          ))}
        </div>
      </DropdownPortal>
    </div>
  );
}
