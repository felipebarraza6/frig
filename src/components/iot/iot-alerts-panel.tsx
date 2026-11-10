"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";
import {
  ALERT_SEVERITY_LABELS,
  acknowledgeAlertTrigger,
  createAlertRule,
  deleteAlertRule,
  fetchAlertTriggers,
  updateAlertRule,
  type AlertSeverity,
  type TelemetryAlertRule,
  type TelemetryVariable,
  type ThresholdTarget,
} from "@/lib/api/iot";

const SEVERITY_TONE: Record<AlertSeverity, string> = {
  INFO: "bg-muted text-muted-foreground",
  WARNING: "bg-warning/15 text-warning",
  ALERT: "bg-danger/15 text-danger",
  CRITICAL: "bg-danger text-white",
};

function num(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return Number(value).toLocaleString("es-CL", { maximumFractionDigits: 2 });
}

export function IotAlertsPanel({
  deviceId,
  variables,
  rules,
}: {
  deviceId: string;
  variables: TelemetryVariable[];
  rules: TelemetryAlertRule[];
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [variableId, setVariableId] = useState("");
  const [target, setTarget] = useState<ThresholdTarget>("THRESHOLD_MAX");
  const [threshold, setThreshold] = useState("");
  const [severity, setSeverity] = useState<AlertSeverity>("ALERT");

  const { data: triggers = [], isLoading } = useQuery({
    queryKey: ["iot-alert-triggers", deviceId],
    queryFn: () => fetchAlertTriggers({ device: deviceId }),
    enabled: Boolean(deviceId),
    refetchInterval: 60_000,
  });
  const active = triggers.filter((t) => !t.is_acknowledged);
  const reviewed = triggers.filter((t) => t.is_acknowledged).slice(0, 10);
  const severityByRule = new Map(rules.map((r) => [r.id, r.severity ?? "ALERT"]));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["iot-alert-rules"] });
    queryClient.invalidateQueries({ queryKey: ["iot-alert-triggers"] });
  };

  const acknowledge = useMutation({
    mutationFn: acknowledgeAlertTrigger,
    onSuccess: () => {
      toast.success("Alerta marcada como revisada");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo marcar la alerta"),
  });

  const createRule = useMutation({
    mutationFn: createAlertRule,
    onSuccess: () => {
      toast.success("Regla creada");
      setThreshold("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo crear la regla"),
  });

  const toggleRule = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) =>
      updateAlertRule(id, { is_active }),
    onSuccess: invalidate,
    onError: (err: Error) => toast.error(err.message || "No se pudo actualizar la regla"),
  });

  const removeRule = useMutation({
    mutationFn: deleteAlertRule,
    onSuccess: () => {
      toast.success("Regla eliminada");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo eliminar la regla"),
  });

  const selectedVariable = variables.find((v) => String(v.id) === (variableId || String(variables[0]?.id ?? "")));

  function submitRule() {
    const value = Number(threshold.replace(",", "."));
    if (!selectedVariable) {
      toast.error("El dispositivo no tiene variables. Crea una en Variables.");
      return;
    }
    if (!threshold.trim() || !Number.isFinite(value)) {
      toast.error("Ingresa un umbral numérico.");
      return;
    }
    const op = target === "THRESHOLD_MAX" ? "sobre" : "bajo";
    createRule.mutate({
      name: `${selectedVariable.name} ${op} ${num(value)} ${selectedVariable.unit}`.trim(),
      device: Number(deviceId),
      variable: Number(selectedVariable.id),
      target_type: target,
      threshold_value: value,
      severity,
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Cada 5 minutos se compara la última lectura de cada variable con sus reglas. Si cruza el
        umbral, la alerta aparece aquí hasta que alguien la marque como revisada. No se envía por
        correo ni SMS.
      </p>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <BellRing className="h-4 w-4 text-danger" />
          Alertas activas ({active.length})
        </h3>
        {isLoading ? (
          <p className="mt-3 text-xs text-muted-foreground">Cargando alertas…</p>
        ) : active.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">Sin alertas activas.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {active.map((t) => {
              const sev = severityByRule.get(t.alert_rule) ?? "ALERT";
              return (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-danger/30 bg-danger/5 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold", SEVERITY_TONE[sev])}>
                        {ALERT_SEVERITY_LABELS[sev]}
                      </span>
                      {t.alert_rule_name || t.variable_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Valor {num(t.value_at_trigger)} · umbral {num(t.threshold_breached)} ·{" "}
                      {new Date(t.triggered_at).toLocaleString("es-CL")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => acknowledge.mutate(t.id)}
                    isLoading={acknowledge.isPending && acknowledge.variables === t.id}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Marcar revisada
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Reglas de umbral ({rules.length})</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] sm:items-end">
          <Field label="Variable" htmlFor="iot-rule-variable">
            <Select
              id="iot-rule-variable"
              value={selectedVariable ? String(selectedVariable.id) : ""}
              onChange={(e) => setVariableId(e.target.value)}
              className="h-9 text-xs"
              disabled={variables.length === 0}
            >
              {variables.map((v) => (
                <option key={v.id} value={String(v.id)}>
                  {v.name} ({v.unit})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Avisar si queda" htmlFor="iot-rule-target">
            <Select
              id="iot-rule-target"
              value={target}
              onChange={(e) => setTarget(e.target.value as ThresholdTarget)}
              className="h-9 text-xs"
            >
              <option value="THRESHOLD_MAX">Sobre el umbral</option>
              <option value="THRESHOLD_MIN">Bajo el umbral</option>
            </Select>
          </Field>
          <Field label={`Umbral${selectedVariable ? ` (${selectedVariable.unit})` : ""}`} htmlFor="iot-rule-threshold">
            <Input
              id="iot-rule-threshold"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              inputMode="decimal"
              placeholder="Ej: 8"
              className="h-9 text-xs"
            />
          </Field>
          <Field label="Severidad" htmlFor="iot-rule-severity">
            <Select
              id="iot-rule-severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
              className="h-9 text-xs"
            >
              {(Object.keys(ALERT_SEVERITY_LABELS) as AlertSeverity[]).map((s) => (
                <option key={s} value={s}>
                  {ALERT_SEVERITY_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Button
            size="sm"
            className="h-9"
            onClick={submitRule}
            isLoading={createRule.isPending}
            disabled={variables.length === 0}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Agregar
          </Button>
        </div>

        {rules.length > 0 && (
          <ul className="mt-4 divide-y divide-border/60">
            {rules.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.target_type_display || r.target_type} · {num(r.threshold_value)} ·{" "}
                    {ALERT_SEVERITY_LABELS[r.severity ?? "ALERT"]}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={r.is_active !== false}
                    onCheckedChange={(v) => toggleRule.mutate({ id: r.id, is_active: v })}
                    disabled={toggleRule.isPending}
                  />
                  <button
                    type="button"
                    onClick={() => removeRule.mutate(r.id)}
                    className="text-muted-foreground hover:text-danger"
                    aria-label={`Eliminar regla ${r.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {reviewed.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Revisadas recientemente</h3>
          <ul className="mt-2 divide-y divide-border/60 text-xs">
            {reviewed.map((t) => (
              <li key={t.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span className="text-foreground">{t.alert_rule_name || t.variable_name}</span>
                <span className="text-muted-foreground">
                  {num(t.value_at_trigger)} · {new Date(t.triggered_at).toLocaleString("es-CL")}
                  {t.acknowledged_by_name ? ` · revisó ${t.acknowledged_by_name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
