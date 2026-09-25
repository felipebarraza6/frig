import {
  useState,
  useRef,
  useEffect,
  forwardRef,
  type SelectHTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  Children,
  isValidElement,
} from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownPortal } from "./dropdown-portal";

export type SelectOption = { value: string; label: string };

export type SelectOptionExtra = {
  icon?: React.ComponentType<{ className?: string }>;
  bold?: boolean;
};

export type SelectProps = {
  options?: SelectOption[];
  /** Extras por valor de opción (ej. ícono y negrita para categorías de sistema). */
  optionExtras?: Record<string, SelectOptionExtra>;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, value, onChange, optionExtras, ...props }, ref) => {
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listboxRef = useRef<HTMLDivElement>(null);
    const typeaheadRef = useRef("");
    const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const opts: SelectOption[] =
      props.options ??
      Children.toArray(children)
        .filter(
          (c): c is React.ReactElement<{ value?: string | number; children?: React.ReactNode }> =>
            isValidElement(c),
        )
        .map((c) => ({ value: String(c.props.value ?? ""), label: String(c.props.children ?? "") }));

    const selectedIndex = Math.max(
      0,
      opts.findIndex((o) => o.value === value),
    );
    const selected = opts[selectedIndex];

    const selectOption = (index: number) => {
      const opt = opts[index];
      if (!opt) return;
      onChange?.({ target: { value: opt.value } } as React.ChangeEvent<HTMLSelectElement>);
      setOpen(false);
    };

    // Al abrir, el foco entra al listbox y sigue a la opción activa.
    useEffect(() => {
      if (!open) return;
      const el = listboxRef.current
        ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
        .item(activeIndex);
      el?.focus();
      el?.scrollIntoView({ block: "nearest" });
    }, [open, activeIndex]);

    // Al cerrar, el foco vuelve al trigger.
    useEffect(() => {
      if (!open) triggerRef.current?.focus();
    }, [open]);

    // Teclado en fase capture: consume las teclas antes de que otros
    // listeners (ej. el Escape del modal padre en window) las vean.
    useEffect(() => {
      if (!open) return;
      const handleKey = (e: KeyboardEvent) => {
        const max = opts.length;
        if (max === 0) return;
        switch (e.key) {
          case "Escape":
            e.stopPropagation();
            setOpen(false);
            return;
          case "ArrowDown":
            e.preventDefault();
            e.stopPropagation();
            setActiveIndex((i) => (i + 1) % max);
            return;
          case "ArrowUp":
            e.preventDefault();
            e.stopPropagation();
            setActiveIndex((i) => (i - 1 + max) % max);
            return;
          case "Home":
            e.preventDefault();
            e.stopPropagation();
            setActiveIndex(0);
            return;
          case "End":
            e.preventDefault();
            e.stopPropagation();
            setActiveIndex(max - 1);
            return;
          case "Enter":
          case " ":
            e.preventDefault();
            e.stopPropagation();
            selectOption(activeIndex);
            return;
        }
        // Typeahead: acumular caracteres y saltar a la primera coincidencia.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          e.stopPropagation();
          typeaheadRef.current += e.key.toLowerCase();
          if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
          typeaheadTimerRef.current = setTimeout(() => {
            typeaheadRef.current = "";
          }, 500);
          const match = opts.findIndex((o) =>
            o.label.toLowerCase().startsWith(typeaheadRef.current),
          );
          if (match >= 0) setActiveIndex(match);
        }
      };
      window.addEventListener("keydown", handleKey, true);
      return () => {
        window.removeEventListener("keydown", handleKey, true);
        if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
      };
    }, [open, activeIndex, opts, onChange]);

    return (
      <div ref={containerRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            if (!open) setActiveIndex(selectedIndex);
            setOpen((v) => !v);
          }}
          onKeyDown={(e: ReactKeyboardEvent<HTMLButtonElement>) => {
            // Con el listbox abierto el listener global maneja las teclas.
            if (open || opts.length === 0) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex(
                e.key === "ArrowDown"
                  ? (selectedIndex + 1) % opts.length
                  : (selectedIndex - 1 + opts.length) % opts.length,
              );
              setOpen(true);
            }
          }}
          className={cn(
            "flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 text-left text-sm shadow-sm transition-colors hover:bg-muted/60 focus-visible:border-primary/40 focus-visible:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50",
            className,
          )}
          disabled={props.disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          <span className="flex min-w-0 items-center gap-2">
            {optionExtras?.[String(value ?? "")]?.icon &&
              (() => {
                const Icon = optionExtras[String(value ?? "")].icon!;
                return <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
              })()}
            <span className="truncate">{selected?.label ?? "—"}</span>
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
          autoWidth
          className="max-h-60 overflow-auto rounded-xl border border-border/60 bg-background p-1 shadow-lg scrollbar-thin"
        >
          <div role="listbox" ref={listboxRef}>
            {opts.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={o.value === value}
                onClick={() => selectOption(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  o.value === value
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted",
                  i === activeIndex && o.value !== value && "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex min-w-0 items-center gap-2",
                    optionExtras?.[o.value]?.bold && "font-semibold",
                  )}
                >
                  {optionExtras?.[o.value]?.icon &&
                    (() => {
                      const Icon = optionExtras[o.value].icon!;
                      return <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />;
                    })()}
                  <span className="truncate">{o.label}</span>
                </span>
                {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </DropdownPortal>
        {/* Select nativo oculto para formularios / accesibilidad */}
        <select
          ref={ref}
          value={value}
          onChange={onChange}
          className="sr-only"
          tabIndex={-1}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  },
);

Select.displayName = "Select";
