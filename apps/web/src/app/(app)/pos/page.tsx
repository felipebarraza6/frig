"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Receipt,
  ShoppingBag,
  Clock,
  Banknote,
  RotateCcw,
  LayoutDashboard,
  Monitor,
  UserRound,
} from "lucide-react";
import { useCurrentBranch, useCurrentBranchStation, useIsOwner, useIsAdminLocal, useIsSuperAdmin } from "@/lib/store/session";
import { useIsModuleEnabled } from "@/lib/hooks/useBranchModules";
import { branchName } from "@/lib/types";
import { formatCLP, cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { fetchOrders } from "@/lib/api/orders";
import { getCurrentCashRegister } from "@/lib/api/cash-register";
import { fetchCashRegisterStations } from "@/lib/api/cash-register-stations";
import { useState } from "react";

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
  const isOwner = useIsOwner();
  const isAdminLocal = useIsAdminLocal();
  const isSuperAdmin = useIsSuperAdmin();
  const tablesEnabled = useIsModuleEnabled("tables");
  const canSimulateWaiter = (isOwner || isAdminLocal || isSuperAdmin) && tablesEnabled;
  const today = todayIso();
  const [selectedStationId, setSelectedStationId] = useState<number | null>(
    userStation?.station_id ? Number(userStation.station_id) : null,
  );

  const { data: stations = [] } = useQuery({
    queryKey: ["cash-register-stations", "pos-landing"],
    queryFn: fetchCashRegisterStations,
    staleTime: 60_000,
  });

  const activeStation = stations.find((s) => s.id === selectedStationId) ?? null;
  const terminalHref = activeStation
    ? `/pos/terminal?station_id=${activeStation.id}`
    : "/pos/terminal";
  const waiterHref = activeStation
    ? `/pos/terminal?view=waiter&station_id=${activeStation.id}`
    : "/pos/terminal?view=waiter";

  const { data: todayOrders } = useQuery({
    queryKey: ["orders", "today", today],
    queryFn: () =>
      fetchOrders({
        start_date: `${today}T00:00:00`,
        end_date: `${today}T23:59:59`,
      }),
    staleTime: 30_000,
  });

  const { data: pendingOrders } = useQuery({
    queryKey: ["orders", "pending", today],
    queryFn: () =>
      fetchOrders({
        payment_status: "PENDING",
      }),
    staleTime: 30_000,
  });

  const { data: currentCashRegister } = useQuery({
    queryKey: ["cash-register", "current"],
    queryFn: () => getCurrentCashRegister(),
    staleTime: 30_000,
    retry: false,
  });

  const stats = useMemo(() => {
    const orders = todayOrders?.results ?? [];
    const totalSales = orders
      .filter((o) => o.payment_status === "PAID" || o.payment_status === "PARTIAL")
      .reduce((sum, o) => sum + (typeof o.total_amount === "string" ? parseFloat(o.total_amount) : Number(o.total_amount ?? 0)), 0);
    const ordersCount = orders.length;
    const pendingCount = pendingOrders?.count ?? 0;
    return { totalSales, ordersCount, pendingCount };
  }, [todayOrders, pendingOrders]);

  const cashRegisterOpen = Boolean(currentCashRegister);

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
            <Receipt className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold">Punto de venta</h1>
          <p className="text-sm text-muted-foreground">
            {branch ? `Sucursal: ${branchName(branch)}` : "Sin sucursal seleccionada"}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ShoppingBag className="h-3.5 w-3.5" />
              Ventas hoy
            </div>
            <p className="text-lg font-semibold tabular-nums">{formatCLP(stats.totalSales)}</p>
            <p className="text-xs text-muted-foreground">{stats.ordersCount} órdenes</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Cuentas abiertas
            </div>
            <p className="text-lg font-semibold tabular-nums">{stats.pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pedidos sin pagar</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Banknote className="h-3.5 w-3.5" />
              Caja
            </div>
            <p className="text-lg font-semibold">
              {cashRegisterOpen ? "Abierta" : "Cerrada"}
            </p>
            <p className="text-xs text-muted-foreground">
              {cashRegisterOpen ? "Lista para cobros" : "Abre la caja antes de cobrar"}
            </p>
          </div>

          <Link
            href="/kds"
            className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted"
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" />
              Cocina
            </div>
            <p className="text-lg font-semibold">KDS</p>
            <p className="text-xs text-muted-foreground">Ver órdenes en preparación</p>
          </Link>
        </div>

        {stations.length > 0 && (
          <div className="mt-6">
            <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {userStation?.station_id ? "Estación asignada" : "Selecciona una estación / caja"}
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
          <Link
            href={terminalHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-8 py-5 text-lg font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] hover:shadow-xl sm:w-auto disabled:opacity-50"
            aria-disabled={!activeStation}
          >
            <Receipt className="h-6 w-6" />
            {activeStation ? `Abrir ${activeStation.name}` : "Abrir terminal POS"}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          {canSimulateWaiter && (
            <Link
              href={waiterHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <UserRound className="h-4 w-4" />
              Vista mesero
            </Link>
          )}
          <p className="max-w-sm text-center text-xs text-muted-foreground">
            Se abrirá en una nueva pestaña sin menú lateral, lista para dejar abierta durante el día.
          </p>
        </div>

        <div className="mt-8 flex justify-center gap-3">
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
          <Link
            href="/cash-register"
            className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <Banknote className="mr-2 h-4 w-4" />
            Caja
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
