"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ChefHat,
  Clock,
  Flame,
  LayoutDashboard,
  RotateCcw,
  Settings2,
  ShoppingBag,
  Utensils,
  Monitor,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentBranch } from "@/lib/store/session";
import { branchName } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetchKitchenTickets } from "@/lib/api/kitchen";
import { fetchKitchenStations } from "@/lib/api/kitchen-stations";
import { StationsModal } from "@/components/kds/kds-board";

export default function KdsZenPage() {
  const branch = useCurrentBranch();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<number | null>(null);
  const branchId = branch?.id ? Number(branch.id) : null;

  const { data: stations = [] } = useQuery({
    queryKey: ["kitchen-stations"],
    queryFn: fetchKitchenStations,
    enabled: !!branchId,
  });

  const { data: pendingTickets = [] } = useQuery({
    queryKey: ["kitchen-tickets", "PENDING"],
    queryFn: () => fetchKitchenTickets("PENDING"),
    refetchInterval: 10_000,
    enabled: !!branch,
  });

  const { data: preparingTickets = [] } = useQuery({
    queryKey: ["kitchen-tickets", "PREPARING"],
    queryFn: () => fetchKitchenTickets("PREPARING"),
    refetchInterval: 10_000,
    enabled: !!branch,
  });

  const { data: readyTickets = [] } = useQuery({
    queryKey: ["kitchen-tickets", "READY"],
    queryFn: () => fetchKitchenTickets("READY"),
    refetchInterval: 10_000,
    enabled: !!branch,
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-3xl"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <ChefHat className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Cocina</h1>
          <p className="text-sm text-muted-foreground">
            {branch ? `Sucursal: ${branchName(branch)}` : "Sin sucursal seleccionada"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Settings2 className="h-3.5 w-3.5" />
              Estaciones
            </div>
            <p className="text-lg font-semibold tabular-nums">{stations.length}</p>
            <p className="text-xs text-muted-foreground">
              {stations.length === 1 ? "activa" : "activas"}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Pendientes
            </div>
            <p className="text-lg font-semibold tabular-nums">{pendingTickets.length}</p>
            <p className="text-xs text-muted-foreground">Comandas por iniciar</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Flame className="h-3.5 w-3.5" />
              En preparación
            </div>
            <p className="text-lg font-semibold tabular-nums">{preparingTickets.length}</p>
            <p className="text-xs text-muted-foreground">Comandas activas</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Utensils className="h-3.5 w-3.5" />
              Listos
            </div>
            <p className="text-lg font-semibold tabular-nums">{readyTickets.length}</p>
            <p className="text-xs text-muted-foreground">Por entregar</p>
          </div>
        </div>

        {stations.length > 0 && (
          <div className="mt-6">
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Selecciona una estación para el terminal KDS
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {stations.map((station) => (
                <button
                  key={station.id}
                  type="button"
                  onClick={() => setSelectedStationId(station.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                    selectedStationId === station.id
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  <Monitor className="h-4 w-4" />
                  {station.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/kds/monitor"
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-8 py-5 text-lg font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] hover:shadow-xl sm:w-auto"
            >
              <ChefHat className="h-6 w-6" />
              Abrir cocina
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href={selectedStationId ? `/kds/terminal?station_id=${selectedStationId}` : "/kds/terminal"}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex w-full items-center justify-center gap-3 rounded-xl border-2 border-primary bg-transparent px-8 py-5 text-lg font-semibold text-primary shadow-lg transition-transform hover:scale-[1.02] hover:shadow-xl sm:w-auto"
            >
              <RotateCcw className="h-6 w-6" />
              {selectedStationId
                ? `Abrir ${stations.find((s) => s.id === selectedStationId)?.name ?? "KDS"}`
                : "Abrir terminal KDS"}
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <p className="max-w-sm text-center text-xs text-muted-foreground">
            Se abrirán en nuevas pestañas sin menú lateral, listas para dejar abiertas en los monitores de cocina.
          </p>
        </div>

        <div className="mt-8 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => setIsConfigOpen(true)}
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Configurar estaciones
          </button>
          <Link
            href="/sales"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            Ver ventas
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </div>
      </motion.div>

      {isConfigOpen && (
        <StationsModal
          branchId={branchId}
          stations={stations}
          onClose={() => setIsConfigOpen(false)}
        />
      )}
    </div>
  );
}
