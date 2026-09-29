"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Radio,
  Plus,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  Wifi,
  WifiOff,
  Sliders,
  Database,
  Settings,
  X,
  FileSpreadsheet,
  FileText,
  Code,
  Gauge,
  Activity,
  Edit2,
  Trash2,
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
import { downloadCsv } from "@/lib/export-csv";
import { generateExcelBlob } from "@/lib/export-excel";
import { fetchProducts } from "@/lib/api/products";
import {
  fetchTelemetryDevices,
  createTelemetryDevice,
  updateTelemetryDevice,
  deleteTelemetryDevice,
  syncDeviceReadings,
  fetchTelemetryVariables,
  createTelemetryVariable,
  updateTelemetryVariable,
  deleteTelemetryVariable,
  fetchTelemetryReadings,
  createTelemetryReading,
  fetchTelemetryProviders,
  createTelemetryProvider,
  DEVICE_TYPE_LABELS,
  VARIABLE_TYPE_LABELS,
  COMMON_VARIABLE_UNITS,
  type DeviceType,
  type VariableType,
  type TelemetryDevice,
  type TelemetryVariable,
  type TelemetryReading,
  type TelemetryProvider,
} from "@/lib/api/iot";
import { cn } from "@/lib/utils";

type TabId = "devices" | "variables" | "readings" | "providers";

export default function IoTPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const branchId = Number(branch?.branch_id ?? 0);

  const [activeTab, setActiveTab] = useState<TabId>("devices");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  // Modals state
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<TelemetryDevice | null>(null);

  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<TelemetryVariable | null>(null);

  const [readingModalOpen, setReadingModalOpen] = useState(false);
  const [providerModalOpen, setProviderModalOpen] = useState(false);

  // Queries
  const {
    data: devices = [],
    isLoading: loadingDevices,
    isError: errorDevices,
    refetch: refetchDevices,
  } = useQuery({
    queryKey: ["iot-devices", branchId],
    queryFn: () => fetchTelemetryDevices({ branch: branchId || undefined }),
    enabled: true,
  });

  const { data: providers = [], refetch: refetchProviders } = useQuery({
    queryKey: ["iot-providers"],
    queryFn: fetchTelemetryProviders,
  });

  const { data: iotProducts = [] } = useQuery({
    queryKey: ["iot-products", branchId],
    queryFn: async () => {
      const res = await fetchProducts({ product_type: "IOT", page_size: 100 });
      return res.results ?? [];
    },
    enabled: Boolean(branchId),
  });

  // Effective selected device
  const effectiveDeviceId = selectedDeviceId || (devices[0]?.id ?? "");

  const {
    data: variables = [],
    isLoading: loadingVariables,
    refetch: refetchVariables,
  } = useQuery({
    queryKey: ["iot-variables", effectiveDeviceId],
    queryFn: () => fetchTelemetryVariables({ device: effectiveDeviceId }),
    enabled: Boolean(effectiveDeviceId),
  });

  const {
    data: readings = [],
    isLoading: loadingReadings,
    refetch: refetchReadings,
  } = useQuery({
    queryKey: ["iot-readings", effectiveDeviceId],
    queryFn: () => fetchTelemetryReadings({ device: effectiveDeviceId, page_size: 100 }),
    enabled: Boolean(effectiveDeviceId),
  });

  // KPI metrics
  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.is_online).length;
  const offlineDevices = totalDevices - onlineDevices;
  const totalReadings = readings.length;

  // Selected device object
  const currentDevice = devices.find((d) => d.id === effectiveDeviceId);

  // Filtered devices list
  const filteredDevices = useMemo(() => {
    if (!searchTerm.trim()) return devices;
    const q = searchTerm.toLowerCase();
    return devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.device_token && d.device_token.toLowerCase().includes(q)) ||
        (d.address && d.address.toLowerCase().includes(q)),
    );
  }, [devices, searchTerm]);

  // Mutations
  const syncMutation = useMutation({
    mutationFn: syncDeviceReadings,
    onSuccess: (data) => {
      toast.success(data.message || "Sincronización iniciada con el proveedor");
      queryClient.invalidateQueries({ queryKey: ["iot-devices"] });
      queryClient.invalidateQueries({ queryKey: ["iot-readings"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al sincronizar dispositivo");
    },
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: deleteTelemetryDevice,
    onSuccess: () => {
      toast.success("Dispositivo eliminado");
      queryClient.invalidateQueries({ queryKey: ["iot-devices"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al eliminar dispositivo");
    },
  });

  const deleteVariableMutation = useMutation({
    mutationFn: deleteTelemetryVariable,
    onSuccess: () => {
      toast.success("Variable eliminada");
      queryClient.invalidateQueries({ queryKey: ["iot-variables"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al eliminar variable");
    },
  });

  // Export handlers
  function handleExportCsv() {
    if (readings.length === 0) {
      toast.error("No hay lecturas disponibles para exportar");
      return;
    }
    const headers = [
      "ID",
      "Dispositivo",
      "Variable",
      "Fecha Lectura",
      "Valor Crudo",
      "Valor Procesado",
      "Unidad",
      "En Línea",
      "Error",
    ];
    const rows = readings.map((r) => [
      r.id,
      currentDevice?.name ?? r.device,
      r.variable_name ?? r.variable ?? "",
      r.reading_at,
      r.raw_value,
      r.processed_value,
      r.unit,
      r.is_online ? "Sí" : "No",
      r.is_error ? "Error" : "OK",
    ]);
    const filename = `telemetria_${currentDevice?.name || "dispositivo"}_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, headers, rows);
    toast.success("Archivo CSV exportado exitosamente");
  }

  async function handleExportExcel() {
    if (readings.length === 0) {
      toast.error("No hay lecturas disponibles para exportar");
      return;
    }
    const headers = [
      "ID",
      "Dispositivo",
      "Variable",
      "Fecha Lectura",
      "Valor Crudo",
      "Valor Procesado",
      "Unidad",
      "En Línea",
      "Estado",
    ];
    const rows = readings.map((r) => [
      String(r.id),
      String(currentDevice?.name ?? r.device),
      String(r.variable_name ?? r.variable ?? ""),
      String(r.reading_at),
      Number(r.raw_value) || String(r.raw_value),
      Number(r.processed_value) || String(r.processed_value),
      String(r.unit),
      r.is_online ? "Sí" : "No",
      r.is_error ? "Error" : "Normal",
    ]);

    try {
      const blob = await generateExcelBlob("Lecturas IoT", headers, rows, "#0891b2");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `telemetria_${currentDevice?.name || "dispositivo"}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Archivo Excel exportado exitosamente");
    } catch {
      toast.error("Error al generar archivo Excel");
    }
  }

  function handleExportJson() {
    if (readings.length === 0) {
      toast.error("No hay lecturas disponibles para exportar");
      return;
    }
    const exportData = {
      device: currentDevice,
      exported_at: new Date().toISOString(),
      readings_count: readings.length,
      readings,
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `telemetria_${currentDevice?.name || "dispositivo"}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo JSON exportado exitosamente");
  }

  return (
    <PageShell>
      <PageHeader
        title="Telemetría IoT"
        icon={<Radio className="h-5 w-5" />}
        subtitle="Monitoreo de dispositivos, configuración de variables, ingesta de datos y exportación"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchDevices();
                refetchVariables();
                refetchReadings();
                refetchProviders();
                toast.success("Datos actualizados");
              }}
              title="Refrescar datos"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            {/* Dropdown de Exportación */}
            <div className="flex items-center rounded-lg border border-border bg-card p-0.5 shadow-sm">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs"
                onClick={handleExportExcel}
                title="Exportar a Excel (.xlsx)"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                <span className="hidden sm:inline">Excel</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs"
                onClick={handleExportCsv}
                title="Exportar a CSV"
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-xs"
                onClick={handleExportJson}
                title="Exportar a JSON"
              >
                <Code className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">JSON</span>
              </Button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setReadingModalOpen(true)}
              disabled={!effectiveDeviceId}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Lectura
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setEditingDevice(null);
                setDeviceModalOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Nuevo Dispositivo
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 border-b border-border px-4 py-3 sm:px-6 lg:grid-cols-4">
        <StatCard
          icon={Gauge}
          label="Dispositivos Totales"
          value={String(totalDevices)}
          tone="primary"
        />
        <StatCard
          icon={Wifi}
          label="En Línea"
          value={String(onlineDevices)}
          tone={onlineDevices > 0 ? "success" : "muted"}
        />
        <StatCard
          icon={WifiOff}
          label="Desconectados"
          value={String(offlineDevices)}
          tone={offlineDevices > 0 ? "danger" : "muted"}
        />
        <StatCard
          icon={Activity}
          label="Lecturas Registradas"
          value={String(totalReadings)}
          tone="muted"
        />
      </div>

      <PageBody>
        {/* Barra de pestañas y selección de dispositivo */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("devices")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                activeTab === "devices"
                  ? "bg-primary/15 text-primary shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              <Radio className="h-3.5 w-3.5" />
              <span>Dispositivos ({totalDevices})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("variables")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                activeTab === "variables"
                  ? "bg-primary/15 text-primary shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Variables & Configuración</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("readings")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                activeTab === "readings"
                  ? "bg-primary/15 text-primary shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              <Database className="h-3.5 w-3.5" />
              <span>Lecturas & Datos</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("providers")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                activeTab === "providers"
                  ? "bg-primary/15 text-primary shadow-[inset_0_1px_0_var(--glass-highlight)] ring-1 ring-primary/25"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Apps Externas / Proveedores</span>
            </button>
          </div>

          {/* Selector de Dispositivo Activo para contextualizar Variables y Lecturas */}
          {devices.length > 0 && activeTab !== "devices" && activeTab !== "providers" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Dispositivo:</span>
              <Select
                value={effectiveDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="h-8 min-w-[200px] text-xs font-medium"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({DEVICE_TYPE_LABELS[d.device_type] || d.device_type})
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        {/* CONTENIDO DE PESTAÑAS */}

        {/* 1. DISPOSITIVOS */}
        {activeTab === "devices" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input
                placeholder="Buscar por nombre, token o dirección…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-xs h-9 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Mostrando {filteredDevices.length} de {totalDevices} dispositivos
              </p>
            </div>

            {errorDevices ? (
              <EmptyState
                icon={AlertCircle}
                title="Error al cargar dispositivos"
                description="Ocurrió un error conectando con el servicio de telemetría."
                action={
                  <Button size="sm" variant="outline" onClick={() => refetchDevices()}>
                    Reintentar
                  </Button>
                }
              />
            ) : filteredDevices.length === 0 ? (
              <EmptyState
                icon={Radio}
                title="Sin dispositivos IoT registrados"
                description="Agrega tu primer dispositivo y vincúlalo a un producto de tipo IOT o configúralo con una App Externa."
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingDevice(null);
                      setDeviceModalOpen(true);
                    }}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Registrar Dispositivo
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {filteredDevices.map((dev) => {
                  const isOnline = dev.is_online;
                  const isSyncing = syncMutation.isPending && syncMutation.variables === dev.id;

                  return (
                    <div
                      key={dev.id}
                      className={cn(
                        "group relative flex flex-col justify-between overflow-hidden rounded-2xl border p-4 transition-all duration-200",
                        dev.id === effectiveDeviceId
                          ? "border-primary/40 bg-card shadow-sm"
                          : "border-border bg-card/60 hover:border-border/80 hover:bg-card",
                      )}
                    >
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-xl",
                                isOnline
                                  ? "bg-success/15 text-success"
                                  : "bg-danger/15 text-danger",
                              )}
                            >
                              {isOnline ? (
                                <Wifi className="h-4 w-4" />
                              ) : (
                                <WifiOff className="h-4 w-4" />
                              )}
                            </span>
                            <div>
                              <h3 className="text-sm font-semibold leading-tight text-foreground">
                                {dev.name}
                              </h3>
                              <p className="text-[11px] text-muted-foreground">
                                {DEVICE_TYPE_LABELS[dev.device_type] || dev.device_type}
                              </p>
                            </div>
                          </div>
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              isOnline
                                ? "bg-success/15 text-success"
                                : "bg-danger/15 text-danger",
                            )}
                          >
                            {isOnline ? "En línea" : "Desconectado"}
                          </span>
                        </div>

                        {/* Metadata row */}
                        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/30 p-2 text-[11px]">
                          <div>
                            <span className="text-muted-foreground">Frecuencia:</span>
                            <p className="font-medium text-foreground">
                              {dev.reading_frequency} min
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Variables:</span>
                            <p className="font-medium text-foreground">
                              {dev.variables_count ?? 0} configuradas
                            </p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Producto vinculado:</span>
                            <p className="font-medium text-foreground truncate">
                              {dev.product_name || (dev.product ? `Producto #${dev.product}` : "Sin vincular")}
                            </p>
                          </div>
                        </div>

                        {dev.device_token && (
                          <div className="text-[10px] text-muted-foreground truncate font-mono bg-muted/20 px-2 py-1 rounded-md">
                            Token: {dev.device_token}
                          </div>
                        )}
                      </div>

                      {/* Footer actions */}
                      <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => {
                              setSelectedDeviceId(dev.id);
                              setActiveTab("variables");
                            }}
                          >
                            <Sliders className="mr-1 h-3 w-3" />
                            Variables
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => {
                              setSelectedDeviceId(dev.id);
                              setActiveTab("readings");
                            }}
                          >
                            <Database className="mr-1 h-3 w-3" />
                            Datos
                          </Button>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => syncMutation.mutate(dev.id)}
                            disabled={isSyncing}
                            title="Sincronizar lecturas"
                          >
                            <RefreshCw
                              className={cn("h-3.5 w-3.5", isSyncing && "animate-spin text-primary")}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditingDevice(dev);
                              setDeviceModalOpen(true);
                            }}
                            title="Editar dispositivo"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-danger hover:bg-danger/10"
                            onClick={() => {
                              if (confirm(`¿Eliminar dispositivo ${dev.name}?`)) {
                                deleteDeviceMutation.mutate(dev.id);
                              }
                            }}
                            title="Eliminar dispositivo"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. VARIABLES & MEDICIÓN */}
        {activeTab === "variables" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Variables de {currentDevice?.name || "Dispositivo"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Parámetros de medición física: caudal, nivel, temperatura, presión, totalizadores y factores de escala.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setEditingVariable(null);
                  setVariableModalOpen(true);
                }}
                disabled={!effectiveDeviceId}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Agregar Variable
              </Button>
            </div>

            {loadingVariables ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Cargando variables…
              </div>
            ) : variables.length === 0 ? (
              <EmptyState
                icon={Sliders}
                title="Sin variables configuradas"
                description="Este dispositivo aún no tiene variables de telemetría asociadas. Configura las variables para medir sus valores."
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      setEditingVariable(null);
                      setVariableModalOpen(true);
                    }}
                    disabled={!effectiveDeviceId}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Configurar Variable
                  </Button>
                }
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Nombre</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Unidad</th>
                        <th className="px-4 py-3">ID en Proveedor</th>
                        <th className="px-4 py-3">Factor / Offset</th>
                        <th className="px-4 py-3">Límites (Mín - Máx)</th>
                        <th className="px-4 py-3">Totalizador</th>
                        <th className="px-4 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {variables.map((v) => (
                        <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {v.name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                              {VARIABLE_TYPE_LABELS[v.variable_type] || v.variable_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {v.unit || "—"}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                            {v.provider_variable_id || "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            ×{v.conversion_factor} {Number(v.conversion_offset) !== 0 ? `+ ${v.conversion_offset}` : ""}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {v.min_value ?? "—"} a {v.max_value ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {v.is_counter ? (
                              <span className="rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 text-[10px] font-medium">
                                Acumulativo
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">Instantáneo</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEditingVariable(v);
                                  setVariableModalOpen(true);
                                }}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-danger hover:bg-danger/10"
                                onClick={() => {
                                  if (confirm(`¿Eliminar variable ${v.name}?`)) {
                                    deleteVariableMutation.mutate(v.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. LECTURAS & INGESTA */}
        {activeTab === "readings" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Historial de Lecturas ({readings.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Mediciones recibidas o registradas para {currentDevice?.name || "el dispositivo seleccionado"}.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExportCsv()}
                  disabled={readings.length === 0}
                  className="gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  Descargar CSV
                </Button>
                <Button
                  size="sm"
                  onClick={() => setReadingModalOpen(true)}
                  disabled={!effectiveDeviceId}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Nueva Lectura
                </Button>
              </div>
            </div>

            {loadingReadings ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                Cargando lecturas…
              </div>
            ) : readings.length === 0 ? (
              <EmptyState
                icon={Database}
                title="Sin datos ni lecturas recibidas"
                description="No hay mediciones registradas para este dispositivo. Puedes ingresar una lectura manual o sincronizar con el proveedor externo."
                action={
                  <Button
                    size="sm"
                    onClick={() => setReadingModalOpen(true)}
                    disabled={!effectiveDeviceId}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Registrar Primera Lectura
                  </Button>
                }
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border bg-muted/30 text-[11px] font-semibold text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Fecha y Hora</th>
                        <th className="px-4 py-3">Variable</th>
                        <th className="px-4 py-3">Valor Procesado</th>
                        <th className="px-4 py-3">Valor Crudo</th>
                        <th className="px-4 py-3">Unidad</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Envío DGA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {readings.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-mono text-[11px] text-foreground">
                            {r.reading_at ? new Date(r.reading_at).toLocaleString("es-CL") : "—"}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground">
                            {r.variable_name || r.variable || "General"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {r.processed_value} {r.unit}
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground text-[11px]">
                            {r.raw_value}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{r.unit}</td>
                          <td className="px-4 py-3">
                            {r.is_error ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 text-danger px-2 py-0.5 text-[10px] font-medium">
                                <AlertCircle className="h-3 w-3" />
                                {r.error_message || "Error"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 text-success px-2 py-0.5 text-[10px] font-medium">
                                <CheckCircle2 className="h-3 w-3" />
                                OK
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {r.send_dga ? (
                              <span className="rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 text-[10px] font-medium">
                                DGA Habilitado
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. PROVEEDORES & APPS EXTERNAS */}
        {activeTab === "providers" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Conectores y Apps Externas ({providers.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Configuración de gateways, brokers MQTT, APIs HTTP REST y plataformas como TDATA, TheThings.io o Tago.io.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setProviderModalOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Nuevo Proveedor
              </Button>
            </div>

            {providers.length === 0 ? (
              <EmptyState
                icon={Settings}
                title="Sin proveedores configurados"
                description="Agrega un conector de telemetría HTTP REST, MQTT o Custom para comenzar a recibir mediciones automáticas."
                action={
                  <Button size="sm" onClick={() => setProviderModalOpen(true)}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Crear Proveedor
                  </Button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {providers.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col justify-between rounded-2xl border border-border bg-card p-4"
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-foreground">{p.name}</h4>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {p.protocol}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {p.base_url || "Sin URL base configurada"}
                      </p>
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground mt-2">
                        <span>Handler: <strong className="text-foreground">{p.handler_name}</strong></span>
                        <span>•</span>
                        <span>Auth: <strong className="text-foreground">{p.auth_type}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </PageBody>

      {/* MODAL CREAR / EDITAR DISPOSITIVO */}
      {deviceModalOpen && (
        <DeviceModal
          device={editingDevice}
          branchId={branchId}
          providers={providers}
          iotProducts={iotProducts}
          onClose={() => setDeviceModalOpen(false)}
          onSuccess={() => {
            setDeviceModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["iot-devices"] });
          }}
        />
      )}

      {/* MODAL CREAR / EDITAR VARIABLE */}
      {variableModalOpen && (
        <VariableModal
          deviceId={effectiveDeviceId}
          variable={editingVariable}
          branchId={branchId}
          onClose={() => setVariableModalOpen(false)}
          onSuccess={() => {
            setVariableModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["iot-variables"] });
          }}
        />
      )}

      {/* MODAL REGISTRAR LECTURA */}
      {readingModalOpen && (
        <ReadingModal
          deviceId={effectiveDeviceId}
          variables={variables}
          branchId={branchId}
          onClose={() => setReadingModalOpen(false)}
          onSuccess={() => {
            setReadingModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["iot-readings"] });
            queryClient.invalidateQueries({ queryKey: ["iot-devices"] });
          }}
        />
      )}

      {/* MODAL CREAR PROVEEDOR */}
      {providerModalOpen && (
        <ProviderModal
          onClose={() => setProviderModalOpen(false)}
          onSuccess={() => {
            setProviderModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["iot-providers"] });
          }}
        />
      )}
    </PageShell>
  );
}

// ── COMPONENTE MODAL DISPOSITIVO ─────────────────────────────────────────────

function DeviceModal({
  device,
  branchId,
  providers,
  iotProducts,
  onClose,
  onSuccess,
}: {
  device: TelemetryDevice | null;
  branchId: number;
  providers: TelemetryProvider[];
  iotProducts: Array<{ id: number; name: string; code?: string | null }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(device?.name ?? "");
  const [deviceType, setDeviceType] = useState<DeviceType>(device?.device_type ?? "FLOW");
  const [readingFrequency, setReadingFrequency] = useState(String(device?.reading_frequency ?? 60));
  const [deviceToken, setDeviceToken] = useState(device?.device_token ?? "");
  const [provider, setProvider] = useState(device?.telemetry_provider ?? "");
  const [productId, setProductId] = useState(device?.product ? String(device.product) : "");
  const [address, setAddress] = useState(device?.address ?? "");
  const [lat, setLat] = useState(device?.lat ? String(device.lat) : "");
  const [lon, setLon] = useState(device?.lon ? String(device.lon) : "");

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        device_type: deviceType,
        reading_frequency: Number(readingFrequency) || 60,
        device_token: deviceToken || null,
        telemetry_provider: provider || null,
        product: productId ? Number(productId) : null,
        address: address || null,
        lat: lat ? Number(lat) : null,
        lon: lon ? Number(lon) : null,
        branch: branchId || undefined,
      };

      if (device?.id) {
        return updateTelemetryDevice(device.id, payload);
      } else {
        return createTelemetryDevice(payload);
      }
    },
    onSuccess: () => {
      toast.success(device ? "Dispositivo actualizado" : "Dispositivo creado");
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al guardar dispositivo");
    },
  });

  return (
    <AnimatedOverlay open={true} onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {device ? "Editar Dispositivo IoT" : "Nuevo Dispositivo IoT"}
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              toast.error("El nombre es requerido");
              return;
            }
            mutation.mutate();
          }}
          className="mt-4 flex flex-col gap-4 text-xs"
        >
          <Field label="Nombre del Dispositivo" htmlFor="device-name">
            <Input
              id="device-name"
              placeholder="Ej: Medidor de Caudal Pozo Principal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de Dispositivo" htmlFor="device-type">
              <Select
                id="device-type"
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value as DeviceType)}
              >
                {Object.entries(DEVICE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Frecuencia (minutos)" htmlFor="device-freq">
              <Select
                id="device-freq"
                value={readingFrequency}
                onChange={(e) => setReadingFrequency(e.target.value)}
              >
                <option value="1">1 minuto</option>
                <option value="5">5 minutos</option>
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
                <option value="60">60 minutos (1 hora)</option>
              </Select>
            </Field>
          </div>

          {/* Vínculo con Producto tipo IOT */}
          <Field
            label="Vincular a Producto de Catálogo (Tipo IOT)"
            htmlFor="device-product"
            hint="Vincula el hardware con un producto vendible o inventariable"
          >
            <Select
              id="device-product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">Sin vincular a producto</option>
              {iotProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.code ? `(${p.code})` : ""}
                </option>
              ))}
            </Select>
          </Field>

          {/* Conector / Proveedor */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Proveedor de Telemetría" htmlFor="device-provider">
              <Select
                id="device-provider"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
              >
                <option value="">Ninguno / Conexión Directa</option>
                {providers.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name} ({pr.protocol})
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Token / ID Dispositivo" htmlFor="device-token">
              <Input
                id="device-token"
                placeholder="Token o identificador en proveedor"
                value={deviceToken}
                onChange={(e) => setDeviceToken(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Dirección / Ubicación" htmlFor="device-addr">
            <Input
              id="device-addr"
              placeholder="Ej: Sector Norte, Caseta 2"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitud" htmlFor="device-lat">
              <Input
                id="device-lat"
                placeholder="-33.4489"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
            </Field>
            <Field label="Longitud" htmlFor="device-lon">
              <Input
                id="device-lon"
                placeholder="-70.6693"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
              />
            </Field>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando…" : device ? "Actualizar" : "Crear Dispositivo"}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}

// ── COMPONENTE MODAL VARIABLE ────────────────────────────────────────────────

function VariableModal({
  deviceId,
  variable,
  branchId,
  onClose,
  onSuccess,
}: {
  deviceId: string;
  variable: TelemetryVariable | null;
  branchId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(variable?.name ?? "");
  const [variableType, setVariableType] = useState<VariableType>(variable?.variable_type ?? "FLOW");
  const [unit, setUnit] = useState(variable?.unit ?? COMMON_VARIABLE_UNITS.FLOW);
  const [providerVariableId, setProviderVariableId] = useState(variable?.provider_variable_id ?? "");
  const [conversionFactor, setConversionFactor] = useState(String(variable?.conversion_factor ?? 1.0));
  const [conversionOffset, setConversionOffset] = useState(String(variable?.conversion_offset ?? 0.0));
  const [minValue, setMinValue] = useState(variable?.min_value !== undefined && variable?.min_value !== null ? String(variable.min_value) : "");
  const [maxValue, setMaxValue] = useState(variable?.max_value !== undefined && variable?.max_value !== null ? String(variable.max_value) : "");
  const [isCounter, setIsCounter] = useState(variable?.is_counter ?? false);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        device: deviceId,
        name,
        variable_type: variableType,
        unit,
        provider_variable_id: providerVariableId || null,
        conversion_factor: Number(conversionFactor) || 1.0,
        conversion_offset: Number(conversionOffset) || 0.0,
        min_value: minValue ? Number(minValue) : null,
        max_value: maxValue ? Number(maxValue) : null,
        is_counter: isCounter,
        branch: branchId || undefined,
      };

      if (variable?.id) {
        return updateTelemetryVariable(variable.id, payload);
      } else {
        return createTelemetryVariable(payload);
      }
    },
    onSuccess: () => {
      toast.success(variable ? "Variable actualizada" : "Variable configurada");
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al guardar variable");
    },
  });

  return (
    <AnimatedOverlay open={true} onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {variable ? "Editar Variable Telemétrica" : "Nueva Variable de Medición"}
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              toast.error("El nombre es requerido");
              return;
            }
            mutation.mutate();
          }}
          className="mt-4 flex flex-col gap-4 text-xs"
        >
          <Field label="Nombre de la Variable" htmlFor="var-name">
            <Input
              id="var-name"
              placeholder="Ej: Caudal de Extracción"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de Medición" htmlFor="var-type">
              <Select
                id="var-type"
                value={variableType}
                onChange={(e) => {
                  const t = e.target.value as VariableType;
                  setVariableType(t);
                  if (COMMON_VARIABLE_UNITS[t]) {
                    setUnit(COMMON_VARIABLE_UNITS[t]);
                  }
                  if (t === "TOTAL") setIsCounter(true);
                }}
              >
                {Object.entries(VARIABLE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Unidad de Medida" htmlFor="var-unit">
              <Input
                id="var-unit"
                placeholder="lt/s, m³, °C"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </Field>
          </div>

          <Field label="ID en Proveedor Externo" htmlFor="var-pid" hint="Identificador de la señal en el conector">
            <Input
              id="var-pid"
              placeholder="Ej: flow_rate_01 o channel_4"
              value={providerVariableId}
              onChange={(e) => setProviderVariableId(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Factor de Conversión" htmlFor="var-factor" hint="Multiplicador">
              <Input
                id="var-factor"
                type="number"
                step="any"
                value={conversionFactor}
                onChange={(e) => setConversionFactor(e.target.value)}
              />
            </Field>
            <Field label="Offset de Calibración" htmlFor="var-offset" hint="Suma/resta">
              <Input
                id="var-offset"
                type="number"
                step="any"
                value={conversionOffset}
                onChange={(e) => setConversionOffset(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Límite Mínimo Alerta" htmlFor="var-min">
              <Input
                id="var-min"
                type="number"
                step="any"
                placeholder="Opcional"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
              />
            </Field>
            <Field label="Límite Máximo Alerta" htmlFor="var-max">
              <Input
                id="var-max"
                type="number"
                step="any"
                placeholder="Opcional"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
            <div>
              <p className="font-medium text-foreground">Totalizador acumulativo</p>
              <p className="text-[11px] text-muted-foreground">
                Marca si el valor se acumula continuamente (ej: contador de metros cúbicos)
              </p>
            </div>
            <Switch checked={isCounter} onCheckedChange={setIsCounter} />
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando…" : variable ? "Actualizar" : "Crear Variable"}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}

// ── COMPONENTE MODAL LECTURA ─────────────────────────────────────────────────

function ReadingModal({
  deviceId,
  variables,
  branchId,
  onClose,
  onSuccess,
}: {
  deviceId: string;
  variables: TelemetryVariable[];
  branchId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [variableId, setVariableId] = useState(variables[0]?.id ?? "");
  const [readingAt, setReadingAt] = useState(new Date().toISOString().slice(0, 16));
  const [rawValue, setRawValue] = useState("");
  const [processedValue, setProcessedValue] = useState("");
  const [unit, setUnit] = useState(variables[0]?.unit ?? "lt/s");
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const selectedVar = variables.find((v) => v.id === variableId);
      const factor = Number(selectedVar?.conversion_factor ?? 1);
      const offset = Number(selectedVar?.conversion_offset ?? 0);
      const calcProcessed = processedValue
        ? Number(processedValue)
        : Number(rawValue) * factor + offset;

      return createTelemetryReading({
        device: deviceId,
        variable: variableId || null,
        reading_at: new Date(readingAt).toISOString(),
        raw_value: Number(rawValue),
        processed_value: calcProcessed,
        unit: unit || selectedVar?.unit || "",
        is_error: isError,
        error_message: errorMessage || null,
        branch: branchId || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Lectura registrada exitosamente");
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al registrar lectura");
    },
  });

  return (
    <AnimatedOverlay open={true} onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            Registrar Lectura Manual
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!rawValue) {
              toast.error("El valor es requerido");
              return;
            }
            mutation.mutate();
          }}
          className="mt-4 flex flex-col gap-4 text-xs"
        >
          <Field label="Variable a Medir" htmlFor="read-var">
            <Select
              id="read-var"
              value={variableId}
              onChange={(e) => {
                const vid = e.target.value;
                setVariableId(vid);
                const v = variables.find((x) => x.id === vid);
                if (v?.unit) setUnit(v.unit);
              }}
            >
              <option value="">Medición General / Sin variable</option>
              {variables.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.unit})
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Fecha y Hora de la Lectura" htmlFor="read-time">
            <Input
              id="read-time"
              type="datetime-local"
              value={readingAt}
              onChange={(e) => setReadingAt(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor Crudo (Sensor)" htmlFor="read-raw">
              <Input
                id="read-raw"
                type="number"
                step="any"
                placeholder="Ej: 14.5"
                value={rawValue}
                onChange={(e) => {
                  setRawValue(e.target.value);
                  if (!processedValue) {
                    const selectedVar = variables.find((v) => v.id === variableId);
                    const factor = Number(selectedVar?.conversion_factor ?? 1);
                    const offset = Number(selectedVar?.conversion_offset ?? 0);
                    setProcessedValue(String(Number(e.target.value) * factor + offset));
                  }
                }}
                required
              />
            </Field>

            <Field label="Unidad" htmlFor="read-unit">
              <Input
                id="read-unit"
                placeholder="lt/s, m³, etc."
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Valor Procesado Final (Opcional)"
            htmlFor="read-proc"
            hint="Se calculará con el factor de escala si se deja vacío"
          >
            <Input
              id="read-proc"
              type="number"
              step="any"
              placeholder="Automático"
              value={processedValue}
              onChange={(e) => setProcessedValue(e.target.value)}
            />
          </Field>

          <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
            <div>
              <p className="font-medium text-foreground">Marcar como lectura con error</p>
              <p className="text-[11px] text-muted-foreground">
                Útil para registrar fallas de sensor o lecturas fuera de rango
              </p>
            </div>
            <Switch checked={isError} onCheckedChange={setIsError} />
          </div>

          {isError && (
            <Field label="Mensaje de Error / Observación" htmlFor="read-err">
              <Input
                id="read-err"
                placeholder="Ej: Sensor desconectado o valor fuera de escala"
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
              />
            </Field>
          )}

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando…" : "Guardar Lectura"}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}

// ── COMPONENTE MODAL PROVEEDOR ───────────────────────────────────────────────

function ProviderModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState<"HTTP_REST" | "HTTP_GET" | "MQTT" | "WEBSOCKET" | "CUSTOM">("HTTP_REST");
  const [baseUrl, setBaseUrl] = useState("");
  const [handlerName, setHandlerName] = useState<"generic_json" | "tdata" | "thethings" | "tago">("generic_json");
  const [authType, setAuthType] = useState<"NONE" | "BASIC" | "BEARER" | "API_KEY_HEADER" | "QUERY_PARAM">("BEARER");
  const [authToken, setAuthToken] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      createTelemetryProvider({
        name,
        protocol,
        base_url: baseUrl,
        handler_name: handlerName,
        auth_type: authType,
        auth_token: authToken || undefined,
      }),
    onSuccess: () => {
      toast.success("Proveedor de telemetría configurado");
      onSuccess();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al crear proveedor");
    },
  });

  return (
    <AnimatedOverlay open={true} onClose={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            Configurar Conector de Telemetría
          </h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              toast.error("El nombre es requerido");
              return;
            }
            mutation.mutate();
          }}
          className="mt-4 flex flex-col gap-4 text-xs"
        >
          <Field label="Nombre del Proveedor / Conector" htmlFor="prov-name">
            <Input
              id="prov-name"
              placeholder="Ej: Gateway LoRaWAN Central o API TDATA"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Protocolo" htmlFor="prov-proto">
              <Select
                id="prov-proto"
                value={protocol}
                onChange={(e) => setProtocol(e.target.value as "HTTP_REST" | "HTTP_GET" | "MQTT" | "WEBSOCKET" | "CUSTOM")}
              >
                <option value="HTTP_REST">HTTP REST (JSON)</option>
                <option value="HTTP_GET">HTTP GET</option>
                <option value="MQTT">MQTT Broker</option>
                <option value="WEBSOCKET">WebSocket</option>
                <option value="CUSTOM">Personalizado</option>
              </Select>
            </Field>

            <Field label="Handler / Plataforma" htmlFor="prov-handler">
              <Select
                id="prov-handler"
                value={handlerName}
                onChange={(e) => setHandlerName(e.target.value as "generic_json" | "tdata" | "thethings" | "tago")}
              >
                <option value="generic_json">JSON Genérico</option>
                <option value="tdata">TDATA (TwinDimension)</option>
                <option value="thethings">TheThings.io</option>
                <option value="tago">Tago.io</option>
              </Select>
            </Field>
          </div>

          <Field label="URL Base del Servidor" htmlFor="prov-url">
            <Input
              id="prov-url"
              placeholder="https://api.proveedor.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo de Autenticación" htmlFor="prov-auth">
              <Select
                id="prov-auth"
                value={authType}
                onChange={(e) => setAuthType(e.target.value as "NONE" | "BASIC" | "BEARER" | "API_KEY_HEADER" | "QUERY_PARAM")}
              >
                <option value="NONE">Sin autenticación</option>
                <option value="BEARER">Bearer Token</option>
                <option value="API_KEY_HEADER">API Key (Header)</option>
                <option value="QUERY_PARAM">Query Param</option>
                <option value="BASIC">Basic Auth</option>
              </Select>
            </Field>

            <Field label="Token / Clave de Acceso" htmlFor="prov-token">
              <Input
                id="prov-token"
                type="password"
                placeholder="Token o API Key"
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
              />
            </Field>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={mutation.isPending}>
              {mutation.isPending ? "Guardando…" : "Crear Conector"}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedOverlay>
  );
}
