"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, m, LazyMotion, domAnimation } from "framer-motion";
import { Search, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const RECENT_KEY = "frig.cmdk.recent";
const MAX_RECENT = 5;
const MAX_RESULTS = 20;

export interface CommandPaletteItem {
  href: string;
  label: string;
  group?: string;
  icon?: LucideIcon;
  description?: string;
  shortcut?: string[];
  action?: () => void;
}

interface CommandPaletteProps {
  items: CommandPaletteItem[];
  open: boolean;
  onClose: () => void;
}

function fuzzyScore(query: string, label: string): number {
  const q = query.toLowerCase();
  const l = label.toLowerCase();

  if (l.includes(q)) return 100 + (l.startsWith(q) ? 50 : 0);

  let qi = 0;
  let score = 0;
  let prevMatch = false;
  let wordStart = true;

  for (let li = 0; li < l.length && qi < q.length; li++) {
    if (l[li] === " ") {
      wordStart = true;
      prevMatch = false;
      continue;
    }
    if (l[li] === q[qi]) {
      score += prevMatch ? 10 : 1;
      if (wordStart) score += 15;
      prevMatch = true;
      qi++;
    } else {
      prevMatch = false;
    }
    wordStart = false;
  }

  return qi === q.length ? score : 0;
}

function getRecentPaths(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function addRecentPath(href: string) {
  if (typeof window === "undefined" || !href) return;
  try {
    const current = getRecentPaths().filter((p) => p !== href);
    const next = [href, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function CommandPalette({ items, open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const recentPaths = useMemo(() => getRecentPaths(), []);

  const recentItems = useMemo(() => {
    if (query.trim()) return [];
    return recentPaths
      .map((href) => items.find((i) => i.href === href))
      .filter((i): i is CommandPaletteItem => !!i);
  }, [query, recentPaths, items]);

  const searchResults = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      const recentHrefs = new Set(recentItems.map((i) => i.href));
      return items.filter((i) => !recentHrefs.has(i.href));
    }
    return items
      .map((item) => ({ item, score: fuzzyScore(trimmed, item.label) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.item);
  }, [query, items, recentItems]);

  const groupedResults = useMemo(() => {
    if (query.trim()) return null;
    const groups = new Map<string, CommandPaletteItem[]>();
    for (const item of searchResults) {
      const g = item.group ?? "Otros";
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g)!.push(item);
    }
    return groups;
  }, [query, searchResults]);

  const flatList = useMemo(() => [...recentItems, ...searchResults], [recentItems, searchResults]);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setQuery("");
      setSelectedIndex(0);
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector("[data-selected]");
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const executeItem = useCallback(
    (item: CommandPaletteItem) => {
      if (item.action) {
        item.action();
      } else if (item.href) {
        addRecentPath(item.href);
        router.push(item.href);
      }
      onClose();
    },
    [router, onClose],
  );

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % flatList.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + flatList.length) % flatList.length);
        return;
      }
      if (e.key === "Enter" && flatList[selectedIndex]) {
        e.preventDefault();
        executeItem(flatList[selectedIndex]);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        const idx = Number(e.key) - 1;
        const target = searchResults[idx];
        if (target) executeItem(target);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, flatList, selectedIndex, onClose, executeItem, query, searchResults]);

  if (typeof window === "undefined") return null;

  const showShortcuts = !query.trim();

  return createPortal(
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]"
            role="dialog"
            aria-modal="true"
          >
            <m.div
              key="cp-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <m.div
              key="cp-panel"
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="neon-border relative z-10 w-full max-w-lg rounded-2xl p-px"
            >
              {/* Halo neón difuso detrás del panel */}
              <div aria-hidden className="neon-border-glow absolute -inset-1.5 -z-10 rounded-3xl" />
              <div className="overflow-hidden rounded-[calc(1rem-1px)] bg-card/95 backdrop-blur-2xl">
              <div className="flex items-center gap-2.5 px-4 py-3.5">
                <Search className="h-4 w-4 shrink-0 text-primary" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder="Buscar páginas y acciones…"
                  className="h-8 flex-1 bg-transparent text-sm text-foreground caret-primary outline-none placeholder:text-muted-foreground/60"
                  autoFocus
                />
                <kbd className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  esc
                </kbd>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              <div
                ref={listRef}
                className="max-h-[60vh] overflow-y-auto p-2"
              >
                {flatList.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-10">
                    <Search className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      No se encontraron resultados
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      Intenta con otras palabras clave
                    </p>
                  </div>
                ) : query.trim() ? (
                  searchResults.map((item, index) => (
                    <PaletteItem
                      key={`${item.href}-${item.label}`}
                      item={item}
                      index={index}
                      selected={index === selectedIndex}
                      onSelect={() => executeItem(item)}
                      shortcutHint={showShortcuts && index < 5 ? index + 1 : undefined}
                    />
                  ))
                ) : (
                  <>
                    {recentItems.length > 0 && (
                      <GroupSection label="Recientes">
                        {recentItems.map((item, i) => (
                          <PaletteItem
                            key={`recent-${item.href}`}
                            item={item}
                            index={i}
                            selected={i === selectedIndex}
                            onSelect={() => executeItem(item)}
                            showGroupBadge
                          />
                        ))}
                      </GroupSection>
                    )}
                    {groupedResults &&
                      Array.from(groupedResults.entries()).map(([group, groupItems]) => {
                        let baseIndex = recentItems.length;
                        for (const [prevGroup, prevItems] of groupedResults) {
                          if (prevGroup === group) break;
                          baseIndex += prevItems.length;
                        }
                        return (
                          <GroupSection key={group} label={group}>
                            {groupItems.map((item, gi) => {
                              const flatIdx = baseIndex + gi;
                              return (
                                <PaletteItem
                                  key={`${item.href}-${item.label}`}
                                  item={item}
                                  index={flatIdx}
                                  selected={flatIdx === selectedIndex}
                                  onSelect={() => executeItem(item)}
                                  shortcutHint={gi < 5 ? gi + 1 : undefined}
                                />
                              );
                            })}
                          </GroupSection>
                        );
                      })}
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted/50 px-1 py-px font-mono">↑↓</kbd>
                  navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted/50 px-1 py-px font-mono">↵</kbd>
                  abrir
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted/50 px-1 py-px font-mono">esc</kbd>
                  cerrar
                </span>
              </div>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>,
    document.body,
  );
}

function GroupSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </p>
      {children}
    </div>
  );
}

function PaletteItem({
  item,
  selected,
  onSelect,
  shortcutHint,
  showGroupBadge,
  index,
}: {
  item: CommandPaletteItem;
  index: number;
  selected: boolean;
  onSelect: () => void;
  shortcutHint?: number;
  showGroupBadge?: boolean;
}) {
  const Icon = item.icon;

  return (
    <m.button
      type="button"
      onClick={onSelect}
      data-selected={selected || undefined}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.15), ease: "easeOut" }}
      className={cn(
        "relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2 text-left text-sm",
        selected ? "text-primary-foreground" : "text-foreground",
      )}
    >
      {selected && (
        <m.span
          layoutId="palette-active"
          transition={{ type: "spring", stiffness: 480, damping: 38 }}
          className="absolute inset-0 rounded-xl bg-primary shadow-sm shadow-primary/40"
        />
      )}
      <span
        className={cn(
          "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-primary-foreground/15" : "bg-primary/[0.08]",
        )}
      >
        {Icon && (
          <Icon
            className={cn("h-3.5 w-3.5", selected ? "text-primary-foreground" : "text-primary")}
          />
        )}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block truncate font-medium">{item.label}</span>
        {item.description && (
          <span
            className={cn(
              "block truncate text-xs",
              selected ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            {item.description}
          </span>
        )}
      </span>
      {showGroupBadge && item.group && (
        <span
          className={cn(
            "relative shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
            selected
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {item.group}
        </span>
      )}
      {shortcutHint !== undefined && (
        <span
          className={cn(
            "relative shrink-0 font-mono text-[11px]",
            selected ? "text-primary-foreground/70" : "text-muted-foreground/70",
          )}
        >
          ⌘{shortcutHint}
        </span>
      )}
    </m.button>
  );
}
