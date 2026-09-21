"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X, Check } from "lucide-react";
import { DropdownPortal } from "@/components/ui/dropdown-portal";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface MultiSelectProps {
  id?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
  /** Máximo de chips visibles en el trigger; el resto como +N. */
  maxChips?: number;
}

export function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Selecciona…",
  disabled,
  label,
  className,
  maxChips = 2,
}: MultiSelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listboxId = `${fieldId}-listbox`;
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => options.filter((o) => value.includes(o.value)),
    [options, value],
  );

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>("[data-highlighted]");
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  function toggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange([]);
  }

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, Math.max(options.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const opt = options[highlight];
      if (opt && !opt.disabled) toggle(opt.value);
    }
  }

  const visibleChips = selected.slice(0, maxChips);
  const extraCount = selected.length - visibleChips.length;

  return (
    <div className={cn("relative", className)}>
      {label && (
        <label htmlFor={fieldId} className="mb-1 block text-xs text-muted-foreground">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        id={fieldId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(
          "flex h-9 min-w-[9rem] w-full items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 px-2.5 text-left text-sm shadow-sm transition-colors hover:bg-muted/60 focus-visible:border-primary/40 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-primary/40 bg-background ring-2 ring-ring/50",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {selected.length === 0 ? (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          ) : (
            <>
              {visibleChips.map((o) => (
                <span
                  key={o.value}
                  className="inline-flex max-w-[7rem] truncate rounded-md bg-foreground/10 px-1.5 py-0.5 text-[11px] font-medium"
                >
                  {o.label}
                </span>
              ))}
              {extraCount > 0 && (
                <span className="rounded-md bg-foreground/10 px-1.5 py-0.5 text-[11px] font-medium">
                  +{extraCount}
                </span>
              )}
            </>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {selected.length > 0 && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={clear}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Limpiar"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </button>

      <DropdownPortal
        triggerRef={triggerRef}
        open={open}
        onClose={() => setOpen(false)}
        className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-lg"
      >
        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-multiselectable
          className="max-h-60 overflow-y-auto p-1 scrollbar-thin"
          onKeyDown={handleListKeyDown}
        >
          {options.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">Sin opciones</p>
          ) : (
            options.map((option, index) => {
              const isSelected = value.includes(option.value);
              const isHighlighted = index === highlight;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-highlighted={isHighlighted || undefined}
                  disabled={option.disabled}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => toggle(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    isHighlighted && !isSelected && "bg-muted",
                    isSelected && "bg-primary/10 font-medium text-primary",
                    option.disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border",
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </button>
              );
            })
          )}
        </div>
      </DropdownPortal>
    </div>
  );
}
