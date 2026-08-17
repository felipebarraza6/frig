"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CommandPaletteItem {
  href: string;
  label: string;
  group?: string;
}

interface CommandPaletteProps {
  items: CommandPaletteItem[];
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ items, open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items.slice(0, 12);
    return items.filter((item) => item.label.toLowerCase().includes(normalized)).slice(0, 12);
  }, [items, query]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        router.push(filtered[selectedIndex].href);
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, filtered, selectedIndex, onClose, router]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[15vh]">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Buscar página..."
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No se encontraron resultados
            </p>
          ) : (
            filtered.map((item, index) => (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  router.push(item.href);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                  index === selectedIndex
                    ? "bg-primary text-white"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span>{item.label}</span>
                {item.group && (
                  <span
                    className={cn(
                      "text-xs",
                      index === selectedIndex ? "text-white/80" : "text-muted-foreground"
                    )}
                  >
                    {item.group}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span>↑↓ para navegar</span>
          <span>Enter para abrir</span>
          <span>Esc para cerrar</span>
        </div>
      </div>
    </div>
  );
}
