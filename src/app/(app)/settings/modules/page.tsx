"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Monitor, Banknote, Table, LocateFixed, ChefHat, Boxes,
  Apple, Store, FileText, Percent, X, Shield, Zap, Download, Radio,
} from "lucide-react";
import { useCurrentBranch, useIsOwner, useIsSuperAdmin, useSessionStore } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import {
  fetchBranchModules, toggleBranchModule, parseSubmoduleConfig, type ModuleName,
} from "@/lib/api/branch-modules";
import { fetchFrontendConfig } from "@/lib/api/frontend-config";
import { ApiError } from "@/lib/api/client";
import type { YggdraSchemas } from "@/lib/api/types";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { FRIG_ALWAYS_ON_MODULES, FRIG_SETTINGS_MODULES } from "@/lib/modules";

type ModuleConfig = YggdraSchemas["BranchModuleConfiguration"];

interface ModuleDef {
  key: ModuleName;
  label: string;
  shortLabel: string;
  icon: typeof Monitor;
  desc: string;
  detail: string;
  properties: string[];
  enables: ModuleName[];
  requires: ModuleName[];
  setupHref?: string;
  setupLabel?: string;
}

const MODULES: ModuleDef[] = [
  { key: "pos", label: "Terminal POS", shortLabel: "POS", icon: Monitor, desc: "Cobros rápidos y boletas", detail: "Es el corazón de tu operación. Permite cobrar ventas presenciales de forma rápida: escanea productos, aplica descuentos, cobra con efectivo, tarjeta o transferencia, y emite boletas electrónicas al instante. Maneja cuentas abiertas para clientes que pagan después, y lleva el registro completo de cada transacción.", properties: ["Boletas electrónicas", "Cuentas abiertas", "Múltiples medios de pago", "Búsqueda rápida de productos"], enables: ["cash_register", "deliveries", "promotions", "invoices"], requires: [], setupHref: "/pos", setupLabel: "Abrir POS" },
  { key: "cash_register", label: "Caja y arqueo", shortLabel: "Caja", icon: Banknote, desc: "Apertura, cierre y arqueo", detail: "Control total del dinero en efectivo. Abres la caja con un monto inicial, registras cada entrada y salida de dinero durante el día, y al cierre haces el arqueo comparando lo que debería haber vs lo que realmente hay. Detecta faltantes o sobrantes y genera un reporte diario para tu contabilidad.", properties: ["Apertura con monto inicial", "Arqueo de cierre", "Movimientos de efectivo", "Reporte diario de caja"], enables: [], requires: ["pos"], setupHref: "/cash-register/stations", setupLabel: "Estaciones de caja" },
  { key: "tables", label: "Mesas y garzones", shortLabel: "Mesas", icon: Table, desc: "Mapa del salón", detail: "Organiza tu salón como un mapa visual. Asigna garzones a mesas, crea cuentas individuales por mesa, y envía comandas directamente a cocina. Ideal para restaurantes donde los clientes se sientan y el garzon toma la orden. Puedes ver en tiempo real qué mesas están ocupadas, cuáles tienen cuenta abierta y cuáles están libres.", properties: ["Mapa visual de mesas", "Asignación de garzones", "Cuentas independientes por mesa", "Comandas directas a cocina"], enables: ["production"], requires: [], setupHref: "/tables", setupLabel: "Configurar salón" },
  { key: "deliveries", label: "Retiro / Delivery", shortLabel: "Retiro/Delivery", icon: LocateFixed, desc: "Retiro en tienda y despacho a domicilio", detail: "Gestiona pedidos para retiro en tienda y delivery desde el mismo POS. Registra la dirección del cliente cuando es despacho a domicilio, asigna repartidores, y lleva el estado de cada pedido (preparando, en camino, entregado). El panel de despacho muestra todas las órdenes pendientes organizadas por prioridad, para que nunca se te escape un pedido.", properties: ["Pedidos para retiro en tienda", "Pedidos con dirección", "Seguimiento de entrega", "Panel de despacho en tiempo real", "Estado por pedido"], enables: ["production"], requires: ["pos"], setupHref: "/sales", setupLabel: "Ver pedidos" },
  { key: "production", label: "Cocina / KDS", shortLabel: "Cocina", icon: ChefHat, desc: "Pantallas de cocina", detail: "El Kitchen Display System reemplaza los tickets de papel en cocina. Las pantallas muestran las comandas que llegan desde mesas, POS y delivery, organizadas por tiempo de espera. Cada estación de cocina puede tener su propia pantalla. Los cocineros marcan items como listos y el sistema avisa al garzon o al repartidor automáticamente.", properties: ["Pantallas por estación", "Orden por tiempo de espera", "Marcado de items listos", "Historial de preparaciones"], enables: [], requires: ["tables", "deliveries"], setupHref: "/kds", setupLabel: "Abrir cocina" },
  { key: "inventory", label: "Inventario y bodegas", shortLabel: "Inventario", icon: Boxes, desc: "Stock y bodegas", detail: "Controla cuánto tienes de cada producto y materia prima. Registra entradas por compras a proveedores, salidas por ventas o mermas, y transferencias entre bodegas. Las alertas de stock mínimo te avisan antes de que se te acabe algo importante. Puedes tener múltiples bodegas (principal, secundaria, cámara fría) con stock independiente.", properties: ["Múltiples bodegas", "Stock en tiempo real", "Alertas de stock mínimo", "Transferencias entre bodegas"], enables: ["production"], requires: [], setupHref: "/warehouses", setupLabel: "Abrir bodegas" },
  { key: "nutrition", label: "Etiquetado nutricional", shortLabel: "Nutricional", icon: Apple, desc: "Tablas nutricionales", detail: "Cumple con la normativa MINSAL de etiquetado nutricional. Vinculas recetas con sus ingredientes y el sistema calcula automáticamente las calorías, grasas, azúcares y sodio por porción. Genera las tablas nutricionales que puedes imprimir o mostrar en tu menú digital. Esencial si vendes productos envasados o quieres diferenciarte con información transparente.", properties: ["Recetas con ingredientes", "Cálculo automático por porción", "Cumplimiento normativa MINSAL", "Tablas imprimibles"], enables: ["public_catalog"], requires: [], setupHref: "/products/nutrition", setupLabel: "Etiquetado" },
  { key: "public_catalog", label: "Menús y vitrinas", shortLabel: "Menús", icon: Store, desc: "Cartas y vitrinas digitales", detail: "Tus clientes abren el menú o vitrina en el navegador (QR o link): fotos, precios y descripción. Puedes crear varios (menú del día, carta principal, postres). Si activaste el etiquetado nutricional, también se muestra. Se actualiza al cambiar precios o disponibilidad.", properties: ["Varios menús / vitrinas", "QR y link público", "Fotos y descripción", "Actualización automática"], enables: [], requires: ["nutrition"], setupHref: "/products/menus", setupLabel: "Configurar cartas" },
  { key: "invoices", label: "SII", shortLabel: "SII", icon: FileText, desc: "Boletas y facturas", detail: "Emite documentos tributarios electrónicos válidos ante el SII. Boletas para clientes finales, facturas para empresas, y notas de crédito o débito para anulaciones y ajustes. Todo se envía automáticamente al SII. En Finanzas cargas el certificado y los datos del emisor (RUT, razón social) del cliente.", properties: ["Boletas electrónicas", "Facturas empresas", "Notas de crédito/débito", "Certificado y datos del emisor"], enables: [], requires: ["pos"], setupHref: "/finance/settings", setupLabel: "Certificado y emisor" },
  { key: "promotions", label: "Promos y descuentos", shortLabel: "Promos", icon: Percent, desc: "Descuentos y códigos", detail: "Crea promociones para atraer clientes y aumentar tus ventas. Descuentos por producto, por categoría, o por monto mínimo de compra. Códigos promocionales que el cajero aplica en el POS. Configura vigencias para que las promos se activen y desactiven solas. Ideal para happy hours, días especiales o campañas de marketing.", properties: ["Descuentos por producto o categoría", "Códigos promocionales", "Monto mínimo de compra", "Vigencia automática"], enables: [], requires: ["pos"], setupHref: "/promotions/discounts", setupLabel: "Crear promociones" },
  { key: "iot_telemetry", label: "Telemetría IoT", shortLabel: "IoT", icon: Radio, desc: "Sensores y mediciones", detail: "Monitoreo continuo de tus equipos y bodegas con dispositivos conectados. Registra variables como temperatura, humedad o energía de forma automática, revisa el histórico de mediciones por equipo, y exporta los datos para mantenimiento preventivo o cumplimiento normativo. Si un sensor sale del rango definido, queda registrado para su revisión.", properties: ["Dispositivos y variables configurables", "Mediciones automáticas", "Histórico por equipo", "Exportación de datos"], enables: [], requires: [], setupHref: "/iot", setupLabel: "Ver telemetría" },
];

export default function BranchModulesPage() {
  const branch = useCurrentBranch();
  const isOwner = useIsOwner();
  const isSuperAdmin = useIsSuperAdmin();
  const toast = useToast();
  const setModuleState = useSessionStore((s) => s.setModuleState);
  const setFrontendConfig = useSessionStore((s) => s.setFrontendConfig);
  const sessionModules = useSessionStore((s) => s.modules);
  const queryClient = useQueryClient();
  const branchId = branch?.branch_id ? Number(branch.branch_id) : null;
  const canManage = isOwner || isSuperAdmin;

  const { data: configs = [], isLoading, error, refetch } = useQuery({
    queryKey: ["branch-modules", branchId],
    queryFn: () => fetchBranchModules(branchId!),
    enabled: !!branchId,
    retry: 1,
  });

  const [optimisticState, setOptimisticState] = useState<Partial<Record<ModuleName, boolean>>>({});
  const [selectedKey, setSelectedKey] = useState<ModuleName | null>(null);

  const effectiveEnabled = useMemo(() => {
    const state: Record<ModuleName, boolean> = {} as Record<ModuleName, boolean>;
    for (const c of configs) {
      if (FRIG_SETTINGS_MODULES.includes(c.module_name) && !FRIG_ALWAYS_ON_MODULES.includes(c.module_name)) {
        state[c.module_name] = !!c.is_enabled;
      }
    }
    for (const m of MODULES) {
      if (!(m.key in state)) state[m.key] = sessionModules[m.key]?.is_enabled ?? false;
    }
    for (const [k, v] of Object.entries(optimisticState)) {
      if (v !== undefined) state[k as ModuleName] = v;
    }
    return state;
  }, [configs, sessionModules, optimisticState]);

  const activeCount = useMemo(() => MODULES.filter((m) => effectiveEnabled[m.key]).length, [effectiveEnabled]);
  const selectedDef = useMemo(() => MODULES.find((m) => m.key === selectedKey), [selectedKey]);

  const toggle = useMutation({
    mutationFn: toggleBranchModule,
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["branch-modules", branchId] });
      const previous = queryClient.getQueryData<ModuleConfig[]>(["branch-modules", branchId]);
      setOptimisticState((prev) => ({ ...prev, [vars.moduleName]: vars.isEnabled }));
      return { previous };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["branch-modules", branchId] });
      setModuleState(data.module_name, { is_enabled: !!data.is_enabled, submodule_config: parseSubmoduleConfig(data.submodule_config) });
      if (branchId) { try { const c = await fetchFrontendConfig(branchId); setFrontendConfig(c, String(branchId)); } catch { /* */ } }
    },
    onError: (err: Error, vars, context) => {
      if (context?.previous) queryClient.setQueryData(["branch-modules", branchId], context.previous);
      setOptimisticState((prev) => { const n = { ...prev }; delete n[vars.moduleName]; return n; });
      toast.error(err instanceof ApiError && (err.status === 403 || /plan/i.test(err.message)) ? "Módulo no incluido en tu plan" : err.message, 5000);
    },
  });

  function handleToggle(key: ModuleName) {
    if (toggle.isPending || !canManage || !branchId) return;
    toggle.mutate({ branchId, moduleName: key, isEnabled: !effectiveEnabled[key] });
  }

  return (
    <div className="mx-auto flex min-h-full w-full min-w-0 max-w-7xl flex-col">
      <PageHeader
        title="Módulos"
        subtitle="Conecta las funciones de tu sucursal"
        icon={<Sparkles className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{activeCount}/{MODULES.length}</span>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
              <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${(activeCount / MODULES.length) * 100}%` }} />
            </div>
          </div>
        }
      />

      <div className="flex flex-1 flex-col p-4 sm:p-6">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start">
            {error && (
              <p className="w-full text-sm text-muted-foreground">
                No se pudo refrescar el listado del servidor. Se muestran los módulos de esta sesión.{" "}
                <button type="button" className="font-medium text-primary hover:underline" onClick={() => refetch()}>
                  Reintentar
                </button>
              </p>
            )}
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {MODULES.map((m) => {
                const active = effectiveEnabled[m.key];
                const Icon = m.icon;
                const selected = selectedKey === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    disabled={toggle.isPending}
                    onClick={() => setSelectedKey(selected ? null : m.key)}
                    className={cn(
                      "glass flex min-w-0 flex-col gap-3 rounded-2xl p-4 text-left transition-all hover:shadow-sm",
                      selected && "ring-2 ring-primary/40",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl",
                          active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                        )}
                      >
                        <Icon className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-display text-sm font-semibold">{m.label}</span>
                          {active && (
                            <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                              Instalada
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-[12px] leading-5 text-muted-foreground text-pretty">
                          {m.desc}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <AnimatePresence>
              {selectedDef && (
                <motion.aside
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  className="glass w-full shrink-0 rounded-2xl p-5 lg:sticky lg:top-4 lg:w-[22rem]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                        <selectedDef.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="font-display text-sm font-semibold">{selectedDef.label}</h2>
                        <p className="text-xs text-muted-foreground">{selectedDef.desc}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setSelectedKey(null)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-muted-foreground text-pretty">{selectedDef.detail}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedDef.properties.map((p) => (
                      <span key={p} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{p}</span>
                    ))}
                  </div>

                  {(selectedDef.requires.length > 0 || selectedDef.enables.length > 0) && (
                    <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 text-xs">
                      {selectedDef.requires.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Shield className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-muted-foreground">Necesita:</span>
                          {selectedDef.requires.map((r) => {
                            const rm = MODULES.find((x) => x.key === r);
                            const rActive = effectiveEnabled[r];
                            return <span key={r} className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", rActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{rm?.shortLabel}</span>;
                          })}
                        </div>
                      )}
                      {selectedDef.enables.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-primary" />
                          <span className="text-muted-foreground">Desbloquea:</span>
                          {selectedDef.enables.map((e) => {
                            const em = MODULES.find((x) => x.key === e);
                            return <span key={e} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{em?.shortLabel}</span>;
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex min-w-0 flex-col gap-2 border-t border-border/60 pt-4">
                    <button
                      type="button"
                      disabled={!canManage || toggle.isPending}
                      onClick={() => handleToggle(selectedDef.key)}
                      className={cn(
                        "inline-flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors",
                        effectiveEnabled[selectedDef.key]
                          ? "bg-muted text-foreground hover:bg-muted/80"
                          : "bg-primary text-primary-foreground hover:bg-primary/90",
                        (!canManage || toggle.isPending) && "opacity-50",
                      )}
                    >
                      <Download className="h-4 w-4" />
                      {effectiveEnabled[selectedDef.key] ? "Desinstalar" : "Instalar"}
                    </button>
                    {effectiveEnabled[selectedDef.key] && selectedDef.setupHref && (
                      <Link
                        href={selectedDef.setupHref}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-border text-sm font-medium hover:bg-muted/40"
                      >
                        {selectedDef.setupLabel ?? "Configurar"}
                      </Link>
                    )}
                    <p className="text-[11px] leading-5 text-muted-foreground text-pretty">
                      {selectedDef.key === "invoices"
                        ? "Después de instalar, carga el certificado SII y los datos del emisor (RUT, razón social) en Finanzas."
                        : "Instala la app en esta sucursal. Luego abre la configuración para dejarla lista."}
                    </p>
                  </div>
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
