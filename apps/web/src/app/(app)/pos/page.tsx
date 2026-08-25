"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Banknote,
  BarChart3,
  Loader2,
  Lock,
  Monitor,
  Receipt,
  ShoppingBag,
  Unlock,
} from "lucide-react";
import {
  useCurrentBranch,
  useCurrentBranchStation,
  useCanViewCashRegisterHistory,
} from "@/lib/store/session";
import { formatCLP, cn } from "@/lib/utils";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import {
  getCurrentCashRegister,
  getDailySummary,
  openCashRegister,
} from "@/lib/api/cash-register";
import { fetchCashRegisterStations } from "@/lib/api/cash-register-stations";
import type { CashRegisterStation } from "@/lib/api/cash-register-stations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const { data: stations = [] } = useQuery({
    queryKey: ["cash-register-stations", "pos-landing"],
    queryFn: fetchCashRegisterStations,
    staleTime: 60_000,
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
        totalSales: parseFloat(summary?.total_sales ?? "0"),
        cashSales: parseFloat(summary?.cash_sales ?? "0"),
        totalOrders: summary?.total_orders ?? 0,
        isLoading,
      });
    });
    return map;
  }, [stations, cashRegisters, dailySummaries]);

  const openTerminal = (stationId: number) => {
    window.open(
      `/pos/terminal?station_id=${stationId}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const isBusy = openingStationId !== null;

  async function handleOpen(station: CashRegisterStation) {
    if (processingRef.current || isBusy) return;
    processingRef.current = true;
    setSelectedStationId(station.id);
    setOpeningStationId(station.id);

    try {
      const register = await getCurrentCashRegister(station.id);
      if (register?.status === "OPEN") {
        queryClient.setQueryData(
          ["cash-register", "current", station.id],
          register,
        );
        openTerminal(station.id);
        return;
      }

      const amount = openingAmounts[station.id] || "0";
      const data = await openCashRegister({
        branch_id: Number(branch?.branch_id ?? 0),
        station_id: station.id,
        opening_amount: toDecimal(amount),
      });
      queryClient.invalidateQueries({ queryKey: ["cash-register", "current"] });
      queryClient.invalidateQueries({
        queryKey: ["cash-register", "current", data.station],
      });
      queryClient.invalidateQueries({
        queryKey: ["cash-register", "daily-summary"],
      });
      openTerminal(data.station ?? station.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      const msg = message.toLowerCase();
      if (
        msg.includes("abierta") ||
        msg.includes("already open") ||
        msg.includes("open cash register already exists")
      ) {
        openTerminal(station.id);
      } else {
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
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Puntos de venta
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige una estación para comenzar a vender
          </p>
        </div>

        {stations.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {stations.map((station, idx) => {
              const selected = activeStationId === station.id;
              const isOpening = openingStationId === station.id;
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
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "flex flex-col gap-4 rounded-2xl border p-5 transition-all",
                    selected
                      ? "border-primary/40 bg-gradient-to-br from-primary/10 to-card shadow-md ring-1 ring-primary/20"
                      : "border-border/60 bg-card shadow-sm hover:border-primary/30 hover:bg-muted/30 hover:shadow-md",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors",
                        selected ? "bg-primary/15" : "bg-muted",
                      )}
                    >
                      <Monitor
                        className={cn(
                          "h-5 w-5",
                          selected ? "text-primary" : "text-muted-foreground",
                        )}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold truncate">
                        {station.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {station.code}
                      </p>
                      {isOpen && register?.created && (
                        <p className="truncate whitespace-nowrap text-[10px] text-muted-foreground">
                          Abierta{" "}
                          {new Date(register.created).toLocaleString("es-CL", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        isOpen
                          ? "bg-emerald-500/10 text-emerald-700"
                          : "bg-amber-500/10 text-amber-700",
                      )}
                    >
                      {isOpen ? (
                        <Unlock className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      {isOpen ? "Abierta" : "Cerrada"}
                    </span>
                  </div>

                  {isOpen ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                        <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          <BarChart3 className="h-3 w-3" />
                          Cantidad
                        </div>
                        <p className="mt-0.5 text-base font-bold tabular-nums">
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            totalOrders
                          )}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                        <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          <ShoppingBag className="h-3 w-3" />
                          Ventas
                        </div>
                        <p className="mt-0.5 text-base font-bold tabular-nums">
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            formatCLP(totalSales)
                          )}
                        </p>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                        <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                          <Banknote className="h-3 w-3" />
                          Efectivo
                        </div>
                        <p className="mt-0.5 text-base font-bold tabular-nums">
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            formatCLP(cashSales)
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        Monto de apertura
                      </label>
                      <Input
                        value={amount ? formatCLP(parseFloat(toDecimal(amount))) : ""}
                        onChange={(e) =>
                          setOpeningAmounts((prev) => ({
                            ...prev,
                            [station.id]: numberValue(e.target.value),
                          }))
                        }
                        placeholder="0"
                        className="h-10 text-sm tabular-nums"
                      />
                    </div>
                  )}

                  <Button
                    className="w-full"
                    disabled={
                      (!isOpening && isBusy) ||
                      !branch
                    }
                    onClick={() => handleOpen(station)}
                  >
                    {isOpening ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : isOpen ? (
                      <Receipt className="mr-2 h-4 w-4" />
                    ) : (
                      <Unlock className="mr-2 h-4 w-4" />
                    )}
                    {isOpen ? "Abrir terminal" : "Abrir caja"}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <Monitor className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                No hay estaciones configuradas
              </p>
              <p className="text-xs text-muted-foreground">
                Ve a Configuración &gt; Estaciones de caja para crear una.
              </p>
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
}
