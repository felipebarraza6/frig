"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Code2,
  Search,
  ChevronRight,
  ChevronDown,
  BookOpen,
  ArrowLeft,
  Terminal,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE } from "@/lib/api/client";
import {
  FRIG_API_APPS,
  FRIG_API_CONTRACT,
  METHOD_LABEL,
  METHOD_TONE,
  absoluteEndpointUrl,
  buildRequestBodyExample,
  fetchOpenApiSchema,
  filterPathsByQuery,
  formatExampleJson,
  listOpenApiPaths,
  methodNeedsBody,
  type FrigApiAppId,
  type HttpMethod,
} from "@/lib/api/openapi";
import { cn } from "@/lib/utils";

type Drill = "areas" | "routes" | "detail";

/** Filtros de tipo de operación (el área ya viene de la columna izquierda). */
const METHOD_FILTERS: { value: HttpMethod | "__all__"; label: string }[] = [
  { value: "__all__", label: "Todos" },
  { value: "get", label: "Leer" },
  { value: "post", label: "Crear" },
  { value: "put", label: "Reemplazar" },
  { value: "patch", label: "Actualizar" },
  { value: "delete", label: "Eliminar" },
];

const panelMotion = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -6 },
};

export default function HelpApiPage() {
  const reduceMotion = useReducedMotion();
  const [app, setApp] = useState<FrigApiAppId | null>(null);
  const [query, setQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<HttpMethod | "__all__">("__all__");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [mobileDrill, setMobileDrill] = useState<Drill>("areas");
  const [selected, setSelected] = useState<{
    path: string;
    method: HttpMethod;
  } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const schemaQuery = useQuery({
    queryKey: ["openapi-schema", app ?? "none"],
    queryFn: () => fetchOpenApiSchema(app!),
    enabled: Boolean(app),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const paths = useMemo(
    () => (schemaQuery.data ? listOpenApiPaths(schemaQuery.data) : []),
    [schemaQuery.data],
  );
  const filtered = useMemo(() => filterPathsByQuery(paths, query), [paths, query]);

  // Reset de filtros al cambiar de app (ajuste durante render, sin effect).
  const [appKey, setAppKey] = useState(app);
  if (appKey !== app) {
    setAppKey(app);
    setMethodFilter("__all__");
    setSelected(null);
    setQuery("");
    if (app) setMobileDrill("routes");
  }

  const flatOps = useMemo(() => {
    const rows: { path: string; method: HttpMethod; summary?: string }[] = [];
    for (const p of filtered) {
      for (const method of Object.keys(p.methods) as HttpMethod[]) {
        if (methodFilter !== "__all__" && method !== methodFilter) continue;
        // Solo operaciones de negocio habituales en el filtro tipado.
        if (
          methodFilter === "__all__" &&
          (method === "head" || method === "options")
        ) {
          continue;
        }
        const op = p.methods[method];
        if (!op) continue;
        rows.push({ path: p.path, method, summary: op.summary });
      }
    }
    return rows;
  }, [filtered, methodFilter]);

  const methodCounts = useMemo(() => {
    const counts: Record<string, number> = { __all__: 0 };
    for (const p of filtered) {
      for (const method of Object.keys(p.methods) as HttpMethod[]) {
        if (method === "head" || method === "options") continue;
        counts.__all__ = (counts.__all__ ?? 0) + 1;
        counts[method] = (counts[method] ?? 0) + 1;
      }
    }
    return counts;
  }, [filtered]);

  const selectedOp = useMemo(() => {
    if (!selected) return null;
    const item = paths.find((p) => p.path === selected.path);
    return item?.methods[selected.method] ?? null;
  }, [paths, selected]);

  const activeApp = FRIG_API_APPS.find((a) => a.id === app);
  const motionProps = reduceMotion
    ? {}
    : {
        initial: panelMotion.initial,
        animate: panelMotion.animate,
        exit: panelMotion.exit,
        transition: { duration: 0.15, ease: "easeOut" as const },
      };

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      /* ignore */
    }
  }

  function openArea(id: FrigApiAppId) {
    setApp(id);
    setMobileDrill("routes");
  }

  function selectEndpoint(path: string, method: HttpMethod) {
    setSelected({ path, method });
    setMobileDrill("detail");
  }

  function goAreas() {
    setApp(null);
    setSelected(null);
    setMobileDrill("areas");
  }

  function goRoutes() {
    setSelected(null);
    setMobileDrill("routes");
  }

  const endpointUrl = selected ? absoluteEndpointUrl(selected.path) : "";
  const bodyExample = useMemo(() => {
    if (!selected || !selectedOp || !methodNeedsBody(selected.method)) return null;
    return buildRequestBodyExample(selectedOp, schemaQuery.data);
  }, [selected, selectedOp, schemaQuery.data]);
  const bodyJson = bodyExample != null ? formatExampleJson(bodyExample) : "";

  const curlExample = selected
    ? methodNeedsBody(selected.method) && bodyJson
      ? `curl -X ${selected.method.toUpperCase()} "${endpointUrl}" \\\n  -H "Authorization: Token <tu_token>" \\\n  -H "X-Branch-ID: <id_sucursal>" \\\n  -H "Content-Type: application/json" \\\n  -H "Accept: application/json" \\\n  -d '${bodyJson.replace(/'/g, "'\\''")}'`
      : `curl -X ${selected.method.toUpperCase()} "${endpointUrl}" \\\n  -H "Authorization: Token <tu_token>" \\\n  -H "X-Branch-ID: <id_sucursal>" \\\n  -H "Accept: application/json"`
    : "";

  return (
    <PageShell className="max-md:max-w-none">
      <PageHeader
        title="API para integrar"
        subtitle="Rutas que usa el local"
        icon={<Terminal className="h-5 w-5" />}
        className="py-2.5"
      />

      {/* Consola full-bleed: sin cards, solo paneles y divisores */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-border">
        {/* Toolbar */}
        <div className="flex shrink-0 flex-col gap-1.5 border-b border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <Terminal className="h-3.5 w-3.5 shrink-0 text-primary" />
            <button type="button" onClick={goAreas} className="hover:text-primary">
              api
            </button>
            {activeApp && (
              <>
                <ChevronRight className="h-3 w-3 opacity-40" />
                <button
                  type="button"
                  onClick={goRoutes}
                  className="truncate text-foreground hover:text-primary"
                >
                  {activeApp.label.toLowerCase()}
                </button>
              </>
            )}
            {selected && (
              <>
                <ChevronRight className="h-3 w-3 opacity-40" />
                <span className="truncate text-primary">
                  {selected.method} {selected.path}
                </span>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Copyable
              value={API_BASE}
              copied={copied === API_BASE}
              onCopy={() => copyText(API_BASE)}
              className="max-w-[min(100%,18rem)] font-mono text-[10px] text-muted-foreground"
            >
              <span className="block truncate">{API_BASE}</span>
            </Copyable>
            <span className="hidden text-border sm:inline">|</span>
            <Link
              href="/help/guides?slug=integraciones-api"
              className="inline-flex h-7 items-center gap-1 px-1.5 text-[11px] font-medium text-primary hover:underline"
            >
              <BookOpen className="h-3 w-3" />
              Guía
            </Link>
            <button
              type="button"
              onClick={() => setRulesOpen((v) => !v)}
              className={cn(
                "inline-flex h-7 items-center gap-1 px-1.5 text-[11px] font-medium",
                rulesOpen ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Reglas
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", rulesOpen && "rotate-180")}
              />
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {rulesOpen && (
            <motion.div
              initial={reduceMotion ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden border-b border-border/60"
            >
              <div className="grid gap-x-6 gap-y-3 px-3 py-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 sm:px-4">
                {Object.values(FRIG_API_CONTRACT).map((block) => (
                  <div key={block.title}>
                    <p className="text-[11px] font-semibold text-foreground">{block.title}</p>
                    <ul className="mt-1 space-y-0.5">
                      {block.lines.map((line) => (
                        <li key={line} className="text-[11px] leading-snug text-muted-foreground">
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Paneles: altura máxima, sin marcos tipo card */}
        <div
          className={cn(
            "grid min-h-0 min-w-0 flex-1",
            "lg:grid-cols-[12.5rem_minmax(0,1fr)_minmax(0,1.1fr)]",
            "h-[calc(100dvh-11.5rem)] md:h-[calc(100dvh-9.5rem)]",
          )}
        >
          {/* Áreas */}
          <aside
            className={cn(
              "min-h-0 flex-col border-border/60 lg:flex lg:border-r",
              mobileDrill === "areas" ? "flex" : "hidden lg:flex",
            )}
          >
            <div className="shrink-0 border-b border-border px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Áreas
              </p>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
              {FRIG_API_APPS.map((a) => {
                const active = app === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openArea(a.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors",
                      active
                        ? "bg-primary/10 text-foreground"
                        : "text-muted-foreground hover:bg-primary/[0.06] hover:text-foreground",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">{a.label}</span>
                      <span className="mt-0.5 block truncate text-[10px] opacity-80">
                        {a.blurb}
                      </span>
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-40" />
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Rutas */}
          <section
            className={cn(
              "min-h-0 flex-col border-border lg:flex lg:border-r",
              mobileDrill === "routes" ? "flex" : "hidden lg:flex",
            )}
          >
            {!app ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 text-center">
                <p className="text-sm font-medium">Elige un área</p>
                <p className="text-xs text-muted-foreground">
                  Ventas, inventario, usuarios…
                </p>
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5 lg:hidden">
                  <button
                    type="button"
                    onClick={goAreas}
                    className="inline-flex h-8 items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Áreas
                  </button>
                  <span className="text-xs font-semibold">{activeApp?.label}</span>
                </div>

                <div className="flex shrink-0 flex-col gap-1.5 border-b border-border px-2 py-2">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filtrar ruta…"
                      className="h-8 border-0 bg-muted/30 pl-7 text-xs shadow-none focus-visible:ring-1"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {METHOD_FILTERS.map((f) => {
                      const count =
                        f.value === "__all__"
                          ? (methodCounts.__all__ ?? 0)
                          : (methodCounts[f.value] ?? 0);
                      const active = methodFilter === f.value;
                      return (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => setMethodFilter(f.value)}
                          className={cn(
                            "inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold transition-colors",
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {f.label}
                          <span
                            className={cn(
                              "tabular-nums opacity-80",
                              active ? "text-primary-foreground/80" : "",
                            )}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={app}
                      className="absolute inset-0 overflow-y-auto overscroll-contain"
                      {...motionProps}
                    >
                      {schemaQuery.isLoading ? (
                        <div className="flex flex-col gap-px p-2">
                          {Array.from({ length: 12 }).map((_, i) => (
                            <Skeleton key={i} className="h-9 w-full rounded-none" />
                          ))}
                        </div>
                      ) : schemaQuery.isError ? (
                        <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                          <p className="text-sm font-medium">No se cargaron las rutas</p>
                          <Button size="sm" variant="outline" onClick={() => schemaQuery.refetch()}>
                            Reintentar
                          </Button>
                        </div>
                      ) : flatOps.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          Sin rutas
                        </div>
                      ) : (
                        <ul>
                          {flatOps.map((row) => {
                            const active =
                              selected?.path === row.path &&
                              selected?.method === row.method;
                            return (
                              <li
                                key={`${row.method}:${row.path}`}
                                className={cn(
                                  "border-b border-border/40",
                                  active && "bg-primary/8",
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => selectEndpoint(row.path, row.method)}
                                  className="flex w-full min-w-0 items-start gap-2 px-2.5 py-2 text-left hover:bg-muted/30"
                                >
                                  <span
                                    className={cn(
                                      "mt-0.5 w-[3.5rem] shrink-0 rounded px-1 py-px text-center text-[9px] font-semibold",
                                      METHOD_TONE[row.method],
                                    )}
                                  >
                                    {METHOD_LABEL[row.method]}
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block truncate font-mono text-[10px] text-foreground">
                                      {row.path}
                                    </span>
                                    {row.summary && (
                                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                                        {row.summary}
                                      </span>
                                    )}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                <div className="shrink-0 border-t border-border px-3 py-1 font-mono text-[10px] text-muted-foreground">
                  {activeApp?.id}
                  {schemaQuery.isSuccess ? ` · ${flatOps.length}` : ""}
                </div>
              </>
            )}
          </section>

          {/* Detalle */}
          <section
            className={cn(
              "min-h-0 flex-col lg:flex",
              mobileDrill === "detail" ? "flex" : "hidden lg:flex",
            )}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5 lg:hidden">
              <button
                type="button"
                onClick={goRoutes}
                className="inline-flex h-8 items-center gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Rutas
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                {!selected || !selectedOp ? (
                  <motion.div
                    key="empty"
                    className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-6 text-center"
                    {...motionProps}
                  >
                    <Code2 className="h-5 w-5 text-muted-foreground" />
                    <p className="text-sm font-medium">Detalle</p>
                    <p className="max-w-[14rem] text-xs text-muted-foreground">
                      {app
                        ? "Selecciona una ruta para ver endpoint, JSON y curl."
                        : "Entra a un área para empezar."}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key={`${selected.method}:${selected.path}`}
                    className="absolute inset-0 flex flex-col overflow-hidden"
                    {...motionProps}
                  >
                    <div className="shrink-0 space-y-1.5 border-b border-border px-3 py-3 sm:px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            METHOD_TONE[selected.method],
                          )}
                        >
                          {METHOD_LABEL[selected.method]}
                        </span>
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">
                          {selected.method}
                        </span>
                      </div>
                      <Copyable
                        value={`${selected.method.toUpperCase()} ${endpointUrl}`}
                        copied={
                          copied === `${selected.method.toUpperCase()} ${endpointUrl}`
                        }
                        onCopy={() =>
                          copyText(`${selected.method.toUpperCase()} ${endpointUrl}`)
                        }
                        className="block break-all text-sm font-semibold leading-snug"
                      >
                        {selected.path}
                      </Copyable>
                      <Copyable
                        value={endpointUrl}
                        copied={copied === endpointUrl}
                        onCopy={() => copyText(endpointUrl)}
                        className="block break-all font-mono text-[10px] text-muted-foreground"
                      >
                        {endpointUrl}
                      </Copyable>
                      {selectedOp.summary && (
                        <p className="text-xs text-muted-foreground">{selectedOp.summary}</p>
                      )}
                    </div>

                    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
                      {selectedOp.description && (
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {selectedOp.description.replace(/<[^>]+>/g, "").slice(0, 400)}
                        </p>
                      )}

                      {methodNeedsBody(selected.method) && (
                        <div>
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            JSON de ejemplo
                          </p>
                          <Copyable
                            value={bodyJson || "{}"}
                            copied={copied === (bodyJson || "{}")}
                            onCopy={() => copyText(bodyJson || "{}")}
                            className="glass block max-h-56 w-full overflow-auto p-3 text-left font-mono text-[11px] leading-relaxed"
                          >
                            <pre className="whitespace-pre-wrap">{bodyJson || "{\n  \n}"}</pre>
                          </Copyable>
                        </div>
                      )}

                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          curl
                        </p>
                        <Copyable
                          value={curlExample}
                          copied={copied === curlExample}
                          onCopy={() => copyText(curlExample)}
                          className="glass block w-full overflow-x-auto p-3 text-left font-mono text-[11px] leading-relaxed"
                        >
                          <pre>{curlExample}</pre>
                        </Copyable>
                      </div>

                      {selectedOp.responses && (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.keys(selectedOp.responses).map((code) => (
                            <span
                              key={code}
                              className="border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      )}

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}

/** Texto clicable para copiar: cursor pointer, color al hover, sin botón extra. */
function Copyable({
  copied,
  onCopy,
  className,
  children,
}: {
  value: string;
  copied: boolean;
  onCopy: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={copied ? "Copiado" : "Clic para copiar"}
      onClick={onCopy}
      className={cn(
        "relative cursor-pointer overflow-visible transition-colors",
        copied ? "text-success" : "hover:text-primary",
        className,
      )}
    >
      {children}
      {copied ? (
        <span className="pointer-events-none absolute right-1.5 top-1.5 z-10 rounded-md bg-background px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-success shadow-sm ring-1 ring-success/25">
          Copiado
        </span>
      ) : null}
    </button>
  );
}
