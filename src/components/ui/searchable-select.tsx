"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, ChevronDown, X, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownPortal } from "@/components/ui/dropdown-portal";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  id?: string;
  options: SearchableSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  label?: string;
  clearable?: boolean;
  loading?: boolean;
  onQueryChange?: (query: string) => void;
  minChars?: number;
  searchHint?: string;
  selectedOption?: SearchableSelectOption | null;
  className?: string;
}

export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Selecciona…",
  searchPlaceholder = "Buscar…",
  emptyMessage = "Sin coincidencias",
  disabled,
  label,
  clearable = false,
  loading = false,
  onQueryChange,
  minChars = 0,
  searchHint,
  selectedOption,
  className,
}: SearchableSelectProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listboxId = `${fieldId}-listbox`;

  const [open, setOpenState] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isAsync = typeof onQueryChange === "function";

  const selected = useMemo(() => {
    if (selectedOption && selectedOption.value === value) return selectedOption;
    return options.find((o) => o.value === value) ?? selectedOption ?? null;
  }, [options, value, selectedOption]);

  const filtered = useMemo(() => {
    if (isAsync) {
      if (query.trim().length < minChars) {
        return value ? options.filter((o) => o.value === value) : [];
      }
      return options;
    }
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.description?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query, isAsync, minChars, value]);

  const queryTooShort = isAsync && query.trim().length > 0 && query.trim().length < minChars;
  const showHint =
    isAsync && query.trim().length < minChars && !loading && filtered.length === 0;

  function setOpen(next: boolean) {
    if (next) {
      setQuery("");
      setHighlight(0);
      if (isAsync) onQueryChange?.("");
    }
    setOpenState(next);
  }

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>("[data-highlighted]");
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, open, filtered]);

  function commit(option: SearchableSelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    setOpenState(false);
  }

  function clearSelection(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  function handleQueryChange(next: string) {
    setQuery(next);
    setHighlight(0);
    if (!isAsync) return;
    if (next.trim().length === 0 || next.trim().length >= minChars) {
      onQueryChange?.(next);
    }
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpenState(false);
      triggerRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) commit(opt);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      setHighlight(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      setHighlight(Math.max(filtered.length - 1, 0));
    }
  }

  const hintText =
    searchHint ??
    (minChars > 0 ? `Escribe al menos ${minChars} caracteres…` : "Escribe para buscar…");

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
        onClick={() => setOpen(!open)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 text-left text-sm shadow-sm transition-colors hover:bg-muted/60 focus-visible:border-primary/40 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-primary/40 bg-background ring-2 ring-ring/50",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {clearable && selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={clearSelection}
              className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Limpiar selección"
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
        onClose={() => setOpenState(false)}
        className="overflow-hidden rounded-xl border border-border/60 bg-background shadow-lg"
      >
        <div className="border-b border-border/60 p-2" onKeyDown={handleListKeyDown}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 rounded-lg pl-8 pr-8 text-sm"
              aria-autocomplete="list"
              aria-controls={listboxId}
            />
            {loading ? (
              <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : query ? (
              <button
                type="button"
                onClick={() => handleQueryChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <div
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="max-h-60 overflow-y-auto p-1 scrollbar-thin"
          onKeyDown={handleListKeyDown}
        >
          {showHint || queryTooShort ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{hintText}</p>
          ) : loading && filtered.length === 0 ? (
            <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Buscando…
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            filtered.map((option, index) => {
              const isSelected = option.value === value;
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
                  onClick={() => commit(option)}
                  className={cn(
                    "flex w-full items-start justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    isHighlighted && !isSelected && "bg-muted",
                    isSelected && "bg-primary/10 font-medium text-primary",
                    option.disabled && "cursor-not-allowed opacity-50",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.description && (
                      <span
                        className={cn(
                          "block truncate text-xs",
                          isSelected ? "text-primary/70" : "text-muted-foreground",
                        )}
                      >
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isSelected && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </DropdownPortal>
    </div>
  );
}
