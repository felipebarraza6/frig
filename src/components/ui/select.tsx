import { useState, useRef, forwardRef, type SelectHTMLAttributes, Children, isValidElement } from "react";
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
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const opts: SelectOption[] =
      props.options ??
      Children.toArray(children)
        .filter(
          (c): c is React.ReactElement<{ value?: string | number; children?: React.ReactNode }> =>
            isValidElement(c),
        )
        .map((c) => ({ value: String(c.props.value ?? ""), label: String(c.props.children ?? "") }));

    const selected = opts.find((o) => o.value === value) ?? opts[0];

    return (
      <div ref={containerRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
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
          <div role="listbox">
            {opts.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange?.({ target: { value: o.value } } as React.ChangeEvent<HTMLSelectElement>);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  o.value === value
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-foreground hover:bg-muted",
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
