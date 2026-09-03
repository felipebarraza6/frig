"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Banknote,
  BarChart3,
  Clock,
  Coins,
  Lock,
  Monitor,
  Pencil,
  Plus,
  Power,
  Receipt,
  ShoppingBag,
  Unlock,
} from "lucide-react";
import {
  useCurrentBranch,
  useCurrentBranchStation,
  useCanViewCashRegisterHistory,
  useIsOwner,
  useIsAdminLocal,
} from "@/lib/store/session";
import { formatCLP, cn } from "@/lib/utils";
import { PosConfigModal } from "@/components/pos/pos-config-modal";
import { Settings2 } from "lucide-react";
import { statusBadge } from "@/lib/status-styles";
import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCurrentCashRegister,
  getDailySummary,
  openCashRegister,
} from "@/lib/api/cash-register";
import {
  fetchCashRegisterStations,
  updateCashRegisterStation,
} from "@/lib/api/cash-register-stations";
import type { CashRegisterStation } from "@/lib/api/cash-register-stations";
import { StationFormModal } from "@/components/pos/station-form-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import { useToast } from "@/lib/store/toast";

function numberValue(v: string): string {
  const cleaned = v.replace(/[^0-9]/g, "");
  return cleaned ? (parseInt(cleaned, 10) || 0).toString() : "";
}

function toDecimal(v: string): string {
  return (parseInt(v || "0", 10) || 0).toFixed(2);
}

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function PosZenPage() {
  const branch = useCurrentBranch();
  const userStation = useCurrentBranchStation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = todayIso();
  const [selectedStationId, setSelectedStationId] = useState<number | null>(
    userStation?.station_id ? Number(userStation.station_id) : null,
  );
  const [openingStationId, setOpeningStationId] = useState<number | null>(null);
  const [openingAmounts, setOpeningAmounts] = useState<Record<number, string>>({});
  const processingRef = useRef(false);
  const [configStationId, setConfigStationId] = useState<number | null>(null);
  // Modal crear/editar estación (misma experiencia que Métodos de pago).
  const [stationModal, setStationModal] = useState<{
    open: boolean;
    station: CashRegisterStation | null;
  }>({ open: false, station: null });
  const isOwner = useIsOwner();
  const isAdminLocal = useIsAdminLocal();
  const canConfigurePos = isOwner || isAdminLocal;

  const {
    data: stations = [],
    isLoading: stationsLoading,
    error: stationsError,
  } = useQuery({
    queryKey: ["cash-register-stations", "pos-landing"],
    queryFn: fetchCashRegisterStations,
    staleTime: 60_000,
  });

  // Activar / desactivar estación sin abrir el modal (como el toggle de medios de pago).
  const toggleStation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateCashRegisterStation(id, { is_active }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["cash-register-stations"] });
      toast.success(vars.is_active ? "Estación activada" : "Estación desactivada");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado");
    },
  });

  const activeStationId =
    selectedStationId ??
    (userStation?.station_id ? Number(userStation.station_id) : null) ??
    stations[0]?.id ??
    null;

  const canViewHistory = useCanViewCashRegisterHistory();

  const stationIds = useMemo(() => stations.map((s) => s.id), [stations]);

  const dailySummaries = useQueries({
    queries: stationIds.map((id) => ({
      queryKey: ["cash-register", "daily-summary", id, today, "pos"],
      queryFn: () => getDailySummary(id),
      enabled: !!id && canViewHistory,
      staleTime: 30_000,
      retry: false,
    })),
  });

  const cashRegisters = useQueries({
    queries: stationIds.map((id) => ({
      queryKey: ["cash-register", "current", id],
      queryFn: () => getCurrentCashRegister(id),
      enabled: !!id,
      staleTime: 30_000,
      retry: false,
    })),
  });

  const stationState = useMemo(() => {
    const map = new Map<
      number,
      { isOpen: boolean; totalSales: number; cashSales: number; totalOrders: number; isLoading: boolean }
    >();
    stations.forEach((station, idx) => {
      const register = cashRegisters[idx]?.data;
      const summary = dailySummaries[idx]?.data;
      const isLoading =
        cashRegisters[idx]?.isLoading || dailySummaries[idx]?.isLoading;
      map.set(station.id, {
        isOpen: register?.status === "OPEN",
        totalSales: summary?.total_sales ?? 0,
        cashSales: summary?.cash_sales ?? 0,
        totalOrders: summary?.total_orders ?? 0,
        isLoading,
      });
    });
    return map;
  }, [stations, cashRegisters, dailySummaries]);

  const openTerminal = (stationId: number, win?: Window | null) => {
    const url = `/pos/terminal?station_id=${stationId}`;
    if (win) {
      // Ventana capturada en el click (antes de los await) para que iOS/Android
      // no bloqueen el popup; aquí solo la navegamos al terminal.
      win.location.href = url;
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const isBusy = openingStationId !== null;

  async function handleOpen(station: CashRegisterStation) {
    if (processingRef.current || isBusy) return;
    if (station.is_active === false) {
      toast.error("La estación está desactivada. Actívala para vender.");
      return;
    }
    processingRef.current = true;
    setSelectedStationId(station.id);
    setOpeningStationId(station.id);

    // window.open debe ejecutarse en el gesto del usuario; tras un await los
    // navegadores móviles lo bloquean. Sin "noopener" para conservar el handle.
    const win = window.open("", "_blank");

    try {
      const register = await getCurrentCashRegister(station.id);
      if (register?.status === "OPEN") {
        queryClient.setQueryData(
          ["cash-register", "current", station.id],
          register,
        );
        openTerminal(station.id, win);
        return;
      }

      const amount = openingAmounts[station.id] || "0";
      const data = await openCashRegister({
        branch_id: Number(branch?.branch_id ?? 0),
        station_id: station.id,
        opening_amount: parseFloat(toDecimal(amount)),
      });
      queryClient.invalidateQueries({ queryKey: ["cash-register", "current"] });
      queryClient.invalidateQueries({
        queryKey: ["cash-register", "current", data.station],
      });
      queryClient.invalidateQueries({
        queryKey: ["cash-register", "daily-summary"],
      });
      openTerminal(data.station ?? station.id, win);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      const msg = message.toLowerCase();
      if (
        msg.includes("abierta") ||
        msg.includes("already open") ||
        msg.includes("open cash register already exists")
      ) {
        openTerminal(station.id, win);
      } else {
        // No vamos a navegar: cerramos la pestaña en blanco que pre-abrimos.
        win?.close();
        toast.error(message || "No se pudo abrir la caja");
      }
    } finally {
      setOpeningStationId(null);
      processingRef.current = false;
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-5xl"
      >
        <div className="mb-8 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Puntos de venta
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Elige una estación para comenzar a vender
            </p>
          </div>
          {canConfigurePos && (
            <Button
              size="sm"
              onClick={() => setStationModal({ open: true, station: null })}
            >
              <Plus className="mr-2 h-4 w-4" />
              Nueva estación
            </Button>
          )}
        </div>

        {stationsLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex flex-col justify-between rounded-2xl border border-border bg-muted/30 p-5 shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <div className="mt-4 border-t border-border/50 pt-4">
                    <Skeleton className="h-16 w-full rounded-xl" />
                  </div>
                </div>
                <div className="mt-5 pt-3 border-t border-border/40">
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : stationsError ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-danger/30 bg-muted/30 p-10 text-center">
            <Monitor className="h-10 w-10 text-danger/80" />
            <div>
              <p className="text-sm font-medium">
                No se pudieron cargar las estaciones
              </p>
              <p className="text-xs text-muted-foreground">
                Revisa tu conexión e intenta nuevamente.
              </p>
            </div>
          </div>
        ) : stations.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((station, idx) => {
              const selected = activeStationId === station.id;
              const isOpening = openingStationId === station.id;
              const stationActive = station.is_active !== false;
              const state = stationState.get(station.id);
              const register = cashRegisters[idx]?.data;
              const isOpen = state?.isOpen ?? false;
              const totalSales = state?.totalSales ?? 0;
              const cashSales = state?.cashSales ?? 0;
              const totalOrders = state?.totalOrders ?? 0;
              const isLoading = state?.isLoading ?? false;
              const amount = openingAmounts[station.id] ?? "";

              return (
                <motion.div
                  key={station.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "flex flex-col justify-between rounded-2xl border border-border bg-muted/30 p-5 transition-all shadow-sm hover:shadow-md",
                    selected
                      ? "border-primary/50 bg-gradient-to-b from-primary/5 to-card ring-2 ring-primary/20 shadow-md"
                      : "border-border hover:border-primary/40",
                    !stationActive && "opacity-60",
                  )}
                >
                  {/* Header y cuerpo */}
                  <div>
                    {/* Top: Icono + Título + Badge de estado */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={cn(
                            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors shadow-xs",
                            isOpen || selected
                              ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <Monitor className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="text-base font-bold text-foreground truncate leading-snug">
                            {station.name}
                          </h2>
                          <p className="text-xs text-muted-foreground font-medium truncate">
                            {station.code || "Punto de venta"}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-start gap-2">
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold shadow-xs",
                            !stationActive
                              ? "border-border bg-muted text-muted-foreground"
                              : statusBadge(isOpen ? "OPEN" : "CLOSED"),
                          )}
                        >
                          {!stationActive ? (
                            <>
                              <Power className="h-3.5 w-3.5" />
                              Inactiva
                            </>
                          ) : isOpen ? (
                            <>
                              <Unlock className="h-3.5 w-3.5" />
                              Abierta
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5" />
                              Cerrada
                            </>
                          )}
                        </span>
                        {canConfigurePos && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setStationModal({ open: true, station })
                              }
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Editar estación ${station.name}`}
                              title="Editar estación"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                toggleStation.mutate({
                                  id: station.id,
                                  is_active: !stationActive,
                                })
                              }
                              disabled={toggleStation.isPending}
                              className={cn(
                                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                stationActive
                                  ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                                  : "text-primary hover:bg-primary/10",
                              )}
                              aria-label={
                                stationActive
                                  ? `Desactivar estación ${station.name}`
                                  : `Activar estación ${station.name}`
                              }
                              title={stationActive ? "Desactivar" : "Activar"}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfigStationId(station.id)}
                              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              aria-label={`Configurar estación ${station.name}`}
                              title="Configurar estación"
                            >
                              <Settings2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Subtexto de turno */}
                    {isOpen && register?.created ? (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>
                          Abierta hoy a las{" "}
                          {new Date(register.created).toLocaleTimeString("es-CL", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        La caja está cerrada. Define el monto inicial para abrir turno.
                      </p>
                    )}

                    {/* Cuerpo: Métricas o Formulario de apertura */}
                    <div className="mt-4 border-t border-border pt-4">
                      {isOpen ? (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col rounded-2xl border border-border bg-muted/30 p-2.5 text-center">
                            <span className="text-[11px] font-medium text-muted-foreground flex items-center justify-center gap-1">
                              <BarChart3 className="h-3 w-3" />
                              Órdenes
                            </span>
                            <span className="mt-1 text-sm font-bold text-foreground tabular-nums">
                              {isLoading ? <SkeletonText width="60%" height="sm" className="mx-auto" /> : totalOrders}
                            </span>
                          </div>

                          <div className="flex flex-col rounded-2xl border border-border bg-muted/30 p-2.5 text-center">
                            <span className="text-[11px] font-medium text-muted-foreground flex items-center justify-center gap-1">
                              <ShoppingBag className="h-3 w-3" />
                              Ventas
                            </span>
                            <span className="mt-1 text-sm font-bold text-primary tabular-nums truncate">
                              {isLoading ? <SkeletonText width="60%" height="sm" className="mx-auto" /> : formatCLP(totalSales)}
                            </span>
                          </div>

                          <div className="flex flex-col rounded-2xl border border-border bg-muted/30 p-2.5 text-center">
                            <span className="text-[11px] font-medium text-muted-foreground flex items-center justify-center gap-1">
                              <Banknote className="h-3 w-3" />
                              Efectivo
                            </span>
                            <span className="mt-1 text-sm font-bold text-foreground tabular-nums truncate">
                              {isLoading ? <SkeletonText width="60%" height="sm" className="mx-auto" /> : formatCLP(cashSales)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <label
                              htmlFor={`opening-${station.id}`}
                              className="text-xs font-semibold text-foreground flex items-center gap-1"
                            >
                              <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                              Monto inicial de apertura
                            </label>
                            <span className="text-[11px] text-muted-foreground">Efectivo en caja</span>
                          </div>

                          <Input
                            id={`opening-${station.id}`}
                            value={amount ? formatCLP(parseFloat(toDecimal(amount))) : ""}
                            onChange={(e) =>
                              setOpeningAmounts((prev) => ({
                                ...prev,
                                [station.id]: numberValue(e.target.value),
                              }))
                            }
                            placeholder="$0"
                            className="h-11 w-full rounded-xl text-base font-semibold tabular-nums text-foreground bg-background"
                          />

                          {/* Accesos rápidos de monto sugerido */}
                          <div className="flex items-center gap-1.5">
                            {[0, 20000, 50000].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() =>
                                  setOpeningAmounts((prev) => ({
                                    ...prev,
                                    [station.id]: String(preset),
                                  }))
                                }
                                className={cn(
                                  "flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors touch-manipulation active:scale-[0.97]",
                                  amount === String(preset) || (!amount && preset === 0)
                                    ? "border-primary/50 bg-primary/10 text-primary font-semibold shadow-xs"
                                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                              >
                                {preset === 0 ? "$0" : formatCLP(preset)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Botón de acción al fondo de la tarjeta */}
                  <div className="mt-5 pt-3 border-t border-border">
                    <Button
                      size="lg"
                      variant="default"
                      className="w-full h-11 rounded-xl text-sm font-semibold shadow-sm transition-all touch-manipulation active:scale-[0.98]"
                      disabled={(!isOpening && isBusy) || !branch || !stationActive}
                      isLoading={isOpening}
                      onClick={() => handleOpen(station)}
                    >
                      {isOpening ? (
                        isOpen ? "Cargando punto de venta..." : "Abriendo caja..."
                      ) : !stationActive ? (
                        "Estación desactivada"
                      ) : isOpen ? (
                        <>
                          <Receipt className="mr-2 h-4 w-4" />
                          Abrir terminal de venta
                        </>
                      ) : (
                        <>
                          <Unlock className="mr-2 h-4 w-4" />
                          Abrir caja e iniciar turno
                        </>
                      )}
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <Monitor className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                No hay estaciones configuradas
              </p>
              <p className="text-xs text-muted-foreground">
                Crea tu primera estación para comenzar a vender.
              </p>
            </div>
            {canConfigurePos && (
              <Button
                size="sm"
                onClick={() => setStationModal({ open: true, station: null })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear primera estación
              </Button>
            )}
          </div>
        )}

        <StationFormModal
          open={stationModal.open}
          onClose={() => setStationModal({ open: false, station: null })}
          station={stationModal.station}
        />

        <PosConfigModal
          open={configStationId !== null}
          onClose={() => setConfigStationId(null)}
          stationId={configStationId}
        />
      </motion.div>
    </div>
  );
}
