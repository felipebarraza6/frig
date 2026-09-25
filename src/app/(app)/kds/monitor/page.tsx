"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChefHat, Clock, ClipboardList, Settings2, Utensils, X } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useCurrentBranch } from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { fetchKitchenTickets, type KitchenTicket } from "@/lib/api/kitchen";
import { fetchKitchenStations } from "@/lib/api/kitchen-stations";
import {
  kitchenTicketCode,
  kitchenTicketMeta,
  ticketTimingSummary,
} from "@/lib/kds-display";
import { useNow } from "@/lib/hooks/useNow";
import { useKdsStatusColors } from "@/lib/hooks/useKdsStatusColors";
import {
  kdsHexAlpha,
  kdsReadableForeground,
  type KdsStatusKey,
} from "@/lib/kds-status-colors";
import { cn } from "@/lib/utils";

type ActiveStatus = "PENDING" | "PREPARING" | "READY";

const STATUS_TO_KEY: Record<ActiveStatus, KdsStatusKey> = {
  PENDING: "pending",
  PREPARING: "preparing",
  READY: "ready",
};

const CLOCK_STORAGE_KEY = "frig.kds.monitor.clock";

type ClockConfig = {
  /** true = 24h (14:05), false = 12h (2:05 p. m.) */
  hour24: boolean;
  showSeconds: boolean;
};

const DEFAULT_CLOCK: ClockConfig = { hour24: true, showSeconds: true };

function loadClockConfig(): ClockConfig {
  if (typeof window === "undefined") return DEFAULT_CLOCK;
  try {
    const raw = window.localStorage.getItem(CLOCK_STORAGE_KEY);
    if (!raw) return DEFAULT_CLOCK;
    const parsed = JSON.parse(raw) as Partial<ClockConfig>;
    return {
      hour24: parsed.hour24 ?? DEFAULT_CLOCK.hour24,
      showSeconds: parsed.showSeconds ?? DEFAULT_CLOCK.showSeconds,
    };
  } catch {
    return DEFAULT_CLOCK;
  }
}

function formatMonitorClock(now: Date, config: ClockConfig): string {
  return now.toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    second: config.showSeconds ? "2-digit" : undefined,
    hour12: !config.hour24,
  });
}

const COLUMNS: {
  key: ActiveStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "PENDING", label: "Pendientes", icon: Clock },
  { key: "PREPARING", label: "En preparación", icon: ChefHat },
  { key: "READY", label: "Listos", icon: Utensils },
];

function MonitorTicketCard({
  ticket,
  color,
  featured,
}: {
  ticket: KitchenTicket;
  color: string;
  featured?: boolean;
}) {
  const meta = kitchenTicketMeta(ticket);
  const live =
    ticket.status === "PENDING" || ticket.status === "PREPARING";
  const now = useNow(1000, live);
  const timing = ticketTimingSummary(ticket, now);
  const fg = kdsReadableForeground(color);

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 shadow-sm transition-shadow",
        featured && "ring-2 ring-primary/50 shadow-lg",
      )}
      style={{
        backgroundColor: kdsHexAlpha(color, 0.18),
        borderColor: kdsHexAlpha(color, 0.55),
        color: fg === "#ffffff" ? "var(--foreground)" : fg,
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-bold tracking-tight tabular-nums">
            {kitchenTicketCode(ticket)}
          </p>
          {meta && <p className="text-xs opacity-70">{meta}</p>}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums opacity-90">{timing.primary}</p>
          {timing.secondary ? (
            <p className="text-[11px] tabular-nums opacity-55">{timing.secondary}</p>
          ) : null}
        </div>
      </div>
      {ticket.notes ? (
        <p
          className="mb-2 rounded-lg px-2 py-1 text-xs"
          style={{ backgroundColor: kdsHexAlpha(color, 0.25) }}
        >
          {ticket.notes}
        </p>
      ) : null}
      <ul className="flex flex-col gap-1.5">
        {ticket.items.map((item) => (
          <li
            key={item.id}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span className="font-medium leading-snug">{item.product_name}</span>
            <span className="shrink-0 text-lg font-bold tabular-nums opacity-90">
              ×{item.quantity ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ticketVisibleForStation(ticket: KitchenTicket, stationId: number | null) {
  if (!stationId) return true;
  return ticket.items.some((item) => item.station === stationId);
}

function filterTicketItems(ticket: KitchenTicket, stationId: number | null): KitchenTicket {
  if (!stationId) return ticket;
  return {
    ...ticket,
    items: ticket.items.filter((item) => item.station === stationId),
  };
}

function KdsMonitorInner() {
  const branch = useCurrentBranch();
  const searchParams = useSearchParams();
  const stationId = useMemo(() => {
    const raw = searchParams.get("station_id") ?? searchParams.get("id");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  const { colors } = useKdsStatusColors(stationId);
  const [now, setNow] = useState(() => new Date());
  const [clockConfig, setClockConfig] = useState<ClockConfig>(DEFAULT_CLOCK);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setClockConfig(loadClockConfig());
  }, []);

  useEffect(() => {
    // 1s: reloj + timers de prep en vivo (PENDING/PREPARING).
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const patchClock = (patch: Partial<ClockConfig>) => {
    setClockConfig((prev) => {
      const next = { ...prev, ...patch };
      try {
        window.localStorage.setItem(CLOCK_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  };

  const { data: stations = [] } = useQuery({
    queryKey: ["kitchen-stations"],
    queryFn: fetchKitchenStations,
    enabled: !!branch && stationId != null,
  });
  const station = stations.find((s) => s.id === stationId) ?? null;

  const { data: ticketsRaw = [] } = useQuery({
    queryKey: ["kitchen-tickets", stationId],
    queryFn: () => fetchKitchenTickets(undefined, stationId),
    refetchInterval: 5_000,
    enabled: !!branch,
  });

  const tickets = useMemo(
    () =>
      ticketsRaw
        .filter((t) => ticketVisibleForStation(t, stationId))
        .map((t) => filterTicketItems(t, stationId)),
    [ticketsRaw, stationId],
  );

  const byStatus = useMemo(() => {
    const map: Record<ActiveStatus, KitchenTicket[]> = {
      PENDING: [],
      PREPARING: [],
      READY: [],
    };
    const sorted = [...tickets].sort(
      (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
    );
    for (const t of sorted) {
      if (t.status === "PENDING" || t.status === "PREPARING" || t.status === "READY") {
        if (t.items.length === 0 && stationId) continue;
        map[t.status].push(t);
      }
    }
    return map;
  }, [tickets, stationId]);

  const currentTicket = useMemo(() => {
    if (byStatus.PREPARING.length > 0) return byStatus.PREPARING[0];
    if (byStatus.PENDING.length > 0) return byStatus.PENDING[0];
    if (byStatus.READY.length > 0) return byStatus.READY[0];
    return null;
  }, [byStatus]);

  const clock = formatMonitorClock(now, clockConfig);

  const logoSrc = branch?.logo ?? branch?.theme_config?.logo ?? null;

  const currentStatusKey =
    currentTicket?.status && currentTicket.status in STATUS_TO_KEY
      ? STATUS_TO_KEY[currentTicket.status as ActiveStatus]
      : null;
  const currentColor = currentStatusKey ? colors[currentStatusKey] : colors.preparing;

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="relative flex shrink-0 items-center justify-between gap-4 border-b border-border bg-primary px-5 py-4 text-primary-foreground sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo
            src={logoSrc}
            name={branch ? branchName(branch) : "FRIG"}
            containerClassName="h-12 w-12 rounded-xl bg-primary-foreground/15"
            className="h-full w-full p-1"
          />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
              KDS · Monitor{station ? ` · ${station.name}` : " general"}
            </p>
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
              {station?.name || (branch ? branchName(branch) : "Sin sucursal")}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums tracking-tight sm:text-4xl" aria-live="off">
              {clock}
            </p>
            <p className="text-xs opacity-70">
              {clockConfig.hour24 ? "24 h" : "12 h"}
              {clockConfig.showSeconds ? " · con segundos" : ""}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground"
            onClick={() => setSettingsOpen((o) => !o)}
            title="Configurar reloj"
            aria-expanded={settingsOpen}
            aria-label="Configurar reloj"
          >
            <Settings2 className="h-5 w-5" />
          </Button>
        </div>

        {settingsOpen && (
          <div
            className="absolute right-4 top-full z-20 mt-2 w-72 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl sm:right-8"
            role="dialog"
            aria-label="Configuración del reloj"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Reloj</p>
              <button
                type="button"
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => setSettingsOpen(false)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Formato</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => patchClock({ hour24: true })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      clockConfig.hour24
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    24 horas
                  </button>
                  <button
                    type="button"
                    onClick={() => patchClock({ hour24: false })}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      !clockConfig.hour24
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:bg-muted",
                    )}
                  >
                    12 horas
                  </button>
                </div>
              </div>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                <span className="text-sm font-medium">Mostrar segundos</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={clockConfig.showSeconds}
                  onChange={(e) => patchClock({ showSeconds: e.target.checked })}
                />
              </label>
              <p className="text-[11px] text-muted-foreground">
                Vista previa: {formatMonitorClock(now, clockConfig)}
              </p>
            </div>
          </div>
        )}
      </header>

      {currentTicket && (
        <section
          className="shrink-0 border-b border-border px-5 py-4 sm:px-8"
          style={{ backgroundColor: kdsHexAlpha(currentColor, 0.12) }}
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Orden actual
            </p>
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{
                backgroundColor: currentColor,
                color: kdsReadableForeground(currentColor),
              }}
            >
              {currentTicket.status === "PENDING"
                ? "Pendiente"
                : currentTicket.status === "PREPARING"
                  ? "En preparación"
                  : "Listo"}
            </span>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
                {kitchenTicketCode(currentTicket)}
              </p>
              {(() => {
                const t = ticketTimingSummary(currentTicket, now.getTime());
                return (
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    {t.primary}
                    {t.secondary ? (
                      <span className="ml-2 font-normal text-muted-foreground">
                        · {t.secondary}
                      </span>
                    ) : null}
                  </p>
                );
              })()}
              {kitchenTicketMeta(currentTicket) && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {kitchenTicketMeta(currentTicket)}
                </p>
              )}
              {currentTicket.notes && (
                <p className="mt-2 text-sm text-warning">{currentTicket.notes}</p>
              )}
            </div>
            <ul className="grid gap-1 sm:grid-cols-2 lg:min-w-[20rem]">
              {currentTicket.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-baseline justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  <span className="font-medium">{item.product_name}</span>
                  <span className="text-lg font-bold tabular-nums">
                    ×{item.quantity ?? 0}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="grid min-h-0 flex-1 gap-3 p-3 sm:p-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const Icon = col.icon;
          const list = byStatus[col.key];
          const color = colors[STATUS_TO_KEY[col.key]];
          return (
            <section
              key={col.key}
              className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div
                className="flex items-center gap-2 px-4 py-3 text-sm font-semibold"
                style={{
                  backgroundColor: color,
                  color: kdsReadableForeground(color),
                }}
              >
                <Icon className="h-4 w-4" />
                <span>{col.label}</span>
                <span className="ml-auto rounded-full bg-black/20 px-2 py-0.5 text-xs tabular-nums">
                  {list.length}
                </span>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
                {list.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                    <ClipboardList className="h-8 w-8" />
                    <p className="text-sm font-medium">Sin comandas</p>
                  </div>
                ) : (
                  list.map((ticket) => (
                    <MonitorTicketCard
                      key={ticket.id}
                      ticket={ticket}
                      color={color}
                      featured={currentTicket?.id === ticket.id}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function KdsMonitorPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-screen place-items-center text-sm text-muted-foreground">
          Cargando monitor…
        </div>
      }
    >
      <KdsMonitorInner />
    </Suspense>
  );
}
