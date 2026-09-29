"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Thermometer,
  Plus,
  X,
  AlertCircle,
  RotateCcw,
  Gauge,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PageShell, PageBody } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { useToast } from "@/lib/store/toast";
import { useCurrentBranch } from "@/lib/store/session";
import { createProduct } from "@/lib/api/products";
import { fetchWarehouses } from "@/lib/api/warehouses";
import {
  fetchEquipmentProfiles,
  createEquipmentProfile,
  fetchEquipmentMeasurements,
  createEquipmentMeasurement,
  MEASUREMENT_TYPE_LABELS,
  EQUIPMENT_STATUS_LABELS,
  type EquipmentProfile,
  type EquipmentMeasurement,
} from "@/lib/api/equipment";
import { cn } from "@/lib/utils";

const UNIT_BY_TYPE: Record<string, string> = {
  temperature: "°C",
  humidity: "%",
  pressure: "PSI",
  hours: "h",
  voltage: "V",
  current: "A",
  flow: "L/min",
  vibration: "mm/s",
  other: "",
};

export default function EquipmentPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const branchId = Number(branch?.branch_id ?? 0);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<EquipmentProfile | null>(null);

  const {
    data: profilesData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["equipment-profiles", branchId],
    queryFn: fetchEquipmentProfiles,
  });
  const profiles = profilesData ?? [];

  const { data: recentData } = useQuery({
    queryKey: ["equipment-measurements", "recent", branchId],
    queryFn: () => fetchEquipmentMeasurements(),
  });
  const recent = recentData ?? [];

  const outOfRange = recent.filter((m) => m.is_normal === false).length;
  const needsMeasure = profiles.filter((p) => p.requires_measurements).length;

  return (
    <PageShell>
      <PageHeader
        title="Equipos"
        icon={<Thermometer className="h-5 w-5" />}
        subtitle="Máquinas y herramientas: lecturas de temperatura, presión, horas, voltaje, flujo"
        actions={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />Nuevo equipo
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 border-b border-border px-4 py-3 sm:px-6 lg:grid-cols-3">
        <StatCard icon={Gauge} label="Equipos" value={String(profiles.length)} tone="primary" />
        <StatCard icon={Thermometer} label="Con medición" value={String(needsMeasure)} tone="muted" />
        <StatCard icon={AlertCircle} label="Fuera de rango" value={String(outOfRange)} tone={outOfRange ? "danger" : "success"} />
      </div>
      <PageBody>
        {isError ? (
          <EmptyState
            icon={AlertCircle}
            title="No se pudieron cargar los equipos"
            action={<Button variant="outline" size="sm" onClick={() => refetch()}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Reintentar</Button>}
          />
        ) : isLoading ? (
          <div className="h-24 animate-pulse rounded-xl bg-muted/40" />
        ) : profiles.length === 0 ? (
          <EmptyState
            icon={Thermometer}
            title="Aún no hay equipos"
            description="Registra una máquina y carga lecturas (temperatura, presión, horas, voltaje…)."
            action={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Nuevo equipo</Button>}
          />
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {profiles.map((p) => {
              const last = recent.find((m) => m.product === p.product);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setDetail(p)}
                    className="flex w-full min-w-0 items-center justify-between gap-3 py-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{p.product_name}</span>
                      <span className="text-xs text-muted-foreground">
                        {EQUIPMENT_STATUS_LABELS[p.equipment_status] ?? p.status_display}
                        {p.warehouse_name ? ` · ${p.warehouse_name}` : ""}
                        {p.serial_number ? ` · serie ${p.serial_number}` : ""}
                      </span>
                    </span>
                    {last ? (
                      <span className={cn("shrink-0 text-sm tabular-nums", last.is_normal ? "text-success" : "text-danger")}>
                        {last.value} {last.unit}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">Sin lecturas</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PageBody>

      <CreateEquipmentModal
        open={createOpen}
        branchId={branchId}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["equipment-profiles"] });
          setCreateOpen(false);
        }}
      />
      {detail && (
        <MeasureModal
          profile={detail}
          onClose={() => setDetail(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["equipment-measurements"] });
            queryClient.invalidateQueries({ queryKey: ["equipment-profiles"] });
          }}
        />
      )}
    </PageShell>
  );
}

function CreateEquipmentModal({
  open,
  branchId,
  onClose,
  onCreated,
}: {
  open: boolean;
  branchId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"EQUIPMENT" | "TOOL">("EQUIPMENT");
  const [serial, setSerial] = useState("");
  const [measure, setMeasure] = useState(true);
  const [types, setTypes] = useState<string[]>(["temperature", "hours"]);
  const [unit, setUnit] = useState("°C");
  const [warehouseId, setWarehouseId] = useState("");

  const { data: warehousesPage } = useQuery({
    queryKey: ["warehouses", branchId],
    queryFn: () => fetchWarehouses({ page_size: 50 }),
    enabled: open && branchId > 0,
  });
  const warehouses = warehousesPage?.results ?? [];

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Ponle un nombre al equipo.");
      const product = await createProduct({
        name: name.trim(),
        product_type: kind,
        is_for_sale: false,
        is_for_internal_use: true,
        tracks_inventory: false,
        price: 0,
      });
      await createEquipmentProfile({
        product: product.id,
        branch: branchId || undefined,
        equipment_status: "AVAILABLE",
        serial_number: serial.trim() || undefined,
        warehouse: warehouseId ? Number(warehouseId) : null,
        requires_measurements: measure,
        measurement_types: measure ? types : [],
        measurement_unit: measure ? unit : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Equipo creado");
      setName("");
      setSerial("");
      onCreated();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AnimatedOverlay open={open} onClose={onClose} panelClassName="flex items-end justify-center p-0 md:items-center md:p-4">
      <div className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border-x border-t border-border bg-background md:max-w-md md:rounded-2xl md:border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">Nuevo equipo</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        <form
          className="flex flex-col gap-3 overflow-y-auto p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <Field label="Nombre" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Compresor línea 2" />
          </Field>
          <Field label="Tipo">
            <Select value={kind} onChange={(e) => setKind(e.target.value as "EQUIPMENT" | "TOOL")}>
              <option value="EQUIPMENT">Equipo / maquinaria</option>
              <option value="TOOL">Herramienta</option>
            </Select>
          </Field>
          <Field label="N° de serie">
            <Input value={serial} onChange={(e) => setSerial(e.target.value)} />
          </Field>
          <Field label="Bodega que cubre" hint="El informe cuenta los SKU de esa bodega.">
            <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Sin asociar</option>
              {warehouses.map((w) => (
                <option key={w.id} value={String(w.id)}>{w.name}</option>
              ))}
            </Select>
          </Field>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm">Requiere mediciones</p>
            <Switch checked={measure} onCheckedChange={setMeasure} />
          </div>
          {measure && (
            <>
              <Field label="Qué se mide">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(MEASUREMENT_TYPE_LABELS).map(([key, label]) => {
                    const on = types.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setTypes((prev) =>
                            on ? prev.filter((t) => t !== key) : [...prev, key],
                          )
                        }
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium",
                          on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Unidad principal" hint="Ej. °C, PSI, h, V, L/min">
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
              </Field>
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Creando…" : "Crear"}</Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}

function MeasureModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: EquipmentProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const defaultType = profile.measurement_types?.[0] || "temperature";
  const [mType, setMType] = useState(defaultType);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(profile.measurement_unit || UNIT_BY_TYPE[defaultType] || "°C");
  const [minV, setMinV] = useState("");
  const [maxV, setMaxV] = useState("");
  const [notes, setNotes] = useState("");

  const { data: history = [] } = useQuery({
    queryKey: ["equipment-measurements", profile.product],
    queryFn: () => fetchEquipmentMeasurements({ product: profile.product }),
  });

  const save = useMutation({
    mutationFn: () => {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error("Ingresa un valor numérico.");
      return createEquipmentMeasurement({
        product: profile.product,
        measurement_type: mType,
        value: n,
        unit: unit.trim() || UNIT_BY_TYPE[mType] || "",
        min_value: minV === "" ? undefined : Number(minV),
        max_value: maxV === "" ? undefined : Number(maxV),
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Medición registrada");
      setValue("");
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const types = useMemo(() => {
    const fromProfile = (profile.measurement_types ?? []).filter(Boolean);
    const keys = fromProfile.length > 0 ? fromProfile : Object.keys(MEASUREMENT_TYPE_LABELS);
    return keys;
  }, [profile.measurement_types]);

  return (
    <AnimatedOverlay open onClose={onClose} panelClassName="flex items-end justify-center p-0 md:items-center md:p-4">
      <div className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border-x border-t border-border bg-background md:max-w-lg md:rounded-2xl md:border">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">{profile.product_name}</h2>
            <p className="text-xs text-muted-foreground">{EQUIPMENT_STATUS_LABELS[profile.equipment_status]}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Qué mides">
                <Select
                  value={mType}
                  onChange={(e) => {
                    const t = e.target.value;
                    setMType(t);
                    if (!unit || unit === UNIT_BY_TYPE[mType]) setUnit(UNIT_BY_TYPE[t] || unit);
                  }}
                >
                  {types.map((t) => (
                    <option key={t} value={t}>{MEASUREMENT_TYPE_LABELS[t] ?? t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Valor" required>
                <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="3.2" />
              </Field>
              <Field label="Unidad">
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
              </Field>
              <Field label="Rango (min – max)">
                <div className="flex gap-2">
                  <Input value={minV} onChange={(e) => setMinV(e.target.value)} placeholder="min" />
                  <Input value={maxV} onChange={(e) => setMaxV(e.target.value)} placeholder="max" />
                </div>
              </Field>
            </div>
            <Field label="Nota">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Guardando…" : "Registrar medición"}</Button>
            </div>
          </form>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Últimas lecturas</p>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay lecturas.</p>
            ) : (
              <ul className="divide-y divide-border border-y border-border">
                {history.slice(0, 12).map((m: EquipmentMeasurement) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-muted-foreground">
                      {MEASUREMENT_TYPE_LABELS[m.measurement_type] ?? m.measurement_type}
                      {" · "}
                      {new Date(m.measurement_date).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    <span className={cn("tabular-nums", m.is_normal ? "text-foreground" : "font-medium text-danger")}>
                      {m.value} {m.unit}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AnimatedOverlay>
  );
}
