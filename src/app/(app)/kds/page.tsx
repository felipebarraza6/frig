"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Clock,
  Flame,
  Monitor,
  Palette,
  Plus,
  Settings2,
  Tv,
  Utensils,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentBranch } from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isStandalonePwa } from "@/lib/pwa";
import { fetchKitchenTickets } from "@/lib/api/kitchen";
import { fetchKitchenStations } from "@/lib/api/kitchen-stations";
import { StationsModal } from "@/components/kds/kds-board";
import { KdsStatusColorsModal } from "@/components/kds/kds-status-colors-modal";
import {
  KDS_STATUS_LABELS,
  defaultKdsStatusColorsFromTheme,
  loadKdsStatusColors,
  type KdsStatusColors,
  type KdsStatusKey,
} from "@/lib/kds-status-colors";
import type { KitchenStation } from "@/lib/api/kitchen-stations";
import { Button } from "@/components/ui/button";
import { useIsCook, useSessionStore } from "@/lib/store/session";

function openPath(path: string) {
  if (isStandalonePwa()) {
    window.location.assign(path);
    return;
  }
  window.open(path, "_blank", "noopener,noreferrer");
}

const STATUS_KEYS: KdsStatusKey[] = ["pending", "preparing", "ready"];

function StationDisplayCard({
  station,
  branchId,
  isCook,
  onEditColors,
}: {
  station: KitchenStation;
  branchId: number | null;
  isCook: boolean;
  onEditColors: () => void;
}) {
  const theme = useSessionStore((s) => s.theme ?? s.organizationTheme);
  const themePrimary =
    theme?.primary_color ?? null;
  const [colors, setColors] = useState<KdsStatusColors>(() =>
    loadKdsStatusColors(branchId, station.id, themePrimary),
  );
  const active = station.is_active !== false;
  const cats = station.categories.map((c) => c.name).join(", ");

  useEffect(() => {
    setColors(loadKdsStatusColors(branchId, station.id, themePrimary));
  }, [branchId, station.id, themePrimary]);

  useEffect(() => {
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { branchId?: string; stationId?: string; colors?: KdsStatusColors }
        | undefined;
      if (!detail?.colors || !detail.stationId) return;
      if (String(detail.stationId) !== String(station.id)) return;
      if (
        branchId != null &&
        detail.branchId &&
        String(detail.branchId) !== String(branchId)
      ) {
        return;
      }
      setColors(detail.colors);
    };
    const onStorage = (e: StorageEvent) => {
      if (!branchId || !e.key) return;
      if (e.key !== `frig.kds.statusColors.${branchId}.${station.id}`) return;
      setColors(loadKdsStatusColors(branchId, station.id, themePrimary));
    };
    const onTheme = () => {
      setColors(loadKdsStatusColors(branchId, station.id, themePrimary));
    };
    window.addEventListener("frig:kds-status-colors", onCustom);
    window.addEventListener("storage", onStorage);
    window.addEventListener("frig:theme-changed", onTheme);
    return () => {
      window.removeEventListener("frig:kds-status-colors", onCustom);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("frig:theme-changed", onTheme);
    };
  }, [branchId, station.id, themePrimary]);

  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-sm",
        active ? "border-border" : "border-border/60 opacity-70",
      )}
    >
      {/* Composición dinámica: los 3 colores de la estación */}
      <div className="flex h-2.5 w-full">
        {STATUS_KEYS.map((key) => (
          <div
            key={key}
            className="h-full flex-1"
            style={{ backgroundColor: colors[key] }}
            title={KDS_STATUS_LABELS[key]}
          />
        ))}
      </div>

      <div className="flex flex-1 flex-col justify-between p-5 pt-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
                <div className="absolute inset-0 flex">
                  {STATUS_KEYS.map((key) => (
                    <span
                      key={key}
                      className="h-full flex-1 opacity-25"
                      style={{ backgroundColor: colors[key] }}
                    />
                  ))}
                </div>
                <Monitor className="relative h-6 w-6 text-foreground" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{station.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {cats || "Sin categorías"}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                active
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {active ? "Activa" : "Inactiva"}
            </span>
          </div>

          <div className="mt-4 flex gap-1.5">
            {STATUS_KEYS.map((key) => (
              <div
                key={key}
                className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg border border-border/70 bg-background px-1.5 py-2"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: colors[key] }}
                />
                <span className="truncate text-[10px] font-medium text-muted-foreground">
                  {KDS_STATUS_LABELS[key]}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2 border-t border-border/40 pt-4">
          <Button
            type="button"
            className="w-full"
            disabled={!active}
            onClick={() => openPath(`/kds/station?id=${station.id}&mode=operate`)}
          >
            Modo estación
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={!active}
            onClick={() => openPath(`/kds/monitor?station_id=${station.id}`)}
          >
            <Tv className="mr-2 h-4 w-4" />
            Modo monitor
          </Button>
          {!isCook && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={onEditColors}
            >
              <Palette className="mr-2 h-4 w-4" />
              Colores de esta estación
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs text-muted-foreground"
            disabled={!active}
            onClick={() =>
              openPath(`/kds/terminal?station_id=${station.id}&mode=operate`)
            }
          >
            Estación en nueva ventana
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function KdsNavigationPage() {
  const branch = useCurrentBranch();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [colorsStationId, setColorsStationId] = useState<number | null>(null);
  const isCook = useIsCook();
  const theme = useSessionStore((s) => s.theme ?? s.organizationTheme);
  const themePrimary =
    theme?.primary_color ?? branch?.theme_config?.primary_color ?? null;
  const themeStatusColors = defaultKdsStatusColorsFromTheme(themePrimary);
  const branchId = branch?.branch_id
    ? Number(branch.branch_id)
    : branch?.id
      ? Number(branch.id)
      : null;

  const { data: stations = [], isLoading: stationsLoading } = useQuery({
    queryKey: ["kitchen-stations"],
    queryFn: fetchKitchenStations,
    enabled: !!branchId,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ["kitchen-tickets"],
    queryFn: () => fetchKitchenTickets(),
    refetchInterval: 10_000,
    enabled: !!branch,
  });

  const stats = useMemo(() => {
    let pending = 0;
    let preparing = 0;
    let ready = 0;
    for (const t of tickets) {
      if (t.status === "PENDING") pending += 1;
      else if (t.status === "PREPARING") preparing += 1;
      else if (t.status === "READY") ready += 1;
    }
    return { pending, preparing, ready };
  }, [tickets]);

  const activeStations = stations.filter((s) => s.is_active !== false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-5xl"
      >
        <div className="mb-8 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              KDS
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Navegación
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {branch
                ? `${branchName(branch)} · Pantallas virtuales de cocina`
                : "Sin sucursal seleccionada"}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {!isCook && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setColorsStationId(stations[0]?.id ?? null);
                  setColorsOpen(true);
                }}
              >
                <Palette className="mr-2 h-4 w-4" />
                Colores por estación
              </Button>
            )}
            {!isCook && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsConfigOpen(true)}
              >
                <Settings2 className="mr-2 h-4 w-4" />
                Estaciones
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => openPath("/kds/monitor")}
            >
              <Tv className="mr-2 h-4 w-4" />
              Monitor LED
            </Button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(
            [
              {
                key: "pending" as const,
                label: "Pendientes",
                sub: "Por iniciar",
                value: stats.pending,
                Icon: Clock,
              },
              {
                key: "preparing" as const,
                label: "En preparación",
                sub: "Activas ahora",
                value: stats.preparing,
                Icon: Flame,
              },
              {
                key: "ready" as const,
                label: "Listos",
                sub: "Por entregar",
                value: stats.ready,
                Icon: Utensils,
              },
            ] as const
          ).map((card) => (
            <div
              key={card.key}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div
                className="mb-2 flex items-center gap-2 text-xs font-medium"
                style={{ color: themeStatusColors[card.key] }}
              >
                <card.Icon className="h-3.5 w-3.5" />
                {card.label}
              </div>
              <p className="text-2xl font-semibold tabular-nums">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </div>
          ))}
        </div>
        <p className="mb-6 text-center text-[11px] text-muted-foreground">
          Colores siempre por estación. Por defecto se adaptan al theme; puedes
          personalizarlos en cada tarjeta.
        </p>

        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Estaciones</h2>
            <p className="text-xs text-muted-foreground">
              Abre una pantalla operable para el personal de cocina
            </p>
          </div>
          {!isCook && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsConfigOpen(true)}
            >
              {stations.length === 0 ? (
                <>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Crear
                </>
              ) : (
                <>
                  <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                  Administrar
                </>
              )}
            </Button>
          )}
        </div>

        {stationsLoading ? (
          <div className="flex flex-wrap justify-center gap-6">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-44 w-full max-w-sm animate-pulse rounded-2xl border border-border bg-muted/40"
              />
            ))}
          </div>
        ) : stations.length === 0 ? (
          isCook ? (
            <div className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-12 text-center">
              <Monitor className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">Aún no hay estaciones</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Pide a un administrador que configure las estaciones de cocina.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsConfigOpen(true)}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-12 text-center transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <Monitor className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">Aún no hay estaciones</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Crea estaciones (cocina caliente, barra, pastelería…) y asígnales
                categorías de productos.
              </p>
            </button>
          )
        ) : (
          <div className="flex flex-wrap justify-center gap-6">
            {stations.map((station) => (
              <StationDisplayCard
                key={station.id}
                station={station}
                branchId={branchId}
                isCook={isCook}
                onEditColors={() => {
                  setColorsStationId(station.id);
                  setColorsOpen(true);
                }}
              />
            ))}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-border bg-background p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Monitor general</p>
              <p className="text-xs text-muted-foreground">
                LED de toda la cocina. Cada estación también tiene su propio
                modo monitor en la tarjeta de arriba.
              </p>
            </div>
            <Button type="button" onClick={() => openPath("/kds/monitor")}>
              <Tv className="mr-2 h-4 w-4" />
              Abrir monitor general
            </Button>
          </div>
          {activeStations.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {activeStations.length} estación
              {activeStations.length === 1 ? "" : "es"} activa
              {activeStations.length === 1 ? "" : "s"} · {stats.pending + stats.preparing + stats.ready}{" "}
              comandas en cola
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Las pantallas se abren sin el menú lateral, listas para dejar fijas en
          monitores de cocina.
        </p>
      </motion.div>

      {isConfigOpen && (
        <StationsModal
          branchId={branchId}
          stations={stations}
          onClose={() => setIsConfigOpen(false)}
        />
      )}

      <KdsStatusColorsModal
        open={colorsOpen}
        initialStationId={colorsStationId}
        onClose={() => {
          setColorsOpen(false);
          setColorsStationId(null);
        }}
      />
    </div>
  );
}
