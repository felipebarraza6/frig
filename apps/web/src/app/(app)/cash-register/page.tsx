"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Minus,
  ArrowDownLeft,
  ArrowUpRight,
  FileDown,
  History,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Banknote,
  TrendingUp,
  Wallet,
  CreditCard,
  Coins,
  Calculator,
  CalendarDays,
  Unlock,
  Lock,
  FileText,
  X,
  User as UserIcon,
  Smartphone,
  Bitcoin,
  Landmark,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton, SkeletonText } from "@/components/ui/skeleton";
import {
  getCurrentCashRegister,
  getLastClosedCashRegister,
  openCashRegister,
  closeCashRegister,
  getDailySummary,
  cashIn,
  cashOut,
  getMovements,
  fetchCashAudit,
  exportCashAudit,
  exportCashAuditSimple,
  exportCashRegisterMovements,
  getCashRegisters,
  type CashRegisterMovement,
  type CashRegister as CashRegisterType,
} from "@/lib/api/cash-register";
import { fetchCashRegisterStations } from "@/lib/api/cash-register-stations";
import { fetchPurchaseOrders } from "@/lib/api/suppliers";
import { formatCLP, cn, paymentTypeLabel } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import {
  useCurrentBranch,
  useCurrentBranchStation,
  useCanViewCashRegisterHistory,
  useCashierStationOnly,
  useCanManageCashMovements,
  useSessionStore,
  useIsOwner,
  useIsSuperAdmin,
} from "@/lib/store/session";
import Link from "next/link";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";

import { fetchBranchPOSConfig } from "@/lib/api/branches";
import PosQuickActionsSettings from "@/components/pos/pos-quick-actions-settings";

function numberValue(v: string): string {
  const cleaned = v.replace(/[^0-9]/g, "");
  return cleaned ? (parseInt(cleaned, 10) || 0).toString() : "";
}

function toDecimal(v: string): string {
  const n = parseInt(v || "0", 10);
  return n.toFixed(2);
}

function toNum(v: string | number | null | undefined): number {
  return parseFloat(String(v ?? "0")) || 0;
}

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA");
}

function hasMultipleOpenGaps(items: CashRegisterType[] | undefined): boolean {
  if (!items || items.length === 0) return false;
  const openByStation = new Map<number | string | null, number>();
  for (const item of items) {
    if (item.status !== "OPEN") continue;
    const key = item.station ?? "legacy";
    openByStation.set(key, (openByStation.get(key) ?? 0) + 1);
  }
  return Array.from(openByStation.values()).some((count) => count > 1);
}

export default function CashRegisterPage() {
  const branch = useCurrentBranch();
  const station = useCurrentBranchStation();
  const queryClient = useQueryClient();
  const [openAmount, setOpenAmount] = useState("");
  const [closeAmount, setCloseAmount] = useState("");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [movementType, setMovementType] = useState<"CASH_IN" | "CASH_OUT">("CASH_IN");
  const [cashOutMode, setCashOutMode] = useState<"simple" | "purchase_order">("simple");
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState<string | null>(null);
  const [purchaseOrderSearch, setPurchaseOrderSearch] = useState("");
  const [purchaseOrderError, setPurchaseOrderError] = useState<string | null>(null);
  const toast = useToast();
  const [tab, setTab] = useState<"summary" | "movements" | "audit" | "history">("summary");
  const [auditDate, setAuditDate] = useState(() => todayLocal());
  const [movementsDate, setMovementsDate] = useState(() => todayLocal());
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const [downloadingAuditMode, setDownloadingAuditMode] = useState<"simple" | "full" | null>(null);
  const [posSettingsOpen, setPosSettingsOpen] = useState(false);

  const assignedStationId = station?.station_id ?? null;
  const [selectedStationId, setSelectedStationId] = useState<number | null>(
    assignedStationId ? Number(assignedStationId) : null,
  );
  const canChangeStation = !assignedStationId;

  const canViewHistory = useCanViewCashRegisterHistory();
  const canManageMovements = useCanManageCashMovements();
  const cashierStationOnly = useCashierStationOnly();
  const user = useSessionStore((s) => s.user);
  const isOwner = useIsOwner();
  const isSuperAdmin = useIsSuperAdmin();
  const canConfigurePOS = isOwner || isSuperAdmin;

  const { data: posConfig } = useQuery({
    queryKey: ["branch-pos-config"],
    queryFn: fetchBranchPOSConfig,
    enabled: canConfigurePOS,
    staleTime: 60_000,
  });
  const [historyStatus, setHistoryStatus] = useState<"" | "OPEN" | "CLOSED">("");
  const [historyDate, setHistoryDate] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 20;

  const [historyActionRegisterId, setHistoryActionRegisterId] = useState<number | null>(null);
  const [historyActionType, setHistoryActionType] = useState<"close" | "open" | null>(null);
  const [historyActionAmounts, setHistoryActionAmounts] = useState<Record<number, string>>({});

  const { data: stations = [], isLoading: loadingStations } = useQuery({
    queryKey: ["cash-register-stations", branch?.branch_id],
    queryFn: fetchCashRegisterStations,
    enabled: !!branch,
    staleTime: 60_000,
  });

  const activeStationId = useMemo(() => {
    const id = assignedStationId ?? selectedStationId ?? stations[0]?.id ?? null;
    return id ? Number(id) : null;
  }, [assignedStationId, selectedStationId, stations]);

  const activeStation = useMemo(() => {
    if (!activeStationId) return null;
    return stations.find((s) => s.id === Number(activeStationId)) ?? null;
  }, [stations, activeStationId]);

  const { data: cashRegister, isLoading: loadingRegister } = useQuery({
    queryKey: ["cash-register", branch?.branch_id, "current", activeStationId],
    queryFn: () => getCurrentCashRegister(activeStationId),
    retry: false,
    enabled: !!branch && !!activeStationId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: lastClosedRegister } = useQuery({
    queryKey: ["cash-register", branch?.branch_id, "last-closed", activeStationId],
    queryFn: () => getLastClosedCashRegister(activeStationId),
    enabled: !cashRegister && !!branch && !!activeStationId,
    retry: false,
    staleTime: 60_000,
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["cash-register", branch?.branch_id, "daily-summary", activeStationId],
    queryFn: () => getDailySummary(activeStationId),
    enabled: !!branch && !!activeStationId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: movementsRegisterPage, isLoading: loadingMovementsRegister } = useQuery({
    queryKey: ["cash-register", branch?.branch_id, "by-date", activeStationId, movementsDate],
    queryFn: () =>
      getCashRegisters({
        station: activeStationId,
        date: movementsDate,
        page_size: 1,
      }),
    enabled: !!branch && !!activeStationId && !!movementsDate,
    staleTime: 30_000,
  });

  const movementsCashRegister = movementsRegisterPage?.results[0] ?? null;
  const movementsCashRegisterId = useMemo(() => {
    // Si hay una caja abierta hoy para la estación activa, usarla siempre
    // para movimientos del día, incluso si la fecha guardada difiere por TZ.
    if (movementsDate === todayLocal() && cashRegister?.status === "OPEN") {
      return cashRegister.id;
    }
    if (movementsDate === cashRegister?.date) return cashRegister?.id ?? null;
    return movementsRegisterPage?.results[0]?.id ?? null;
  }, [movementsDate, cashRegister, movementsRegisterPage]);

  const { data: purchaseOrdersData, isLoading: loadingPurchaseOrders } = useQuery({
    queryKey: ["purchase-orders", "pending-for-cash", branch?.branch_id, purchaseOrderSearch],
    queryFn: () =>
      fetchPurchaseOrders({
        status: "SENT",
        payment_status: "PENDING",
        search: purchaseOrderSearch || undefined,
      }),
    enabled: cashOutMode === "purchase_order" && !!branch,
    staleTime: 30_000,
  });

  const pendingPurchaseOrders = purchaseOrdersData?.results ?? [];

  const selectedPurchaseOrder = useMemo(() => {
    if (!selectedPurchaseOrderId) return null;
    return pendingPurchaseOrders.find((o) => o.id === selectedPurchaseOrderId) ?? null;
  }, [selectedPurchaseOrderId, pendingPurchaseOrders]);

  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ["cash-register", branch?.branch_id, movementsCashRegisterId, "movements"],
    queryFn: () => getMovements(movementsCashRegisterId!),
    enabled: tab === "movements" && !!movementsCashRegisterId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const { data: audit, isLoading: loadingAudit } = useQuery({
    queryKey: ["cash-register", branch?.branch_id, "audit", activeStationId, auditDate],
    queryFn: () => fetchCashAudit(auditDate, "day", activeStationId),
    enabled: tab === "audit" && !!branch && !!activeStationId && !!auditDate,
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: [
      "cash-register",
      branch?.branch_id,
      "history",
      activeStationId,
      historyStatus,
      historyDate,
      historyPage,
    ],
    queryFn: () =>
      getCashRegisters({
        station: activeStationId,
        status: historyStatus,
        date: historyDate || undefined,
        page: historyPage,
        page_size: HISTORY_PAGE_SIZE,
      }),
    enabled: !!branch && !!activeStationId && (canViewHistory || cashierStationOnly) && tab === "history",
  });

  const openMutation = useMutation({
    mutationFn: openCashRegister,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      setOpenAmount("");
      toast.success("Caja abierta correctamente");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo abrir la caja");
    },
  });

  const closeMutation = useMutation({
    mutationFn: (amount: string) =>
      closeCashRegister(cashRegister!.id, { closing_amount: Number(amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      setCloseAmount("");
      toast.success("Caja cerrada correctamente");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo cerrar la caja");
    },
  });

  const closeHistoryMutation = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: string }) =>
      closeCashRegister(id, { closing_amount: Number(amount) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      setHistoryActionRegisterId(null);
      setHistoryActionType(null);
      setHistoryActionAmounts({});
      toast.success("Caja cerrada correctamente");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo cerrar la caja");
    },
  });

  const openHistoryMutation = useMutation({
    mutationFn: ({ stationId, amount }: { stationId: number; amount: string }) =>
      openCashRegister({
        branch_id: Number(branch?.branch_id ?? 0),
        station_id: stationId,
        opening_amount: Number(toDecimal(amount)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      setHistoryActionRegisterId(null);
      setHistoryActionType(null);
      setHistoryActionAmounts({});
      toast.success("Caja abierta correctamente");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo abrir la caja");
    },
  });

  const movementMutation = useMutation({
    mutationFn: async (payload: {
      type: "CASH_IN" | "CASH_OUT";
      amount: string;
      reason: string;
      purchase_order_id?: string | null;
    }) => {
      if (!branch?.branch_id) throw new Error("No hay sucursal seleccionada");
      if (!user?.id) throw new Error("No hay usuario identificado");

      const base = {
        amount: payload.amount,
        reason: payload.reason,
        purchase_order_id: payload.purchase_order_id || null,
      };
      const result = await (payload.type === "CASH_IN"
        ? cashIn(cashRegister!.id, base)
        : cashOut(cashRegister!.id, base));

      return result;
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      setMovementAmount("");
      setMovementReason("");
      setSelectedPurchaseOrderId(null);
      setPurchaseOrderError(null);
      if (payload.purchase_order_id) {
        toast.success("Pago de orden de compra registrado");
      } else {
        toast.success(payload.type === "CASH_IN" ? "Ingreso registrado" : "Retiro registrado");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo registrar el movimiento");
    },
  });

  const expected = cashRegister?.expected_amount ?? summary?.expected_amount ?? null;

  const auditPaymentTotals = (() => {
    if (!audit?.ordenes_pagadas_detalle) return [];
    const totals = new Map<string, number>();
    for (const order of audit.ordenes_pagadas_detalle) {
      for (const pm of order.payment_methods ?? []) {
        const key = paymentTypeLabel(pm.type) || pm.name || "Otro";
        totals.set(key, (totals.get(key) ?? 0) + toNum(String(pm.amount)));
      }
    }
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  })();
  const auditPaymentTotalAmount = auditPaymentTotals.reduce((sum, [, amount]) => sum + amount, 0);

  // Fallback income/outcome from movements if summary is not yet available.
  const { cashInTotal, cashOutTotal } = useMemo(() => {
    const fromSummary = {
      in: toNum(summary?.cash_in),
      out: toNum(summary?.cash_out),
    };
    if (fromSummary.in || fromSummary.out) {
      return { cashInTotal: fromSummary.in, cashOutTotal: fromSummary.out };
    }
    if (!movements || movements.length === 0) return { cashInTotal: 0, cashOutTotal: 0 };
    return movements.reduce(
      (acc, m) => {
        if (m.movement_type === "CASH_IN") acc.cashInTotal += toNum(m.amount);
        else acc.cashOutTotal += toNum(m.amount);
        return acc;
      },
      { cashInTotal: 0, cashOutTotal: 0 },
    );
  }, [summary, movements]);

  async function handleExportMovements() {
    const id = movementsCashRegisterId;
    if (!id) return;
    try {
      await downloadFile(() => exportCashRegisterMovements(id), {
        filename: exportFilename(`movimientos_caja_${id}`, "xlsx"),
        extension: "xlsx",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo descargar el archivo");
    }
  }

  async function handleExportAudit(mode: "simple" | "full" = "full") {
    setDownloadingAuditMode(mode);
    try {
      const exporter = mode === "simple" ? exportCashAuditSimple : exportCashAudit;
      const label = mode === "simple" ? "registros" : "general";
      await downloadFile(() => exporter(auditDate, "day", activeStationId), {
        filename: exportFilename(`arqueo_${auditDate}_${label}`, "xlsx"),
        extension: "xlsx",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo descargar el arqueo");
    } finally {
      setDownloadingAuditMode(null);
    }
  }

  function renderHistoryActions(cr: CashRegisterType) {
    if (!canManageMovements) return null;
    const isActive = historyActionRegisterId === cr.id;
    const amount = historyActionAmounts[cr.id] ?? "";
    const stationId = cr.station ?? null;

    if (isActive && historyActionType === "close") {
      return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Input
            value={amount ? formatCLP(parseFloat(toDecimal(amount))) : ""}
            onChange={(e) =>
              setHistoryActionAmounts((prev) => ({
                ...prev,
                [cr.id]: numberValue(e.target.value),
              }))
            }
            placeholder="Monto contado"
            className="h-8 text-xs tabular-nums sm:w-36"
          />
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              className="h-8"
              disabled={!amount || closeHistoryMutation.isPending}
              isLoading={closeHistoryMutation.isPending}
              onClick={() =>
                closeHistoryMutation.mutate({
                  id: cr.id,
                  amount: toDecimal(amount),
                })
              }
            >
              Cerrar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => {
                setHistoryActionRegisterId(null);
                setHistoryActionType(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      );
    }

    if (isActive && historyActionType === "open") {
      return (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Input
            value={amount ? formatCLP(parseFloat(toDecimal(amount))) : ""}
            onChange={(e) =>
              setHistoryActionAmounts((prev) => ({
                ...prev,
                [cr.id]: numberValue(e.target.value),
              }))
            }
            placeholder="Monto apertura"
            className="h-8 text-xs tabular-nums sm:w-36"
          />
          <div className="flex items-center justify-end gap-1.5">
            <Button
              size="sm"
              className="h-8"
              disabled={!stationId || !branch || openHistoryMutation.isPending}
              isLoading={openHistoryMutation.isPending}
              onClick={() =>
                openHistoryMutation.mutate({
                  stationId: stationId!,
                  amount,
                })
              }
            >
              Abrir
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8"
              onClick={() => {
                setHistoryActionRegisterId(null);
                setHistoryActionType(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      );
    }

    if (cr.status === "OPEN") {
      return (
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => {
            setHistoryActionRegisterId(cr.id);
            setHistoryActionType("close");
          }}
        >
          <Lock className="mr-1.5 h-3.5 w-3.5" />
          Cerrar
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        disabled={!stationId || !branch}
        onClick={() => {
          setHistoryActionRegisterId(cr.id);
          setHistoryActionType("open");
        }}
      >
        <Unlock className="mr-1.5 h-3.5 w-3.5" />
        Abrir
      </Button>
    );
  }

  const isOpen = cashRegister?.status === "OPEN";
  const openingAmount = toNum(cashRegister?.opening_amount ?? summary?.opening_amount);

  const isRegisterController =
    !cashRegister ||
    !isOpen ||
    isSuperAdmin ||
    isOwner ||
    cashRegister.opened_by === user?.id ||
    cashRegister.opened_by == null;

  return (
    <div className="flex min-h-full flex-col items-start justify-start py-6 px-4 md:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* Header / station selector */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Banknote className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Estación activa</p>
              {canChangeStation ? (
                <div className="flex items-center gap-2">
                  {loadingStations ? (
                    <SkeletonText width="120px" height="sm" />
                  ) : stations.length === 0 ? (
                    <span className="text-xs text-amber-600">No hay estaciones creadas.</span>
                  ) : (
                    <Select
                      value={activeStationId ?? ""}
                      onChange={(e) => setSelectedStationId(e.target.value ? Number(e.target.value) : null)}
                      className="h-8 min-w-[180px] text-xs"
                      options={[
                        { value: "", label: "Seleccionar estación" },
                        ...stations.map((s) => ({ value: String(s.id), label: `${s.name} (${s.code})` })),
                      ]}
                    />
                  )}
                </div>
              ) : activeStation ? (
                <p className="text-sm font-semibold">
                  {activeStation.name}{" "}
                  <span className="text-xs font-normal text-muted-foreground">({activeStation.code})</span>
                </p>
              ) : (
                <p className="text-xs text-amber-600">No tienes una estación asignada.</p>
              )}
            </div>
          </div>
          {canConfigurePOS && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPosSettingsOpen(true)}
              className="gap-2 self-start sm:self-auto"
            >
              <Settings className="h-4 w-4" />
              Acciones rápidas
            </Button>
          )}
        </header>

        {/* Top POS panel: Cash + Movements */}
        {loadingRegister ? (
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-5 shadow-sm">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </section>
        ) : (
          <section className={cn("grid gap-4", canManageMovements && "lg:grid-cols-3")}>
            {/* Cash register panel */}
            <div
              className={cn(
                "flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-5 shadow-sm",
                canManageMovements && "lg:col-span-2",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      isOpen ? "bg-emerald-500/10" : "bg-amber-500/10",
                    )}
                  >
                    {isOpen ? (
                      <Unlock className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Lock className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {cashRegister?.station_name || cashRegister?.station_code || activeStation?.name || "—"}
                    </p>
                    {isOpen && cashRegister?.opened_by_name && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <UserIcon className="h-3 w-3" />
                        Abierta por {cashRegister.opened_by_name}
                      </p>
                    )}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  <CalendarDays className="h-3 w-3" />
                  {cashRegister?.date || todayLocal()}
                </span>
              </div>

              {/* Metrics row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <MetricItem
                  icon={Wallet}
                  label="Apertura"
                  value={isOpen || openingAmount > 0 ? formatCLP(openingAmount) : "—"}
                />
                <MetricItem
                  icon={TrendingUp}
                  label="Ventas"
                  value={summary ? formatCLP(summary.total_sales) : "—"}
                  muted={!summary || summary.total_sales === 0}
                  loading={loadingSummary}
                />
                <MetricItem
                  icon={Banknote}
                  label="Efectivo"
                  value={summary ? formatCLP(summary.cash_sales) : "—"}
                  muted={!summary || summary.cash_sales === 0}
                  loading={loadingSummary}
                />
                <MetricItem
                  icon={CreditCard}
                  label="Otros"
                  value={summary ? formatCLP(summary.other_sales) : "—"}
                  muted={!summary || summary.other_sales === 0}
                  loading={loadingSummary}
                />
                <MetricItem
                  icon={ArrowDownLeft}
                  label="Ingresos"
                  value={formatCLP(cashInTotal)}
                  muted={cashInTotal === 0}
                />
                <MetricItem
                  icon={ArrowUpRight}
                  label="Retiros"
                  value={formatCLP(cashOutTotal)}
                  muted={cashOutTotal === 0}
                />
              </div>

              {/* Inline open/close action */}
              {isOpen ? (
                canManageMovements && (
                  <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-center">
                    <>
                      <Input
                        value={
                          isRegisterController
                            ? closeAmount
                              ? formatCLP(parseFloat(toDecimal(closeAmount)))
                              : ""
                            : ""
                        }
                        onChange={(e) => {
                          if (isRegisterController) setCloseAmount(numberValue(e.target.value));
                        }}
                        placeholder="Monto contado"
                        disabled={!isRegisterController}
                        className="tabular-nums sm:max-w-[180px]"
                      />
                      <Button
                        onClick={() => closeMutation.mutate(toDecimal(closeAmount))}
                        disabled={!isRegisterController || !closeAmount || closeMutation.isPending}
                        isLoading={closeMutation.isPending}
                        variant="outline"
                        className="shrink-0"
                      >
                        Cerrar caja
                      </Button>
                      {expected !== null && closeAmount && isRegisterController && (
                        <p className="text-xs sm:ml-auto">
                          Diferencia:{" "}
                          <span
                            className={cn(
                              "font-medium",
                              Number(toDecimal(closeAmount)) - (expected ?? 0) === 0
                                ? "text-emerald-600"
                                : "text-amber-600",
                            )}
                          >
                            {formatCLP(Number(toDecimal(closeAmount)) - (expected ?? 0))}
                          </span>
                        </p>
                      )}
                      {!isRegisterController && (
                        <p className="flex items-center gap-2 text-xs text-amber-700 sm:ml-auto">
                          <Lock className="h-4 w-4" />
                          Caja abierta por <strong>{cashRegister?.opened_by_name}</strong>. Solo esa persona o un administrador pueden operarla.
                        </p>
                      )}
                    </>
                  </div>
                )
              ) : (
                <div className="flex flex-col gap-3">
                  {lastClosedRegister && (
                    <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                      <History className="h-3.5 w-3.5" />
                      <span>
                        Último cierre:{" "}
                        <strong className="text-foreground">
                          {formatCLP(lastClosedRegister.closing_amount ?? 0)}
                        </strong>{" "}
                        {lastClosedRegister.date && (
                          <>el {new Date(lastClosedRegister.date).toLocaleDateString("es-CL")}</>
                        )}
                        {lastClosedRegister.closed_by_name && (
                          <> por {lastClosedRegister.closed_by_name}</>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {canManageMovements ? (
                      <>
                        <Input
                          value={openAmount ? formatCLP(parseFloat(toDecimal(openAmount))) : ""}
                          onChange={(e) => setOpenAmount(numberValue(e.target.value))}
                          placeholder="Monto de apertura (0 si inicia vacía)"
                          className="tabular-nums sm:max-w-[220px]"
                        />
                        <Button
                          onClick={() =>
                            openMutation.mutate({
                              branch_id: Number(branch?.branch_id ?? 0),
                              opening_amount: Number(toDecimal(openAmount)),
                              station_id: Number(activeStationId),
                            })
                          }
                          disabled={!branch || openMutation.isPending}
                          isLoading={openMutation.isPending}
                        >
                          Abrir caja
                        </Button>
                      </>
                    ) : (
                      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                        Solo el propietario o administrador pueden abrir/cerrar caja.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Movements panel */}
            {canManageMovements && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-5 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-semibold">
                  <Coins className="h-4 w-4 text-primary" />
                  Movimientos de caja
                </h2>
                <>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={movementType === "CASH_IN" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setMovementType("CASH_IN");
                        setCashOutMode("simple");
                        setSelectedPurchaseOrderId(null);
                        setPurchaseOrderError(null);
                      }}
                      disabled={isOpen && !isRegisterController}
                      className="flex-1"
                    >
                      <ArrowDownLeft className="mr-1.5 h-4 w-4" />
                      Ingreso
                    </Button>
                    <Button
                      type="button"
                      variant={movementType === "CASH_OUT" ? "danger" : "outline"}
                      size="sm"
                      onClick={() => {
                        setMovementType("CASH_OUT");
                        setCashOutMode("simple");
                        setSelectedPurchaseOrderId(null);
                        setPurchaseOrderError(null);
                      }}
                      disabled={isOpen && !isRegisterController}
                      className="flex-1"
                    >
                      <ArrowUpRight className="mr-1.5 h-4 w-4" />
                      Retiro
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {movementType === "CASH_OUT" && (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={cashOutMode === "simple" ? "danger" : "outline"}
                          size="sm"
                          onClick={() => {
                            setCashOutMode("simple");
                            setSelectedPurchaseOrderId(null);
                            setPurchaseOrderError(null);
                          }}
                          disabled={isOpen && !isRegisterController}
                          className="flex-1"
                        >
                          Retiro simple
                        </Button>
                        <Button
                          type="button"
                          variant={cashOutMode === "purchase_order" ? "danger" : "outline"}
                          size="sm"
                          onClick={() => {
                            setCashOutMode("purchase_order");
                            setMovementAmount("");
                            setMovementReason("");
                            setPurchaseOrderError(null);
                          }}
                          disabled={isOpen && !isRegisterController}
                          className="flex-1"
                        >
                          Pago orden de compra
                        </Button>
                      </div>
                    )}
                    {movementType === "CASH_OUT" && cashOutMode === "purchase_order" && (
                      <div className="flex flex-col gap-2">
                        <Input
                          value={purchaseOrderSearch}
                          onChange={(e) => setPurchaseOrderSearch(e.target.value)}
                          placeholder="Buscar orden de compra..."
                          disabled={isOpen && !isRegisterController}
                        />
                        <Select
                          value={selectedPurchaseOrderId ?? ""}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            setSelectedPurchaseOrderId(value);
                            setPurchaseOrderError(null);
                            if (value) {
                              const order = pendingPurchaseOrders.find((o) => o.id === value);
                              if (order) {
                                const remaining = Math.round(toNum(order.remaining_amount));
                                setMovementAmount(remaining ? remaining.toString() : "");
                                setMovementReason(`Pago ${order.order_number}`);
                              }
                            } else {
                              setMovementAmount("");
                              setMovementReason("");
                            }
                          }}
                          disabled={isOpen && !isRegisterController || loadingPurchaseOrders}
                          options={[
                            { value: "", label: "Seleccionar orden de compra" },
                            ...pendingPurchaseOrders.map((o) => ({
                              value: o.id,
                              label: `${o.order_number} - ${o.supplier_name || "Sin proveedor"} (${formatCLP(toNum(o.remaining_amount))})`,
                            })),
                          ]}
                        />
                        {loadingPurchaseOrders && (
                          <p className="text-xs text-muted-foreground">Cargando órdenes de compra...</p>
                        )}
                        <div className="flex items-center justify-between">
                          <Link
                            href="/purchase-orders"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Plus className="h-3 w-3" />
                            Crear nueva orden de compra
                          </Link>
                          {selectedPurchaseOrder && (
                            <p className="text-xs text-muted-foreground">
                              Total: {formatCLP(toNum(selectedPurchaseOrder.total_amount))} · Pendiente:{" "}
                              {formatCLP(toNum(selectedPurchaseOrder.remaining_amount))}
                            </p>
                          )}
                        </div>
                        {purchaseOrderError && (
                          <p className="text-xs text-red-600">{purchaseOrderError}</p>
                        )}
                      </div>
                    )}
                    <Input
                      value={movementAmount ? formatCLP(parseFloat(toDecimal(movementAmount))) : ""}
                      onChange={(e) => setMovementAmount(numberValue(e.target.value))}
                      placeholder="Monto"
                      disabled={isOpen && !isRegisterController || cashOutMode === "purchase_order"}
                      className="tabular-nums"
                    />
                    <Input
                      value={movementReason}
                      onChange={(e) => setMovementReason(e.target.value)}
                      placeholder="Motivo"
                      disabled={isOpen && !isRegisterController}
                    />
                    <Button
                      onClick={() => {
                        if (movementType === "CASH_OUT" && cashOutMode === "purchase_order" && !selectedPurchaseOrderId) {
                          setPurchaseOrderError("Selecciona una orden de compra para continuar");
                          return;
                        }
                        movementMutation.mutate({
                          type: movementType,
                          amount: toDecimal(movementAmount),
                          reason: movementReason,
                          purchase_order_id:
                            movementType === "CASH_OUT" && cashOutMode === "purchase_order"
                              ? selectedPurchaseOrderId
                              : null,
                        });
                      }}
                      disabled={
                        (isOpen && !isRegisterController) ||
                        !movementAmount ||
                        !movementReason ||
                        movementMutation.isPending
                      }
                      isLoading={movementMutation.isPending}
                      variant={movementType === "CASH_OUT" ? "danger" : "default"}
                    >
                      {movementType === "CASH_IN" ? (
                        <Plus className="mr-2 h-4 w-4" />
                      ) : (
                        <Minus className="mr-2 h-4 w-4" />
                      )}
                      {movementType === "CASH_IN"
                        ? "Registrar ingreso"
                        : cashOutMode === "purchase_order"
                          ? "Registrar pago de orden"
                          : "Registrar retiro"}
                    </Button>
                  </div>
                  {isOpen && !isRegisterController && (
                    <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                      <Lock className="h-4 w-4" />
                      Caja abierta por <strong>{cashRegister?.opened_by_name}</strong>. Solo esa persona o un administrador pueden operarla.
                    </p>
                  )}
                </>
              </div>
            )}
          </section>
        )}

        {/* Tabs */}
        <section className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-sm font-medium sm:hidden">
              {tab === "summary" && "Resumen"}
              {tab === "movements" && "Movimientos"}
              {tab === "audit" && "Arqueo"}
              {tab === "history" && "Histórico"}
            </p>
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
              <TabButton
                active={tab === "summary"}
                onClick={() => setTab("summary")}
                icon={TrendingUp}
                label="Resumen"
              />
              <TabButton
                active={tab === "movements"}
                onClick={() => setTab("movements")}
                icon={Coins}
                label="Movimientos"
              />
              <TabButton
                active={tab === "audit"}
                onClick={() => setTab("audit")}
                icon={Calculator}
                label="Arqueo"
              />
              {(canViewHistory || cashierStationOnly) && (
                <TabButton
                  active={tab === "history"}
                  onClick={() => setTab("history")}
                  icon={History}
                  label="Histórico"
                />
              )}
            </div>
          </div>

          {tab === "summary" ? (
            loadingSummary ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[92px] rounded-xl" />
                ))}
              </div>
            ) : summary ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                  label="Ventas totales"
                  value={summary.total_sales}
                  icon={TrendingUp}
                  tone="primary"
                />
                <SummaryCard
                  label="Efectivo"
                  value={summary.cash_sales}
                  icon={Banknote}
                  tone="emerald"
                />
                <SummaryCard
                  label="Tarjetas/Transf."
                  value={summary.card_sales}
                  icon={CreditCard}
                  tone="default"
                />
                <SummaryCard
                  label="Otros"
                  value={summary.other_sales}
                  icon={Coins}
                  tone="default"
                />
                <SummaryCard
                  label="Apertura"
                  value={summary.opening_amount}
                  icon={Wallet}
                  tone="default"
                />
                <SummaryCard
                  label="Ingresos caja"
                  value={parseFloat(summary.cash_in || "0")}
                  icon={ArrowDownLeft}
                  tone="emerald"
                />
                <SummaryCard
                  label="Retiros caja"
                  value={parseFloat(summary.cash_out || "0")}
                  icon={ArrowUpRight}
                  tone="amber"
                />
                <SummaryCard
                  label="Esperado efectivo"
                  value={
                    summary.expected_amount !== null && summary.expected_amount !== undefined
                      ? summary.expected_amount
                      : null
                  }
                  icon={Calculator}
                  tone="primary"
                />
              </div>
            ) : (
              <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-muted/20 py-10 text-center">
                <div>
                  <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">No hay resumen disponible</p>
                  <p className="text-xs text-muted-foreground">Abre la caja para comenzar a registrar ventas.</p>
                </div>
              </div>
            )
          ) : tab === "audit" ? (
            loadingAudit ? (
              <div className="space-y-4">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-48 rounded-2xl" />
              </div>
            ) : audit ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <CalendarDays className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Arqueo para la fecha</p>
                      <p className="text-sm font-semibold">
                        {auditDate
                          ? new Date(auditDate + "T00:00:00").toLocaleDateString("es-CL", {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })
                          : "—"}
                      </p>
                      {activeStation && (
                        <p className="text-[11px] text-muted-foreground">
                          {activeStation.name} ({activeStation.code})
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="date"
                      value={auditDate}
                      onChange={(e) => setAuditDate(e.target.value)}
                      className="h-9 w-40 text-xs"
                    />
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportAudit("simple")}
                        disabled={downloadingAuditMode !== null}
                        className="h-8 gap-1 text-xs"
                      >
                        {downloadingAuditMode === "simple" ? (
                          <SkeletonText width="14px" height="sm" className="inline-block" />
                        ) : (
                          <FileDown className="h-3.5 w-3.5" />
                        )}
                        Registros
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportAudit("full")}
                        disabled={downloadingAuditMode !== null}
                        className="h-8 gap-1 text-xs"
                      >
                        {downloadingAuditMode === "full" ? (
                          <SkeletonText width="14px" height="sm" className="inline-block" />
                        ) : (
                          <FileDown className="h-3.5 w-3.5" />
                        )}
                        General
                      </Button>
                    </div>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {audit.rol}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {"total_ordenes_pagadas" in audit && (
                    <SummaryCard
                      label="Pagos"
                      value={audit.total_ordenes_pagadas ?? null}
                      format="number"
                      icon={TrendingUp}
                      tone="primary"
                    />
                  )}

                  {"total_mediciones" in audit && (
                    <SummaryCard
                      label="Mediciones"
                      value={audit.total_mediciones ?? null}
                      format="number"
                      icon={Calculator}
                      tone="default"
                    />
                  )}
                  {"total_ordenes_generadas" in audit && (
                    <SummaryCard
                      label="Órdenes generadas"
                      value={audit.total_ordenes_generadas ?? null}
                      format="number"
                      icon={TrendingUp}
                      tone="primary"
                    />
                  )}
                  {"total_monto_generado" in audit && (
                    <SummaryCard
                      label="Monto generado"
                      value={audit.total_monto_generado ?? null}
                      icon={Coins}
                      tone="primary"
                    />
                  )}
                </div>

                {auditPaymentTotals.length > 0 && (
                  <div className="rounded-2xl border border-border bg-muted/30 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Wallet className="h-4 w-4 text-primary" />
                        Pagos
                      </h3>
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        Total {formatCLP(auditPaymentTotalAmount)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                      {auditPaymentTotals.map(([name, amount]) => {
                        const { icon: Icon, color, bg, bar } = paymentMethodMeta(name);
                        const pct = auditPaymentTotalAmount > 0 ? (amount / auditPaymentTotalAmount) * 100 : 0;
                        return (
                          <div
                            key={name}
                            className="flex flex-col gap-2 rounded-2xl border border-border bg-muted/30 p-3 transition-colors hover:border-border"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", bg)}>
                                <Icon className={cn("h-4 w-4", color)} />
                              </div>
                              <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-muted-foreground">{name}</p>
                              <p className="text-base font-bold tabular-nums">{formatCLP(amount)}</p>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className={cn("h-full rounded-full", bar)}
                                style={{ width: `${Math.max(pct, 4)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Pagos del día */}
                {(() => {
                  const paidOrders = audit.ordenes_pagadas_detalle ?? [];
                  const paidTotal = paidOrders.reduce(
                    (sum, o) => sum + toNum(String(o.total_amount)),
                    0,
                  );
                  return (
                    <div>
                      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <FileText className="h-4 w-4 text-primary" />
                          Pagos
                        </h3>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold tabular-nums">{formatCLP(paidTotal)}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                            {paidOrders.length} pago{paidOrders.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>

                      {loadingAudit ? (
                        <Skeleton className="h-10 w-full rounded-lg" />
                      ) : paidOrders.length === 0 ? (
                        <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/20 py-8 text-center">
                          <div>
                            <Banknote className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-2 text-sm font-medium">Sin pagos</p>
                            <p className="text-xs text-muted-foreground">No hay pagos para esta fecha.</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Vista desktop */}
                          <div className="hidden rounded-lg border border-border sm:block">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                                <tr>
                                  <th className="px-4 py-2">Orden</th>
                                  <th className="px-4 py-2">Cliente</th>
                                  <th className="px-4 py-2">Hora</th>
                                  <th className="px-4 py-2">Método</th>
                                  <th className="px-4 py-2">Estado pago</th>
                                  <th className="px-4 py-2 text-right">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paidOrders.map((order) => (
                                  <tr key={order.id} className="border-t border-border">
                                    <td className="px-4 py-2 font-medium">
                                      {order.order_number || order.id.slice(0, 8)}
                                    </td>
                                    <td className="px-4 py-2">{order.client_name || "Sin cliente"}</td>
                                    <td className="px-4 py-2">
                                      {new Date(order.date).toLocaleTimeString("es-CL", {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex flex-wrap gap-1">
                                        {(order.payment_methods ?? []).map((pm, idx) => (
                                          <span
                                            key={idx}
                                            className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                                            title={`${pm.name}: ${formatCLP(toNum(String(pm.amount)))}`}
                                          >
                                            {paymentTypeLabel(pm.type) || pm.name}
                                          </span>
                                        ))}
                                        {(order.payment_methods ?? []).length === 0 && (
                                          <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                        {order.payment_status === "PAID"
                                          ? "Pagada"
                                          : order.payment_status || "—"}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 text-right tabular-nums font-semibold">
                                      {formatCLP(toNum(String(order.total_amount)))}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* Vista móvil: dos columnas */}
                          <div className="grid grid-cols-1 gap-3 sm:hidden">
                            {paidOrders.map((order) => (
                              <div
                                key={order.id}
                                className="flex items-start justify-between border-b border-border pb-3 text-sm"
                              >
                                <div>
                                  <p className="font-medium">
                                    {order.order_number || order.id.slice(0, 8)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {order.client_name || "Sin cliente"} ·{" "}
                                    {new Date(order.date).toLocaleTimeString("es-CL", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {(order.payment_methods ?? []).map((pm, idx) => (
                                      <span
                                        key={idx}
                                        className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                                      >
                                        {paymentTypeLabel(pm.type) || pm.name}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="mt-1 text-sm font-semibold tabular-nums">
                                    {formatCLP(toNum(String(order.total_amount)))}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {audit.detalle_por_dia && audit.detalle_por_dia.length > 0 && (
                  <>
                    {/* Vista desktop */}
                    <div className="hidden rounded-lg border border-border sm:block">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-2">Fecha</th>
                            <th className="px-4 py-2 text-right">Órdenes</th>
                            <th className="px-4 py-2 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {audit.detalle_por_dia.map((day, idx) => (
                            <tr key={idx} className="border-t border-border">
                              <td className="px-4 py-2">{day.fecha}</td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {day.ordenes ?? day.ordenes_generadas ?? 0}
                              </td>
                              <td className="px-4 py-2 text-right tabular-nums">
                                {formatCLP(day.monto ?? 0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Vista móvil */}
                    <div className="flex flex-col gap-2 sm:hidden">
                      {audit.detalle_por_dia.map((day, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 p-3 text-sm"
                        >
                          <div>
                            <p className="font-medium">{day.fecha}</p>
                            <p className="text-xs text-muted-foreground">
                              {day.ordenes ?? day.ordenes_generadas ?? 0} órdenes
                            </p>
                          </div>
                          <span className="font-semibold tabular-nums">{formatCLP(day.monto ?? 0)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-muted/20 py-10 text-center">
                <div>
                  <Calculator className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">No hay arqueo disponible</p>
                  <p className="text-xs text-muted-foreground">Selecciona una fecha con actividad para ver el arqueo.</p>
                </div>
              </div>
            )
          ) : tab === "history" ? (
            <div className="flex flex-col gap-4">
              {hasMultipleOpenGaps(history?.results) && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Se detectaron cajas abiertas duplicadas</p>
                    <p className="text-xs opacity-90">
                      Una misma estación tiene más de una caja en estado abierto. Revisa el histórico y
                      cierra las cajas sobrantes para evitar gaps.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Estado</label>
                  <Select
                    value={historyStatus}
                    onChange={(e) => {
                      setHistoryStatus(e.target.value as "" | "OPEN" | "CLOSED");
                      setHistoryPage(1);
                    }}
                    className="h-8 text-xs w-36"
                  >
                    <option value="">Todos</option>
                    <option value="OPEN">Abierta</option>
                    <option value="CLOSED">Cerrada</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Fecha</label>
                  <Input
                    type="date"
                    value={historyDate}
                    onChange={(e) => {
                      setHistoryDate(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="h-8 text-xs w-40"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  title="Limpiar filtros"
                  onClick={() => {
                    setHistoryStatus("");
                    setHistoryDate("");
                    setHistoryPage(1);
                  }}
                  disabled={!historyStatus && !historyDate}
                  className="h-8 gap-1"
                >
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">Limpiar</span>
                </Button>
              </div>

              {loadingHistory ? (
                <div className="rounded-lg border border-border">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 border-b border-border px-4 py-2.5 last:border-0"
                    >
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-4 w-14 rounded-full" />
                      <Skeleton className="ml-auto h-3 w-16" />
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              ) : !history || history.results.length === 0 ? (
                <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-muted/20 py-10 text-center">
                  <div>
                    <History className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Sin registros</p>
                    <p className="text-xs text-muted-foreground">No hay registros de caja para los filtros seleccionados.</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Vista desktop */}
                  <div className="hidden rounded-lg border border-border sm:block">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 font-medium">Fecha</th>
                          <th className="px-4 py-2 font-medium">Estado</th>
                          <th className="px-4 py-2 text-right font-medium">Apertura</th>
                          <th className="px-4 py-2 text-right font-medium">Cierre</th>
                          <th className="px-4 py-2 text-right font-medium">Diferencia</th>
                          <th className="px-4 py-2 text-right font-medium">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {history.results.map((cr: CashRegisterType) => {
                          const diff = toNum(cr.difference);
                          return (
                            <tr key={cr.id} className="transition-colors hover:bg-muted/30">
                              <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                                {cr.date}
                              </td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                    cr.status === "OPEN"
                                      ? "bg-emerald-500/10 text-emerald-700"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {cr.status_display || (cr.status === "OPEN" ? "Abierta" : "Cerrada")}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                                {formatCLP(toNum(cr.opening_amount))}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                                {cr.closing_amount !== null && cr.closing_amount !== undefined
                                  ? formatCLP(toNum(cr.closing_amount))
                                  : "—"}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                                <span className={cn(diff === 0 ? "text-emerald-600" : "text-amber-600")}>
                                  {formatCLP(diff)}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right">{renderHistoryActions(cr)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Vista móvil */}
                  <div className="flex flex-col divide-y divide-border border-t border-border sm:hidden">
                    {history.results.map((cr: CashRegisterType) => {
                      const diff = toNum(cr.difference);
                      return (
                        <div key={cr.id} className="flex flex-col gap-2 py-3 text-sm">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium">{cr.date}</p>
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                                cr.status === "OPEN"
                                  ? "bg-emerald-500/10 text-emerald-700"
                                  : "bg-muted text-muted-foreground",
                              )}
                            >
                              {cr.status_display || (cr.status === "OPEN" ? "Abierta" : "Cerrada")}
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <p className="text-[10px] text-muted-foreground">Apertura</p>
                              <p className="tabular-nums font-medium">
                                {formatCLP(toNum(cr.opening_amount))}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground">Cierre</p>
                              <p className="tabular-nums font-medium">
                                {cr.closing_amount !== null && cr.closing_amount !== undefined
                                  ? formatCLP(toNum(cr.closing_amount))
                                  : "—"}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] text-muted-foreground">Diferencia</p>
                              <p
                                className={cn(
                                  "tabular-nums font-medium",
                                  diff === 0 ? "text-emerald-600" : "text-amber-600",
                                )}
                              >
                                {formatCLP(diff)}
                              </p>
                            </div>
                          </div>

                          <div className="flex justify-end">{renderHistoryActions(cr)}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">
                      {history.count} registro{history.count === 1 ? "" : "s"}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={!history.previous}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs text-muted-foreground">Página {historyPage}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHistoryPage((p) => p + 1)}
                        disabled={!history.next}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : loadingMovements || loadingMovementsRegister ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                >
                  <Skeleton className="h-7 w-7 rounded-md" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="hidden h-3 w-20 sm:block" />
                  <Skeleton className="ml-auto h-4 w-20" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold">Movimientos registrados</h3>
                  {movementsCashRegisterId && (
                    <MovementsRegisterBadge
                      movementsDate={movementsDate}
                      cashRegister={cashRegister}
                      historyRegister={movementsCashRegister}
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={movementsDate}
                    onChange={(e) => setMovementsDate(e.target.value)}
                    className="h-8 w-40 text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportMovements}
                    disabled={!movementsCashRegisterId || movements.length === 0 || isDownloading}
                    className="gap-1.5"
                  >
                    {isDownloading ? (
                      <SkeletonText width="14px" height="sm" className="inline-block" />
                    ) : (
                      <FileDown className="h-3.5 w-3.5" />
                    )}
                    Exportar
                  </Button>
                </div>
              </div>

              {!movementsCashRegisterId ? (
                <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
                  <div>
                    <Coins className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Sin caja registrada</p>
                    <p className="text-xs text-muted-foreground">No hay caja registrada para esta fecha.</p>
                  </div>
                </div>
              ) : movements.length === 0 ? (
                <div className="grid place-items-center rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
                  <div>
                    <ArrowDownLeft className="mx-auto h-8 w-8 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium">Sin movimientos</p>
                    <p className="text-xs text-muted-foreground">No hay movimientos registrados para esta fecha.</p>
                  </div>
                </div>
              ) : (
                <ul className="flex flex-col gap-2">
                  {movements.map((m: CashRegisterMovement) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg",
                            m.movement_type === "CASH_IN" ? "bg-emerald-500/10" : "bg-rose-500/10",
                          )}
                        >
                          {m.movement_type === "CASH_IN" ? (
                            <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-rose-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{m.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            {m.created_by_name || "—"} · {new Date(m.created).toLocaleString("es-CL")}
                          </p>
                        </div>
                      </div>
                      <span className="font-semibold tabular-nums">
                        {formatCLP(parseFloat(m.amount || "0"))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>
      </div>

      <PosQuickActionsSettings
        open={posSettingsOpen}
        config={posConfig}
        branchId={branch?.branch_id}
        onClose={() => setPosSettingsOpen(false)}
      />
    </div>
  );
}

function MetricItem({
  icon: Icon,
  label,
  value,
  muted = false,
  loading = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  muted?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-[92px] flex-col justify-between rounded-2xl border border-border bg-muted/30 p-3.5 transition-colors hover:border-border">
      <div className="flex items-start gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="leading-tight">{label}</span>
      </div>
      <p className={cn("text-base font-bold tabular-nums tracking-tight", muted && "text-muted-foreground")}>
        {loading ? <SkeletonText width="60%" height="md" /> : value}
      </p>
    </div>
  );
}

function MovementsRegisterBadge({
  movementsDate,
  cashRegister,
  historyRegister,
}: {
  movementsDate: string;
  cashRegister: CashRegisterType | null | undefined;
  historyRegister: CashRegisterType | null;
}) {
  const register =
    (movementsDate === todayLocal() && cashRegister?.status === "OPEN") ||
    movementsDate === cashRegister?.date
      ? cashRegister
      : historyRegister;
  const isOpen = register?.status === "OPEN";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        isOpen ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground",
      )}
    >
      {isOpen ? "Caja abierta" : "Caja cerrada"} · {movementsDate}
    </span>
  );
}

function paymentMethodMeta(name: string): {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  bar: string;
} {
  const n = name.toLowerCase();
  if (n.includes("efectivo") || n.includes("cash"))
    return { icon: Banknote, color: "text-primary", bg: "bg-primary/10", bar: "bg-primary" };
  if (n.includes("transferencia") || n.includes("bank"))
    return { icon: Landmark, color: "text-primary", bg: "bg-primary/15", bar: "bg-primary" };
  if (n.includes("débito") || n.includes("debit"))
    return { icon: CreditCard, color: "text-primary", bg: "bg-primary/20", bar: "bg-primary" };
  if (n.includes("crédito") || n.includes("credit"))
    return { icon: CreditCard, color: "text-primary", bg: "bg-primary/10 border border-primary/20", bar: "bg-primary" };
  if (n.includes("billetera") || n.includes("digital") || n.includes("wallet"))
    return { icon: Smartphone, color: "text-primary", bg: "bg-primary/15", bar: "bg-primary" };
  if (n.includes("cripto") || n.includes("crypto"))
    return { icon: Bitcoin, color: "text-primary", bg: "bg-primary/20", bar: "bg-primary" };
  if (n.includes("cheque") || n.includes("check"))
    return { icon: FileText, color: "text-primary", bg: "bg-primary/10", bar: "bg-primary" };
  return { icon: Wallet, color: "text-muted-foreground", bg: "bg-muted", bar: "bg-primary" };
}

function SummaryCard({
  label,
  value,
  format = "currency",
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: number | null;
  format?: "currency" | "number";
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "emerald" | "amber" | "primary";
}) {
  const toneClasses = {
    default: "bg-background",
    emerald: "bg-emerald-500/5 border-emerald-500/20",
    amber: "bg-amber-500/5 border-amber-500/20",
    primary: "bg-primary/5 border-primary/20",
  };
  const iconClasses = {
    default: "text-muted-foreground",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    primary: "text-primary",
  };
  return (
    <div className={cn("rounded-xl border border-border/60 p-4", toneClasses[tone])}>
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className={cn("h-3.5 w-3.5", iconClasses[tone])} />}
        {label}
      </div>
      <p className="text-lg font-bold tabular-nums">
        {value !== null
          ? format === "currency"
            ? formatCLP(value)
            : new Intl.NumberFormat("es-CL").format(value)
          : "—"}
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
