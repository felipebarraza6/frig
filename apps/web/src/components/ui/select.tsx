import { useState, useRef, useEffect, forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

export type SelectProps = {
  options?: SelectOption[];
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "size">;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, value, onChange, ...props }, ref) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const opts: SelectOption[] =
      props.options ??
      (Array.isArray(children)
        ? children
            .filter(
              (c): c is React.ReactElement<{ value?: string | number; children?: React.ReactNode }> =>
                Boolean(c && typeof c === "object" && "props" in c),
            )
            .map((c) => ({ value: String(c.props.value ?? ""), label: String(c.props.children ?? "") }))
        : []);

    const selected = opts.find((o) => o.value === value) ?? opts[0];

    useEffect(() => {
      function handleClick(e: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      }
      if (open) document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    return (
      <div ref={containerRef} className="relative">
        <button
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
          <span className="truncate">{selected?.label ?? "—"}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        {open && (
          <div
            className="absolute z-50 mt-1.5 max-h-60 w-full min-w-[140px] overflow-auto rounded-xl border border-border/60 bg-background p-1 shadow-lg"
            role="listbox"
          >
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
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        )}
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
