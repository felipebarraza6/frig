"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, m, LazyMotion, domAnimation } from "framer-motion";
import { Search, X, CircleHelp, ArrowLeft, ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBranchModulesState } from "@/lib/store/session";
import { isPathModuleEnabled } from "@/lib/hooks/useRouteModuleAccess";

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

/* ── Centro de ayuda integrado ────────────────────────────────────────────── */

interface HelpTopic {
  id: string;
  title: string;
  summary: string;
  keywords: string[];
  href: string;
  hrefLabel: string;
  steps: string[];
}

const HELP_TOPICS: HelpTopic[] = [
  {
    id: "abrir-caja",
    title: "¿Cómo abro la caja?",
    summary: "Primer paso para vender: apertura de caja con monto inicial",
    keywords: ["caja", "apertura", "fondo", "vender"],
    href: "/cash-register",
    hrefLabel: "Ir a Caja",
    steps: [
      "Abre «Caja» desde el menú Operaciones (o con ⌘K y escribe «caja»).",
      "Ingresa el monto inicial en efectivo que hay en la caja.",
      "Confirma con «Abrir caja». El estado queda visible en el POS.",
    ],
  },
  {
    id: "venta-pos",
    title: "Hacer una venta en el POS",
    summary: "Venta inmediata: toca productos, cobra y entrega comprobante",
    keywords: ["vender", "venta", "pos", "cobrar", "cobro"],
    href: "/pos/terminal",
    hrefLabel: "Ir al POS",
    steps: [
      "Entra a «Punto de Venta (POS)» y elige el modo Venta.",
      "Toca los productos del catálogo para agregarlos a la cuenta.",
      "En el panel de la cuenta, agrega los pagos con sus métodos.",
      "Pulsa «Cobrar»: se registra la venta y se muestra el comprobante.",
    ],
  },
  {
    id: "cuenta-abierta",
    title: "Abrir y cobrar una cuenta abierta",
    summary: "Venta a crédito o por pagar: cliente + productos + cobro después",
    keywords: ["cuenta", "crédito", "fiado", "pendiente", "cobrar"],
    href: "/pos/terminal",
    hrefLabel: "Ir al POS",
    steps: [
      "En el POS, abre el panel «Cuentas» y pulsa «Abrir cuenta».",
      "Selecciona un cliente existente o créalo en el momento.",
      "Agrega los productos y guarda: la cuenta queda pendiente de pago.",
      "Para cobrarla, vuelve a «Cuentas», elige la cuenta y pulsa «Cobrar».",
    ],
  },
  {
    id: "crear-producto",
    title: "Crear un producto",
    summary: "Alta en el catálogo con precio, categoría y disponibilidad",
    keywords: ["producto", "catálogo", "precio", "crear", "nuevo"],
    href: "/products",
    hrefLabel: "Ir a Productos",
    steps: [
      "Ve a «Productos» y pulsa «Nuevo producto».",
      "Completa nombre, precio de venta y categoría (mínimo).",
      "Guarda: el producto aparece de inmediato en el catálogo del POS.",
    ],
  },
  {
    id: "descuentos",
    title: "Crear y aplicar un descuento",
    summary: "Códigos promocionales que el cajero aplica en el carrito",
    keywords: ["descuento", "promoción", "código", "cupón", "oferta"],
    href: "/promotions/discounts",
    hrefLabel: "Ir a Promociones",
    steps: [
      "En «Promociones» crea un descuento con su código (ej: PROMO10).",
      "Define tipo (porcentaje o monto), valor y vigencia.",
      "En el carrito del POS, escribe el código en la sección «Descuento».",
    ],
  },
  {
    id: "cierre-caja",
    title: "Cerrar la caja y cuadrar",
    summary: "Arqueo con monto final, diferencias y resumen del día",
    keywords: ["cierre", "cuadrar", "arqueo", "diferencia", "caja"],
    href: "/cash-register",
    hrefLabel: "Ir a Caja",
    steps: [
      "Abre «Caja» al final del turno.",
      "Cuenta el efectivo real e ingresa el «Monto final en caja».",
      "Revisa la diferencia contra el esperado y confirma «Cerrar caja».",
    ],
  },
  {
    id: "atajos",
    title: "Atajos de teclado",
    summary: "Navega más rápido con el teclado en toda la app",
    keywords: ["atajos", "teclado", "shortcuts", "keyboard"],
    href: "",
    hrefLabel: "",
    steps: [
      "⌘K / Ctrl+K: abre este buscador desde cualquier página.",
      "↑ y ↓: navegan los resultados · Enter: abre el seleccionado.",
      "1 a 5: abren el resultado de esa posición · Esc: cierra.",
    ],
  },
];

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
  const [activeHelp, setActiveHelp] = useState<HelpTopic | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const recentPaths = useMemo(() => getRecentPaths(), []);
  const modulesState = useBranchModulesState();

  // Los temas de ayuda se comportan como ítems: son navegables con teclado y
  // aparecen en los resultados de búsqueda, pero abren la guía en vez de navegar.
  // Se ocultan los temas cuya ruta objetivo pertenece a un módulo desactivado
  // (ej. no sugerir "Hacer una venta en el POS" si el módulo pos está off).
  const visibleHelpTopics = useMemo(
    () => HELP_TOPICS.filter((t) => !t.href || isPathModuleEnabled(t.href, modulesState)),
    [modulesState],
  );

  const helpItems = useMemo<CommandPaletteItem[]>(
    () =>
      visibleHelpTopics.map((topic) => ({
        href: "",
        label: topic.title,
        group: "Centro de ayuda",
        icon: CircleHelp,
        description: topic.summary,
        action: () => setActiveHelp(topic),
      })),
    [visibleHelpTopics],
  );

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
    const scoredNav = items
      .map((item) => ({ item, score: fuzzyScore(trimmed, item.label) }))
      .filter((r) => r.score > 0);
    const scoredHelp = visibleHelpTopics.map((topic) => {
      const haystack = [topic.title, topic.summary, ...topic.keywords].join(" ");
      return { item: helpItems.find((h) => h.label === topic.title)!, score: fuzzyScore(trimmed, haystack) * 0.9 };
    }).filter((r) => r.score > 0);
    return [...scoredNav, ...scoredHelp]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map((r) => r.item);
  }, [query, items, recentItems, helpItems, visibleHelpTopics]);

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

  const flatList = useMemo(() => {
    if (query.trim()) return searchResults;
    return [...recentItems, ...searchResults, ...helpItems];
  }, [query, searchResults, recentItems, helpItems]);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setQuery("");
      setSelectedIndex(0);
      setActiveHelp(null);
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

  // Ref espejo del tema activo para consultarlo dentro del listener de teclado.
  const activeHelpRef = useRef<HelpTopic | null>(null);
  useEffect(() => {
    activeHelpRef.current = activeHelp;
  }, [activeHelp]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Dentro de una guía, Esc vuelve a la lista en vez de cerrar.
        if (activeHelpRef.current) {
          setActiveHelp(null);
          return;
        }
        onClose();
        return;
      }
      if (activeHelpRef.current) return;
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
              className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-white/30 bg-card/85 shadow-2xl shadow-primary/25 backdrop-blur-2xl dark:border-white/10"
            >
              {/* Filo superior con degradado del primary */}
              <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent" />

              <div className="flex items-center gap-2.5 px-4 py-3.5">
                <Search className="h-4 w-4 shrink-0 text-primary" />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                    setActiveHelp(null);
                  }}
                  placeholder="Buscar páginas, acciones o una duda…"
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

              <AnimatePresence mode="wait" initial={false}>
                {activeHelp ? (
                  <m.div
                    key={`help-${activeHelp.id}`}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 24 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="max-h-[60vh] overflow-y-auto p-4"
                  >
                    <button
                      type="button"
                      onClick={() => setActiveHelp(null)}
                      className="mb-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Volver a la búsqueda
                    </button>
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <CircleHelp className="h-4 w-4 text-primary" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">{activeHelp.title}</h3>
                        <p className="mt-0.5 text-xs text-muted-foreground">{activeHelp.summary}</p>
                      </div>
                    </div>
                    <ol className="mt-4 flex flex-col gap-2.5">
                      {activeHelp.steps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {i + 1}
                          </span>
                          <p className="text-sm leading-relaxed text-foreground/90">{step}</p>
                        </li>
                      ))}
                    </ol>
                    {activeHelp.href && (
                      <button
                        type="button"
                        onClick={() => {
                          addRecentPath(activeHelp.href);
                          router.push(activeHelp.href);
                          onClose();
                        }}
                        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/40 transition-colors hover:bg-primary/90"
                      >
                        {activeHelp.hrefLabel}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </m.div>
                ) : (
                  <m.div
                    key="results"
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
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
                        {helpItems.length > 0 && (
                          <GroupSection label="Centro de ayuda">
                            {helpItems.map((item, hi) => {
                              const flatIdx = recentItems.length + searchResults.length + hi;
                              return (
                                <PaletteItem
                                  key={`help-${visibleHelpTopics[hi].id}`}
                                  item={item}
                                  index={flatIdx}
                                  selected={flatIdx === selectedIndex}
                                  onSelect={() => executeItem(item)}
                                  showGroupBadge={false}
                                />
                              );
                            })}
                          </GroupSection>
                        )}
                      </>
                    )}
                  </m.div>
                )}
              </AnimatePresence>

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
                <span className="ml-auto hidden sm:inline">
                  Escribe una duda (ej. «cómo cierro la caja») para ver guías
                </span>
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
