"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatCLP, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import {
  createInstallments,
  fetchInstallments,
  payInstallment,
  type PaymentInstallment,
} from "@/lib/api/orders";
import { fetchPaymentMethods } from "@/lib/api/payments";
import { fetchTaxTypes } from "@/lib/api/tax-types";
import { useCurrentBranch } from "@/lib/store/session";

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

function addMonths(isoDate: string, months: number): string {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function splitAmounts(total: number, count: number): number[] {
  if (count < 1) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const rest = cents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < rest ? 1 : 0)) / 100);
}

export function OrderInstallmentsPanel({
  orderId,
  remaining,
}: {
  orderId: string;
  remaining: number;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const [count, setCount] = useState("3");
  const [firstDue, setFirstDue] = useState(todayIso);
  const [taxId, setTaxId] = useState("");
  const [payingId, setPayingId] = useState<string | null>(null);
  const [methodId, setMethodId] = useState("");
  const [payAmount, setPayAmount] = useState("");

  const listQuery = useQuery({
    queryKey: ["orders", orderId, "installments"],
    queryFn: () => fetchInstallments(orderId),
  });
  const { data: methods = [] } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    staleTime: 60_000,
  });
  const { data: taxTypes = [] } = useQuery({
    queryKey: ["tax-types", branch?.branch_id, "cuotas"],
    queryFn: () => fetchTaxTypes({ branch: Number(branch!.branch_id), is_active: true }),
    enabled: Boolean(branch?.branch_id),
    staleTime: 60_000,
  });
  const rateTaxes = taxTypes.filter((t) => !t.tax_calc || t.tax_calc === "PERCENTAGE");
  const interestTax = rateTaxes.find((t) => t.id === taxId);
  const interestRate = Number(interestTax?.rate ?? 0) || 0;
  const financed = remaining * (1 + interestRate / 100);
  const interestAmount = financed - remaining;
  const activeMethods = methods.filter((m) => m.is_active !== false);

  const active = useMemo(
    () => (listQuery.data ?? []).filter((i) => i.status !== "CANCELLED"),
    [listQuery.data],
  );

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["orders", orderId, "installments"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["order", orderId] });
  }

  const create = useMutation({
    mutationFn: () => {
      const n = Math.max(1, Math.min(24, Number.parseInt(count, 10) || 1));
      const parts = splitAmounts(financed, n);
      const rateNote = interestTax
        ? ` · interés ${interestTax.name} ${interestRate}% (${formatCLP(interestAmount)})`
        : "";
      const plan = parts.map((amount, i) => ({
        amount: amount.toFixed(2),
        due_date: addMonths(firstDue, i),
        notes: `Cuota ${i + 1} de ${n}${rateNote}`,
      }));
      return createInstallments(orderId, plan);
    },
    onSuccess: () => {
      toast.success("Plan de cuotas creado");
      refresh();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo crear el plan"),
  });

  const pay = useMutation({
    mutationFn: ({ inst, amount }: { inst: PaymentInstallment; amount: string }) =>
      payInstallment(orderId, inst.id, {
        payment_method_id: methodId,
        amount,
      }),
    onSuccess: () => {
      toast.success("Cuota pagada");
      setPayingId(null);
      refresh();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo pagar la cuota"),
  });

  const n = Math.max(1, Math.min(24, Number.parseInt(count, 10) || 1));
  const preview = remaining > 0 ? splitAmounts(financed, n) : [];

  if (listQuery.isLoading) {
    return <p className="mt-4 text-sm text-muted-foreground">Cargando cuotas…</p>;
  }

  if (active.length > 0) {
    const paidCount = active.filter((i) => i.status === "PAID").length;
    return (
      <div className="mt-5 rounded-xl border border-border">
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            Plan de cuotas
          </p>
          <span className="text-xs tabular-nums text-muted-foreground">
            {paidCount}/{active.length} pagadas
          </span>
        </div>
        <ul className="divide-y divide-border/60">
          {active.map((inst, idx) => {
            const payable = inst.status === "PENDING" || inst.status === "OVERDUE";
            const open = payingId === inst.id;
            return (
              <li key={inst.id} className="px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium">Cuota {idx + 1}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{formatCLP(inst.amount)}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        inst.status === "PAID"
                          ? "bg-success/10 text-success"
                          : inst.status === "OVERDUE"
                            ? "bg-danger/10 text-danger"
                            : "bg-warning/10 text-warning",
                      )}
                    >
                      {inst.status_display ?? inst.status}
                    </span>
                    {payable && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          setPayingId(open ? null : inst.id);
                          setPayAmount(String(toNum(inst.amount)));
                          setMethodId(activeMethods[0]?.id ?? "");
                        }}
                      >
                        {open ? "Cerrar" : "Pagar"}
                      </Button>
                    )}
                  </span>
                </div>
                {inst.due_date && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Vence {new Date(`${inst.due_date}T12:00:00`).toLocaleDateString("es-CL")}
                  </p>
                )}
                {open && (
                  <form
                    className="mt-2 grid gap-2 rounded-lg bg-muted/20 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      pay.mutate({ inst, amount: toNum(payAmount).toFixed(2) });
                    }}
                  >
                    <Select
                      value={methodId}
                      onChange={(e) => setMethodId(e.target.value)}
                    >
                      <option value="">Método</option>
                      {activeMethods.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
                    <Button type="submit" size="sm" disabled={!methodId || pay.isPending}>
                      Confirmar cuota
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (remaining <= 0) return null;

  return (
    <div className="mt-5 rounded-xl border border-border p-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <CalendarClock className="h-3.5 w-3.5 text-primary" />
        Pagar en cuotas
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        Convierte el saldo ({formatCLP(remaining)}) en un plan. Puedes sumar una tasa de
        interés de Finanzas. Sigue siendo un solo ingreso; las cuotas son pagos.
      </p>
      <div className="mt-3 grid min-w-0 grid-cols-2 gap-2">
        <div className="min-w-0">
          <label className="text-[11px] text-muted-foreground">Cuotas</label>
          <Input
            type="number"
            min={1}
            max={24}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </div>
        <div className="min-w-0">
          <label className="text-[11px] text-muted-foreground">Primera fecha</label>
          <Input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
        </div>
        <div className="col-span-2 min-w-0">
          <p className="text-[11px] text-muted-foreground">Tasa de interés</p>
          <div className="mt-1 flex min-w-0 flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTaxId("")}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                !taxId
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              Sin interés
            </button>
            {rateTaxes.map((t) => {
              const on = taxId === t.id;
              const name = (t.name ?? "").split(",")[0].trim() || "Tasa";
              const rate =
                t.rate != null
                  ? ` ${Number(t.rate)}%`
                  : "";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTaxId(on ? "" : t.id)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium",
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {name}
                  {rate}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {preview.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {interestRate > 0
            ? `Saldo ${formatCLP(remaining)} + interés ${formatCLP(interestAmount)} = ${formatCLP(financed)}. `
            : null}
          {n} cuotas de {formatCLP(preview[0] ?? 0)}
          {preview[preview.length - 1] !== preview[0]
            ? ` (última ${formatCLP(preview[preview.length - 1] ?? 0)})`
            : ""}
        </p>
      )}
      <Button
        className="mt-3 w-full"
        variant="outline"
        disabled={remaining <= 0 || create.isPending}
        onClick={() => create.mutate()}
      >
        Establecer plan
      </Button>
    </div>
  );
}
