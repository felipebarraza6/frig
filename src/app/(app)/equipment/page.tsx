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
  Pencil,
  Trash2,
  Wrench,
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
import { useCurrentBranch, useCanManageInventory } from "@/lib/store/session";
import { CrmDenied } from "@/components/customers/crm-denied";
import { createProduct } from "@/lib/api/products";
import { fetchWarehouses } from "@/lib/api/warehouses";
import {
  fetchEquipmentProfiles,
  createEquipmentProfile,
  updateEquipmentProfile,
  deleteEquipmentProfile,
  fetchEquipmentMeasurements,
  createEquipmentMeasurement,
  updateEquipmentMeasurement,
  deleteEquipmentMeasurement,
  fetchEquipmentMaintenances,
  createEquipmentMaintenance,
  deleteEquipmentMaintenance,
  MEASUREMENT_TYPE_LABELS,
  EQUIPMENT_STATUS_LABELS,
  MAINTENANCE_TYPE_LABELS,
  type EquipmentProfile,
  type EquipmentMeasurement,
  type EquipmentStatus,
  type MaintenanceType,
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

type DetailTab = "measure" | "edit" | "maintenance";

export default function EquipmentPage() {
  const _toast = useToast();
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const canManage = useCanManageInventory();
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

  if (!canManage) {
    return <CrmDenied title="Equipos" icon={<Thermometer className="h-5 w-5" />} />;
  }

  return (
    <PageShell>
      <PageHeader
        title="Equipos"
        icon={<Thermometer className="h-5 w-5" />}
        subtitle="Cámaras, hornos, refrigeradores y herramientas: bitácora de mediciones y mantenimiento"
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
                <li key={p.id} className="flex items-center gap-2 py-3">
                  <button
                    type="button"
                    onClick={() => setDetail(p)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block truncate text-sm font-semibold">{p.product_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {EQUIPMENT_STATUS_LABELS[p.equipment_status] ?? p.status_display}
                      {p.warehouse_name ? ` · ${p.warehouse_name}` : ""}
                      {p.serial_number ? ` · serie ${p.serial_number}` : ""}
                    </span>
                  </button>
                  {last ? (
                    <span className={cn("shrink-0 text-sm tabular-nums", last.is_normal ? "text-success" : "text-danger")}>
                      {last.value} {last.unit}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">Sin lecturas</span>
                  )}
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="Ver / medir"
                      onClick={() => setDetail(p)}
                    >
                      <Thermometer className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
        <EquipmentDetailModal
          profile={detail}
          branchId={branchId}
          onClose={() => setDetail(null)}
          onChanged={(next) => {
            queryClient.invalidateQueries({ queryKey: ["equipment-measurements"] });
            queryClient.invalidateQueries({ queryKey: ["equipment-profiles"] });
            queryClient.invalidateQueries({ queryKey: ["equipment-maintenances"] });
            if (next) setDetail(next);
            else setDetail(null);
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
      if (!branchId) throw new Error("Selecciona una sucursal activa.");
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
        branch: branchId,
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

function EquipmentDetailModal({
  profile,
  branchId,
  onClose,
  onChanged,
}: {
  profile: EquipmentProfile;
  branchId: number;
  onClose: () => void;
  onChanged: (next: EquipmentProfile | null) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<DetailTab>("measure");

  const deleteProfile = useMutation({
    mutationFn: () => deleteEquipmentProfile(profile.id),
    onSuccess: () => {
      toast.success("Equipo eliminado");
      onChanged(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AnimatedOverlay open onClose={onClose} panelClassName="flex items-end justify-center p-0 md:items-center md:p-4">
      <div className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl border-x border-t border-border bg-background md:max-w-lg md:rounded-2xl md:border">
        <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{profile.product_name}</h2>
            <p className="text-xs text-muted-foreground">
              {EQUIPMENT_STATUS_LABELS[profile.equipment_status] ?? profile.status_display}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-danger hover:bg-danger/10"
              title="Eliminar equipo"
              disabled={deleteProfile.isPending}
              onClick={() => {
                if (
                  confirm(
                    `¿Eliminar el equipo «${profile.product_name}»? Esta acción no se puede deshacer.`,
                  )
                ) {
                  deleteProfile.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <button type="button" onClick={onClose} aria-label="Cerrar"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="flex gap-1 border-b border-border px-3 py-2">
          {(
            [
              { id: "measure" as const, label: "Medición", icon: Thermometer },
              { id: "edit" as const, label: "Editar", icon: Pencil },
              { id: "maintenance" as const, label: "Mantenimiento", icon: Wrench },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
                tab === id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {tab === "measure" && (
            <MeasurePanel profile={profile} branchId={branchId} onSaved={() => onChanged(profile)} />
          )}
          {tab === "edit" && (
            <EditProfilePanel
              profile={profile}
              branchId={branchId}
              onSaved={(next) => onChanged(next)}
            />
          )}
          {tab === "maintenance" && (
            <MaintenancePanel profile={profile} branchId={branchId} onSaved={() => onChanged(profile)} />
          )}
        </div>
      </div>
    </AnimatedOverlay>
  );
}

function MeasurePanel({
  profile,
  branchId,
  onSaved,
}: {
  profile: EquipmentProfile;
  branchId: number;
  onSaved: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const defaultType = profile.measurement_types?.[0] || "temperature";
  const [mType, setMType] = useState(defaultType);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(profile.measurement_unit || UNIT_BY_TYPE[defaultType] || "°C");
  const [minV, setMinV] = useState("");
  const [maxV, setMaxV] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["equipment-measurements", profile.product],
    queryFn: () => fetchEquipmentMeasurements({ product: profile.product }),
  });

  const save = useMutation({
    mutationFn: () => {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error("Ingresa un valor numérico.");
      if (!branchId) throw new Error("Selecciona una sucursal activa.");
      const payload = {
        branch: branchId,
        product: profile.product,
        measurement_type: mType,
        value: n,
        unit: unit.trim() || UNIT_BY_TYPE[mType] || "",
        min_value: minV === "" ? undefined : Number(minV),
        max_value: maxV === "" ? undefined : Number(maxV),
        notes: notes.trim() || undefined,
      };
      if (editingId != null) {
        return updateEquipmentMeasurement(editingId, payload);
      }
      return createEquipmentMeasurement(payload);
    },
    onSuccess: () => {
      toast.success(editingId != null ? "Medición actualizada" : "Medición registrada");
      setValue("");
      setNotes("");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["equipment-measurements"] });
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteEquipmentMeasurement(id),
    onSuccess: () => {
      toast.success("Medición eliminada");
      queryClient.invalidateQueries({ queryKey: ["equipment-measurements"] });
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
    <div className="flex flex-col gap-4">
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
        <div className="flex justify-end gap-2">
          {editingId != null && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingId(null);
                setValue("");
                setNotes("");
              }}
            >
              Cancelar edición
            </Button>
          )}
          <Button type="submit" disabled={save.isPending}>
            {save.isPending
              ? "Guardando…"
              : editingId != null
                ? "Actualizar medición"
                : "Registrar medición"}
          </Button>
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
                <span className="min-w-0 text-muted-foreground">
                  {MEASUREMENT_TYPE_LABELS[m.measurement_type] ?? m.measurement_type}
                  {" · "}
                  {new Date(m.measurement_date).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className={cn("tabular-nums", m.is_normal ? "text-foreground" : "font-medium text-danger")}>
                    {m.value} {m.unit}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Editar medición"
                    onClick={() => {
                      setEditingId(m.id);
                      setMType(String(m.measurement_type));
                      setValue(String(m.value));
                      setUnit(m.unit);
                      setMinV(m.min_value == null ? "" : String(m.min_value));
                      setMaxV(m.max_value == null ? "" : String(m.max_value));
                      setNotes(m.notes ?? "");
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-danger hover:bg-danger/10"
                    title="Eliminar medición"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (confirm("¿Eliminar esta medición?")) remove.mutate(m.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function EditProfilePanel({
  profile,
  branchId,
  onSaved,
}: {
  profile: EquipmentProfile;
  branchId: number;
  onSaved: (next: EquipmentProfile) => void;
}) {
  const toast = useToast();
  const [status, setStatus] = useState<EquipmentStatus>(profile.equipment_status);
  const [manufacturer, setManufacturer] = useState(profile.manufacturer ?? "");
  const [modelNumber, setModelNumber] = useState(profile.model_number ?? "");
  const [serial, setSerial] = useState(profile.serial_number ?? "");
  const [unit, setUnit] = useState(profile.measurement_unit ?? "");
  const [notes, setNotes] = useState(profile.notes ?? "");
  const [measure, setMeasure] = useState(Boolean(profile.requires_measurements));
  const [types, setTypes] = useState<string[]>(profile.measurement_types ?? ["temperature"]);
  const [warehouseId, setWarehouseId] = useState(
    profile.warehouse != null ? String(profile.warehouse) : "",
  );
  const [intervalDays, setIntervalDays] = useState(
    profile.maintenance_interval_days != null ? String(profile.maintenance_interval_days) : "",
  );

  const { data: warehousesPage } = useQuery({
    queryKey: ["warehouses", branchId],
    queryFn: () => fetchWarehouses({ page_size: 50 }),
    enabled: branchId > 0,
  });
  const warehouses = warehousesPage?.results ?? [];

  const save = useMutation({
    mutationFn: () =>
      updateEquipmentProfile(profile.id, {
        equipment_status: status,
        manufacturer: manufacturer.trim(),
        model_number: modelNumber.trim(),
        serial_number: serial.trim(),
        measurement_unit: unit.trim() || undefined,
        notes: notes.trim(),
        requires_measurements: measure,
        measurement_types: measure ? types : [],
        warehouse: warehouseId ? Number(warehouseId) : null,
        maintenance_interval_days: intervalDays === "" ? undefined : Number(intervalDays),
      }),
    onSuccess: (next) => {
      toast.success("Equipo actualizado");
      onSaved(next);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Field label="Estado">
        <Select value={status} onChange={(e) => setStatus(e.target.value as EquipmentStatus)}>
          {(Object.keys(EQUIPMENT_STATUS_LABELS) as EquipmentStatus[]).map((key) => (
            <option key={key} value={key}>{EQUIPMENT_STATUS_LABELS[key]}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Fabricante">
          <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
        </Field>
        <Field label="Modelo">
          <Input value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} />
        </Field>
      </div>
      <Field label="N° de serie">
        <Input value={serial} onChange={(e) => setSerial(e.target.value)} />
      </Field>
      <Field label="Bodega que cubre">
        <Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">Sin asociar</option>
          {warehouses.map((w) => (
            <option key={w.id} value={String(w.id)}>{w.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Intervalo de mantenimiento (días)">
        <Input
          inputMode="numeric"
          value={intervalDays}
          onChange={(e) => setIntervalDays(e.target.value)}
          placeholder="90"
        />
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
          <Field label="Unidad principal">
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </Field>
        </>
      )}
      <Field label="Notas">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}

function MaintenancePanel({
  profile,
  branchId,
  onSaved,
}: {
  profile: EquipmentProfile;
  branchId: number;
  onSaved: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [mType, setMType] = useState<MaintenanceType>("PREVENTIVE");
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [notes, setNotes] = useState("");

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["equipment-maintenances", profile.product],
    queryFn: () => fetchEquipmentMaintenances({ product: profile.product }),
  });

  const save = useMutation({
    mutationFn: () => {
      if (!branchId) throw new Error("Selecciona una sucursal activa.");
      if (!description.trim()) throw new Error("Describe el mantenimiento.");
      return createEquipmentMaintenance({
        branch: branchId,
        product: profile.product,
        maintenance_type: mType,
        maintenance_date: date,
        description: description.trim(),
        cost: cost === "" ? null : Number(cost),
        performed_by: performedBy.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Mantenimiento registrado");
      setDescription("");
      setCost("");
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["equipment-maintenances"] });
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteEquipmentMaintenance(id),
    onSuccess: () => {
      toast.success("Mantenimiento eliminado");
      queryClient.invalidateQueries({ queryKey: ["equipment-maintenances"] });
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <Select value={mType} onChange={(e) => setMType(e.target.value as MaintenanceType)}>
              {(Object.keys(MAINTENANCE_TYPE_LABELS) as MaintenanceType[]).map((key) => (
                <option key={key} value={key}>{MAINTENANCE_TYPE_LABELS[key]}</option>
              ))}
            </Select>
          </Field>
          <Field
            label="Fecha"
            hint="La API solo acepta fechas de hoy o anteriores."
          >
            <Input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Descripción" required>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Cambio de filtro / revisión de sellos"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Costo">
            <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
          </Field>
          <Field label="Realizado por">
            <Input value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} />
          </Field>
        </div>
        <Field label="Notas">
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Guardando…" : "Registrar mantenimiento"}
          </Button>
        </div>
      </form>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Historial</p>
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-xl bg-muted/40" />
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin mantenimientos registrados.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {list.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">
                    {MAINTENANCE_TYPE_LABELS[m.maintenance_type] ?? m.maintenance_type}
                  </span>
                  <span className="text-muted-foreground">
                    {" · "}
                    {m.maintenance_date}
                  </span>
                  <span className="mt-0.5 block text-muted-foreground">{m.description}</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 shrink-0 p-0 text-danger hover:bg-danger/10"
                  title="Eliminar"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm("¿Eliminar este mantenimiento?")) remove.mutate(m.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
