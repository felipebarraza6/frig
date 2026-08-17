"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Minus, ArrowDownLeft, ArrowUpRight, RefreshCcw, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  getCurrentCashRegister,
  openCashRegister,
  closeCashRegister,
  getDailySummary,
  cashIn,
  cashOut,
  getMovements,
  fetchCashAudit,
  exportCashRegisterMovements,
  type CashRegisterMovement,
} from "@/lib/api/cash-register";
import { fetchCashRegisterStations } from "@/lib/api/cash-register-stations";
import { formatCLP, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import {
  useCurrentBranch,
  useCurrentBranchStation,
} from "@/lib/store/session";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";

function numberValue(v: string): string {
  const cleaned = v.replace(/[^0-9]/g, "");
  return cleaned ? (parseInt(cleaned, 10) || 0).toString() : "";
}

function toDecimal(v: string): string {
  const n = parseInt(v || "0", 10);
  return n.toFixed(2);
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
  const toast = useToast();
  const [tab, setTab] = useState<"summary" | "movements" | "audit">("summary");
  const [auditDate, setAuditDate] = useState(() => new Date().toISOString().split("T")[0]);
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();

  const assignedStationId = station?.station_id ?? null;
  const [selectedStationId, setSelectedStationId] = useState<number | null>(
    assignedStationId ? Number(assignedStationId) : null,
  );
  const canChangeStation = !assignedStationId;

  const { data: stations = [], isLoading: loadingStations } = useQuery({
    queryKey: ["cash-register-stations", "cash-register-page"],
    queryFn: fetchCashRegisterStations,
    enabled: canChangeStation && !!branch,
    staleTime: 60_000,
  });

  const activeStationId = assignedStationId ?? selectedStationId ?? stations[0]?.id ?? null;

  const activeStation = useMemo(() => {
    if (!activeStationId) return null;
    return stations.find((s) => s.id === Number(activeStationId)) ?? null;
  }, [stations, activeStationId]);

  const {
    data: cashRegister,
    isLoading: loadingRegister,
    refetch: refetchRegister,
  } = useQuery({
    queryKey: ["cash-register", "current", activeStationId],
    queryFn: () => getCurrentCashRegister(activeStationId),
    retry: false,
    enabled: !!activeStationId,
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["cash-register", "daily-summary", activeStationId],
    queryFn: () => getDailySummary(activeStationId),
    enabled: !!branch && !!activeStationId,
  });

  const { data: movements = [], isLoading: loadingMovements } = useQuery({
    queryKey: ["cash-register", cashRegister?.id, "movements"],
    queryFn: () => getMovements(cashRegister!.id),
    enabled: !!cashRegister?.id,
  });

  const { data: audit, isLoading: loadingAudit } = useQuery({
    queryKey: ["cash-register", "audit", auditDate],
    queryFn: () => fetchCashAudit(auditDate),
    enabled: !!branch,
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
      closeCashRegister(cashRegister!.id, { closing_amount: amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      setCloseAmount("");
      toast.success("Caja cerrada correctamente");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo cerrar la caja");
    },
  });

  const movementMutation = useMutation({
    mutationFn: (payload: { type: "CASH_IN" | "CASH_OUT"; amount: string; reason: string }) => {
      const base = { amount: payload.amount, reason: payload.reason };
      return payload.type === "CASH_IN"
        ? cashIn(cashRegister!.id, base)
        : cashOut(cashRegister!.id, base);
    },
    onSuccess: (_, payload) => {
      queryClient.invalidateQueries({ queryKey: ["cash-register"] });
      setMovementAmount("");
      setMovementReason("");
      toast.success(payload.type === "CASH_IN" ? "Ingreso registrado" : "Retiro registrado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo registrar el movimiento");
    },
  });

  const expected = cashRegister?.expected_amount ?? summary?.expected_amount ?? null;

  async function handleExportMovements() {
    if (!cashRegister?.id) return;
    await downloadFile(() => exportCashRegisterMovements(cashRegister.id), {
      filename: exportFilename(`movimientos_caja_${cashRegister.id}`, "xlsx"),
      extension: "xlsx",
    });
  }

  return (
    <div className="flex min-h-full flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Arqueo de caja</h1>
          <p className="text-xs text-muted-foreground">
            {branch ? `Sucursal: ${branch.business_name}` : "Sin sucursal seleccionada"}
          </p>
          {canChangeStation ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Estación:</span>
              {loadingStations ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : stations.length === 0 ? (
                <span className="text-xs text-amber-600">No hay estaciones de caja creadas.</span>
              ) : (
                <Select
                  value={activeStationId ?? ""}
                  onChange={(e) => setSelectedStationId(e.target.value ? Number(e.target.value) : null)}
                  className="h-7 text-xs"
                >
                  <option value="">Seleccionar estación</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </Select>
              )}
            </div>
          ) : activeStation ? (
            <p className="text-xs text-muted-foreground">
              Estación: <span className="font-medium text-foreground">{activeStation.name} ({activeStation.code})</span>
            </p>
          ) : (
            <p className="text-xs text-amber-600">
              No tienes una estación de caja asignada.
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchRegister()} disabled={loadingRegister}>
          <RefreshCcw className={cn("h-4 w-4", loadingRegister && "animate-spin")} />
          Actualizar
        </Button>
      </header>

      {loadingRegister ? (
        <div className="grid flex-1 place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : cashRegister?.status === "OPEN" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Caja abierta</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Estación</p>
                <p className="font-medium">{cashRegister.station_name || cashRegister.station_code}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fecha</p>
                <p className="font-medium">{cashRegister.date}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Apertura</p>
                <p className="font-medium">{formatCLP(parseFloat(cashRegister.opening_amount || "0"))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Esperado</p>
                <p className="font-medium">
                  {expected !== null ? formatCLP(parseFloat(expected || "0")) : "—"}
                </p>
              </div>
            </div>

            <div className="mt-2 border-t border-border pt-4">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">Cerrar caja</h3>
              <div className="flex gap-2">
                <Input
                  value={closeAmount ? formatCLP(parseFloat(toDecimal(closeAmount))) : ""}
                  onChange={(e) => setCloseAmount(numberValue(e.target.value))}
                  placeholder="Monto contado"
                  className="tabular-nums"
                />
                <Button
                  onClick={() => closeMutation.mutate(toDecimal(closeAmount))}
                  disabled={!closeAmount || closeMutation.isPending}
                >
                  {closeMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cerrar
                </Button>
              </div>
              {expected !== null && closeAmount && (
                <p className="mt-2 text-xs">
                  Diferencia con esperado:{" "}
                  <span
                    className={cn(
                      "font-medium",
                      parseFloat(toDecimal(closeAmount)) - parseFloat(expected || "0") === 0
                        ? "text-emerald-600"
                        : "text-amber-600",
                    )}
                  >
                    {formatCLP(parseFloat(toDecimal(closeAmount)) - parseFloat(expected || "0"))}
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Movimientos de caja</h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={movementType === "CASH_IN" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setMovementType("CASH_IN")}
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  Ingreso
                </Button>
                <Button
                  type="button"
                  variant={movementType === "CASH_OUT" ? "danger" : "outline"}
                  size="sm"
                  onClick={() => setMovementType("CASH_OUT")}
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Retiro
                </Button>
              </div>
              <div className="flex flex-1 gap-2">
                <Input
                  value={movementAmount ? formatCLP(parseFloat(toDecimal(movementAmount))) : ""}
                  onChange={(e) => setMovementAmount(numberValue(e.target.value))}
                  placeholder="Monto"
                  className="w-32 tabular-nums"
                />
                <Input
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="Motivo"
                />
                <Button
                  onClick={() =>
                    movementMutation.mutate({
                      type: movementType,
                      amount: toDecimal(movementAmount),
                      reason: movementReason,
                    })
                  }
                  disabled={!movementAmount || !movementReason || movementMutation.isPending}
                  variant={movementType === "CASH_OUT" ? "danger" : "default"}
                >
                  {movementMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : movementType === "CASH_IN" ? (
                    <Plus className="h-4 w-4" />
                  ) : (
                    <Minus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">No hay caja abierta</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            Abre la caja para registrar pagos en efectivo y controlar el arqueo.
          </p>
          {!activeStationId ? (
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              Selecciona una estación de caja para abrirla.
            </div>
          ) : (
            <div className="flex max-w-md gap-2">
              <Input
                value={openAmount ? formatCLP(parseFloat(toDecimal(openAmount))) : ""}
                onChange={(e) => setOpenAmount(numberValue(e.target.value))}
                placeholder="Monto de apertura"
                className="tabular-nums"
              />
              <Button
                onClick={() =>
                  openMutation.mutate({
                    branch_id: Number(branch?.branch_id ?? 0),
                    opening_amount: toDecimal(openAmount),
                    station_id: Number(activeStationId),
                  })
                }
                disabled={!branch || !openAmount || openMutation.isPending}
              >
                {openMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Abrir caja
              </Button>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4 border-b border-border pb-2">
          <button
            onClick={() => setTab("summary")}
            className={cn(
              "text-sm font-medium",
              tab === "summary" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Resumen del día
          </button>
          <button
            onClick={() => setTab("movements")}
            className={cn(
              "text-sm font-medium",
              tab === "movements" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Movimientos
          </button>
          <button
            onClick={() => setTab("audit")}
            className={cn(
              "text-sm font-medium",
              tab === "audit" ? "text-foreground" : "text-muted-foreground",
            )}
          >
            Arqueo por rol
          </button>
        </div>

        {tab === "summary" ? (
          loadingSummary ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : summary ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard label="Ventas totales" value={parseFloat(summary.total_sales || "0")} />
              <SummaryCard label="Efectivo" value={parseFloat(summary.cash_sales || "0")} />
              <SummaryCard label="Tarjetas/Transf." value={parseFloat(summary.card_sales || "0")} />
              <SummaryCard label="Otros" value={parseFloat(summary.other_sales || "0")} />
              <SummaryCard label="Apertura" value={parseFloat(summary.opening_amount || "0")} />
              <SummaryCard label="Ingresos caja" value={parseFloat(summary.cash_in || "0")} />
              <SummaryCard label="Retiros caja" value={parseFloat(summary.cash_out || "0")} />
              <SummaryCard
                label="Esperado efectivo"
                value={summary.expected_amount !== null && summary.expected_amount !== undefined ? parseFloat(summary.expected_amount) : null}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay resumen disponible.</p>
          )
        ) : tab === "audit" ? (
          loadingAudit ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : audit ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Fecha de arqueo</label>
                  <Input
                    type="date"
                    value={auditDate}
                    onChange={(e) => setAuditDate(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  {audit.rol} · {audit.nombre}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {"total_ordenes_pagadas" in audit && (
                  <SummaryCard label="Órdenes pagadas" value={audit.total_ordenes_pagadas ?? null} format="number" />
                )}
                {"total_recaudado" in audit && (
                  <SummaryCard label="Total recaudado" value={audit.total_recaudado ?? null} />
                )}
                {"ordenes_pendientes" in audit && (
                  <SummaryCard label="Órdenes pendientes" value={audit.ordenes_pendientes ?? null} format="number" />
                )}
                {"total_mediciones" in audit && (
                  <SummaryCard label="Mediciones" value={audit.total_mediciones ?? null} format="number" />
                )}
                {"total_ordenes_generadas" in audit && (
                  <SummaryCard label="Órdenes generadas" value={audit.total_ordenes_generadas ?? null} format="number" />
                )}
                {"total_monto_generado" in audit && (
                  <SummaryCard label="Monto generado" value={audit.total_monto_generado ?? null} />
                )}
              </div>

              {audit.detalle_por_dia && audit.detalle_por_dia.length > 0 && (
                <div className="rounded-lg border border-border">
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
                          <td className="px-4 py-2 text-right tabular-nums">{day.ordenes ?? day.ordenes_generadas ?? 0}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatCLP(day.monto ?? 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No hay arqueo disponible.</p>
          )
        ) : loadingMovements ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Movimientos registrados</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportMovements}
                disabled={!cashRegister?.id || movements.length === 0 || isDownloading}
              >
                {isDownloading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="mr-2 h-4 w-4" />
                )}
                Exportar movimientos
              </Button>
            </div>
            {movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
            ) : (
              <ul className="flex flex-col gap-2">
            {movements.map((m: CashRegisterMovement) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-border px-4 py-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  {m.movement_type === "CASH_IN" ? (
                    <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-danger" />
                  )}
                  <div>
                    <p className="font-medium">{m.reason}</p>
                    <p className="text-xs text-muted-foreground">{m.created_by_name || "—"}</p>
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
  );
}

function SummaryCard({
  label,
  value,
  format = "currency",
}: {
  label: string;
  value: number | null;
  format?: "currency" | "number";
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">
        {value !== null
          ? format === "currency"
            ? formatCLP(value)
            : new Intl.NumberFormat("es-CL").format(value)
          : "—"}
      </p>
    </div>
  );
}
