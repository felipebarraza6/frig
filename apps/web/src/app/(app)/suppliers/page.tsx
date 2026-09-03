"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Truck,
  X,
  SlidersHorizontal,
  Mail,
  Phone,
  MapPin,
  CheckCircle2,
  PauseCircle,
  IdCard,
  CircleAlert,
  FileSpreadsheet,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { useDownloadFile, exportFilename } from "@/lib/hooks/useDownloadFile";
import { generateExcelBlob } from "@/lib/export-excel";
import {
  fetchSupplier,
  fetchSupplierStats,
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  type SupplierList,
  type SupplierRequest,
} from "@/lib/api/suppliers";

const SUPPLIER_TYPES = [
  { value: "WHOLESALE", label: "Mayorista" },
  { value: "RETAIL", label: "Minorista" },
  { value: "MANUFACTURER", label: "Fabricante" },
  { value: "DISTRIBUTOR", label: "Distribuidor" },
  { value: "IMPORTER", label: "Importador" },
  { value: "LOCAL_PRODUCER", label: "Productor local" },
] as const;

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "SUSPENDED", label: "Suspendido" },
  { value: "BLACKLISTED", label: "Lista negra" },
];

function supplierTypeLabel(value?: string | null): string {
  return SUPPLIER_TYPES.find((t) => t.value === value)?.label ?? (value ?? "—");
}

function statusLabel(value?: string | null): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? (value ?? "—");
}

function statusBadgeClass(status?: string | null) {
  if (status === "ACTIVE") {
    return "rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success";
  }
  if (status === "BLACKLISTED") {
    return "rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger";
  }
  if (status === "INACTIVE") {
    return "rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground";
  }
  return "rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning";
}

/* ── Validadores ─────────────────────────────────────────────────────────── */

/** Limpia un RUT dejando solo dígitos + K (sin formato). */
function cleanRUT(value: string): string {
  return value.toUpperCase().replace(/[^0-9K]/g, "").slice(0, 9);
}

/** Formatea un RUT chileno: 12345678K → 12.345.678-K. */
function formatRUT(value: string): string {
  const clean = cleanRUT(value);
  if (clean.length <= 1) return clean;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}

/** Dígito verificador esperado para el cuerpo del RUT (módulo 11). */
function rutDV(body: string): string {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  if (res === 11) return "0";
  if (res === 10) return "K";
  return String(res);
}

/** Valida RUT chileno: cuerpo numérico de 7-8 dígitos y DV correcto. */
function isValidRUT(value: string): boolean {
  const clean = cleanRUT(value);
  if (clean.length < 8) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d{7,8}$/.test(body)) return false;
  return rutDV(body) === dv;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{7,15}$/;
const WEBSITE_RE = /^(https?:\/\/)?([\w-]+\.)+[a-záéíóúñ]{2,}(\/\S*)?$/i;

/* ── Avatar con iniciales ────────────────────────────────────────────────── */

const AVATAR_TONES = [
  "bg-primary/10 text-primary",
  "bg-success/10 text-success",
  "bg-warning/10 text-warning",
  "bg-danger/10 text-danger",
] as const;

function avatarTone(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function SupplierAvatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl font-semibold ${dims} ${avatarTone(name)}`}
      aria-hidden
    >
      {name.trim() ? initials(name) : <Truck className="h-4 w-4" />}
    </div>
  );
}

/* ── Formulario ──────────────────────────────────────────────────────────── */

const EMPTY_FORM: SupplierRequest = {
  name: "",
  business_name: "",
  tax_id: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  country: "",
  supplier_type: "WHOLESALE",
  status: "ACTIVE",
  website: "",
  notes: "",
};

/**
 * Construye el payload de creación/edición omitiendo campos opcionales
 * vacíos (el backend rechaza "" en email, website, etc.).
 */
function buildPayload(form: SupplierRequest): Partial<SupplierRequest> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(form)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "" && key !== "name" && key !== "tax_id") {
      continue;
    }
    payload[key] = value;
  }
  // El RUT se envía sin formato (el backend lo normaliza y valida duplicados).
  payload.tax_id = cleanRUT(form.tax_id);
  return payload as Partial<SupplierRequest>;
}

/** Errores por campo; solo se muestran si el campo fue tocado o hay intento de guardar. */
function validateForm(form: SupplierRequest) {
  const errors: Partial<Record<keyof SupplierRequest | "submit", string>> = {};
  if (!form.name.trim()) errors.name = "Ingresa el nombre del proveedor";
  if (!form.tax_id.trim()) {
    errors.tax_id = "Ingresa el RUT";
  } else if (!isValidRUT(form.tax_id)) {
    errors.tax_id = "RUT inválido (verifica el dígito verificador)";
  }
  if (form.email?.trim() && !EMAIL_RE.test(form.email.trim())) {
    errors.email = "Email inválido (ej: contacto@empresa.cl)";
  }
  if (form.phone?.trim() && !PHONE_RE.test(form.phone.trim())) {
    errors.phone = "Teléfono inválido (ej: +56 9 1234 5678)";
  }
  if (form.website?.trim() && !WEBSITE_RE.test(form.website.trim())) {
    errors.website = "Sitio web inválido (ej: https://empresa.cl)";
  }
  return errors;
}

type Touched = Partial<Record<keyof SupplierRequest, boolean>>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-danger">
      <CircleAlert className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="col-span-full flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </p>
  );
}

/* ── Página ──────────────────────────────────────────────────────────────── */

export default function SuppliersPage() {
  const queryClient = useQueryClient();
  const { download: downloadFile, isLoading: isDownloading } = useDownloadFile();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierList | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SupplierList | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [form, setForm] = useState<SupplierRequest>(EMPTY_FORM);
  const [touched, setTouched] = useState<Touched>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  // Contador para ignorar respuestas de detalle obsoletas: si el usuario cierra
  // el modal (o abre otro proveedor) antes de que termine el fetch, la respuesta
  // tardía no debe sobreescribir el formulario del modal actual.
  const detailRequestId = useRef(0);

  // Debounce de búsqueda para no disparar una request por tecla.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPageUrl({});
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: page, isLoading } = useQuery({
    queryKey: ["suppliers", { search, status, pageUrl }],
    queryFn: () => fetchSuppliers({ search, status, ...pageUrl }),
  });

  const { data: stats } = useQuery({
    queryKey: ["suppliers-stats"],
    queryFn: fetchSupplierStats,
    staleTime: 60_000,
  });

  const suppliers: SupplierList[] = page?.results ?? [];
  const totalSuppliers = page?.count ?? 0;

  async function handleExportExcel() {
    const headers = [
      "Nombre",
      "Razón social",
      "RUT",
      "Email",
      "Teléfono",
      "Ciudad",
      "Región",
      "Tipo",
      "Estado",
    ];
    const rows = suppliers.map((s) => [
      s.name,
      s.business_name ?? "",
      s.tax_id ?? "",
      s.email ?? "",
      s.phone ?? "",
      s.city ?? "",
      s.state ?? "",
      supplierTypeLabel(s.supplier_type),
      statusLabel(s.status),
    ]);
    const blob = await generateExcelBlob("Proveedores", headers, rows);
    await downloadFile(async () => ({ blob }), {
      filename: exportFilename("proveedores", "xlsx"),
      extension: "xlsx",
    });
  }

  const errors = useMemo(() => validateForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const showError = (field: keyof SupplierRequest) =>
    (touched[field] || submitAttempted ? errors[field] : undefined);

  const save = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form);
      if (editing) {
        await updateSupplier(editing.id, payload);
      } else {
        await createSupplier(payload as SupplierRequest);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-stats"] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers-stats"] });
      setConfirmDelete(null);
    },
  });

  async function openModal(supplier?: SupplierList) {
    const requestId = ++detailRequestId.current;
    save.reset();
    setEditing(supplier ?? null);
    setDetailError(null);
    setForm(EMPTY_FORM);
    setTouched({});
    setSubmitAttempted(false);
    setModalOpen(true);
    if (!supplier) return;
    // El listado no incluye website/notes: se carga el detalle para no
    // pisar esos campos al guardar.
    setDetailLoading(true);
    try {
      const detail = await fetchSupplier(supplier.id);
      if (requestId !== detailRequestId.current) return;
      setForm({
        name: detail.name,
        business_name: detail.business_name ?? "",
        tax_id: detail.tax_id,
        email: detail.email ?? "",
        phone: detail.phone ?? "",
        address: detail.address ?? "",
        city: detail.city ?? "",
        state: detail.state ?? "",
        country: detail.country ?? "",
        supplier_type: detail.supplier_type ?? "WHOLESALE",
        status: detail.status ?? "ACTIVE",
        website: detail.website ?? "",
        notes: detail.notes ?? "",
      });
    } catch (err) {
      if (requestId !== detailRequestId.current) return;
      setDetailError(err instanceof Error ? err.message : "Error al cargar el proveedor");
    } finally {
      if (requestId === detailRequestId.current) {
        setDetailLoading(false);
      }
    }
  }

  function closeModal() {
    detailRequestId.current += 1;
    save.reset();
    setModalOpen(false);
    setEditing(null);
    setDetailLoading(false);
    setDetailError(null);
  }

  function openConfirmDelete(supplier: SupplierList) {
    remove.reset();
    setConfirmDelete(supplier);
  }

  function updateFilter<T extends string>(setter: (v: T) => void, value: T) {
    setter(value);
    setPageUrl({});
  }

  function setField<K extends keyof SupplierRequest>(field: K, value: SupplierRequest[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (hasErrors) return;
    save.mutate();
  }

  const inactiveCount = Math.max(0, (stats?.total_suppliers ?? 0) - (stats?.active_suppliers ?? 0));

  return (
    <div className="flex min-h-full flex-col overflow-x-clip">
      <header className="flex flex-row items-center justify-between gap-3 border-b border-border px-4 py-3 md:items-start md:px-6">
        <div>
          <h1 className="text-lg font-semibold">Proveedores</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona proveedores y sus datos de contacto
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={handleExportExcel}
            disabled={isDownloading || suppliers.length === 0}
            className="md:hidden"
            title="Exportar Excel"
            aria-label="Exportar Excel"
          >
            <FileSpreadsheet className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            disabled={isDownloading || suppliers.length === 0}
            className="hidden md:flex"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Exportar Excel
          </Button>
          <Button
            size="icon"
            onClick={() => openModal()}
            className="md:hidden"
            title="Nuevo proveedor"
            aria-label="Nuevo proveedor"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => openModal()}
            className="hidden md:flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nuevo proveedor
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {!stats ? (
            <>
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </>
          ) : (
            <>
              <StatCard
                label="Total"
                value={stats.total_suppliers}
                icon={Truck}
                sub="proveedores registrados"
                tone="slate"
              />
              <StatCard
                label="Activos"
                value={stats.active_suppliers}
                icon={CheckCircle2}
                sub="disponibles para comprar"
                tone="success"
              />
              <StatCard
                label="Inactivos"
                value={inactiveCount}
                icon={PauseCircle}
                sub="inactivos / suspendidos / lista negra"
                tone="warning"
              />
              <StatCard
                label="Contactos"
                value={stats.total_contacts}
                icon={IdCard}
                sub="personas de contacto"
                tone="info"
              />
            </>
          )}
        </section>

        <div className="flex flex-col gap-3">
          {/* Desktop filters */}
          <div className="hidden flex-wrap items-end gap-3 md:flex">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar proveedor…"
                className="pl-9"
                aria-label="Buscar proveedor"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="filter-status" className="text-xs text-muted-foreground">Estado</label>
              <Select
                id="filter-status"
                value={status}
                onChange={(e) => updateFilter(setStatus, e.target.value)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Mobile filters */}
          <div className="flex flex-col gap-3 md:hidden">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Buscar proveedor…"
                  className="pl-9"
                  aria-label="Buscar proveedor"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 px-3"
                onClick={() => setShowMobileFilters((v) => !v)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="ml-2">Filtros</span>
              </Button>
            </div>

            <div className={`flex flex-col gap-3 ${showMobileFilters ? "" : "hidden"}`}>
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-status-mobile" className="text-xs text-muted-foreground">Estado</label>
                <Select
                  id="filter-status-mobile"
                  value={status}
                  onChange={(e) => updateFilter(setStatus, e.target.value)}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <div className="border-b border-border px-4 py-3">
              <Skeleton className="h-3 w-44" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0"
              >
                <Skeleton className="h-9 w-9 rounded-xl" />
                <Skeleton className="h-4 w-36" />
                <Skeleton className="hidden h-4 w-24 sm:block" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="ml-auto h-4 w-12" />
              </div>
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <Truck className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No se encontraron proveedores</p>
              <p className="text-xs text-muted-foreground">
                Prueba con otros filtros o agrega un nuevo proveedor.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table: el scroll horizontal queda solo como red de seguridad;
                las celdas truncan para que no sea necesario en pantallas normales. */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3">RUT</th>
                    <th className="px-4 py-3">Contacto</th>
                    <th className="px-4 py-3">Ubicación</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-border transition-colors last:border-0 hover:bg-muted/30"
                    >
                      <td className="max-w-0 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <SupplierAvatar name={s.name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{s.name}</p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              {s.business_name && s.business_name !== s.name && (
                                <span className="truncate">{s.business_name}</span>
                              )}
                              <span className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-medium">
                                {supplierTypeLabel(s.supplier_type)}
                              </span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                          <IdCard className="h-3.5 w-3.5 shrink-0" />
                          {formatRUT(s.tax_id)}
                        </span>
                      </td>
                      <td className="max-w-0 px-4 py-3 text-xs text-muted-foreground">
                        {s.email && (
                          <p className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{s.email}</span>
                          </p>
                        )}
                        {s.phone && (
                          <p className="mt-0.5 flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{s.phone}</span>
                          </p>
                        )}
                        {!s.email && !s.phone && "—"}
                      </td>
                      <td className="max-w-0 px-4 py-3 text-xs text-muted-foreground">
                        {(s.city || s.state) ? (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{[s.city, s.state].filter(Boolean).join(", ")}</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={statusBadgeClass(s.status)}>
                          {statusLabel(s.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            title="Editar"
                            aria-label={`Editar ${s.name}`}
                            onClick={() => openModal(s)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!s.is_self_supplier && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-danger hover:text-danger"
                              title="Eliminar"
                              aria-label={`Eliminar ${s.name}`}
                              onClick={() => openConfirmDelete(s)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden [&>*]:min-w-0">
              {suppliers.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-border bg-muted/30 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <SupplierAvatar name={s.name} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name}</p>
                        {s.business_name && s.business_name !== s.name && (
                          <p className="truncate text-xs text-muted-foreground">{s.business_name}</p>
                        )}
                        <span className={`mt-1 inline-flex ${statusBadgeClass(s.status)}`}>
                          {statusLabel(s.status)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        title="Editar"
                        aria-label="Editar"
                        onClick={() => openModal(s)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      {!s.is_self_supplier && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-danger hover:text-danger"
                          title="Eliminar"
                          aria-label="Eliminar"
                          onClick={() => openConfirmDelete(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-2 text-xs">
                    <div className="min-w-0 text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Tipo</span>
                      <span className="block truncate font-medium text-foreground">{supplierTypeLabel(s.supplier_type)}</span>
                    </div>
                    <div className="min-w-0 text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">RUT</span>
                      <span className="block truncate font-mono font-medium text-foreground">{formatRUT(s.tax_id)}</span>
                    </div>
                    {(s.email || s.phone) && (
                      <div className="col-span-2 min-w-0 text-muted-foreground">
                        <span className="block text-[10px] uppercase tracking-wide">Contacto</span>
                        {s.email && (
                          <p className="flex items-center gap-1.5 font-medium text-foreground">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{s.email}</span>
                          </p>
                        )}
                        {s.phone && (
                          <p className="mt-0.5 flex items-center gap-1.5 font-medium text-foreground">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{s.phone}</span>
                          </p>
                        )}
                      </div>
                    )}
                    {(s.city || s.state) && (
                      <div className="col-span-2 min-w-0 text-muted-foreground">
                        <span className="block text-[10px] uppercase tracking-wide">Ubicación</span>
                        <p className="flex items-center gap-1.5 font-medium text-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">{[s.city, s.state, s.country].filter(Boolean).join(", ")}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center justify-between gap-3 text-sm sm:flex-row">
              <p className="text-muted-foreground">
                {totalSuppliers} proveedor{totalSuppliers === 1 ? "" : "es"} en total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  <span className="sm:hidden">Ant.</span>
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPageUrl({ next: page?.next })}
                  disabled={!page?.next}
                >
                  <span className="sm:hidden">Sig.</span>
                  <span className="hidden sm:inline">Siguiente</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <AnimatedOverlay
        open={modalOpen}
        onClose={closeModal}
        zIndex="z-[60]"
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
        <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-xl md:rounded-xl md:border">
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-base font-semibold">{editing ? "Editar proveedor" : "Nuevo proveedor"}</h2>
            <button onClick={closeModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex flex-1 flex-col overflow-hidden"
            id="supplier-form"
            noValidate
          >
            <div className="flex-1 overflow-y-auto p-4">
              {detailLoading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-2">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-9 w-full" />
                    </div>
                  ))}
                </div>
              ) : detailError ? (
                <p className="text-sm text-danger">{detailError}</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Vista previa en vivo: la tarjeta del proveedor */}
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3 shadow-sm">
                    <SupplierAvatar name={form.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {form.name.trim() || "Nombre del proveedor"}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <IdCard className="h-3 w-3" />
                          {form.tax_id.trim() ? formatRUT(form.tax_id) : "RUT"}
                        </span>
                        {[form.city, form.country].filter(Boolean).length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {[form.city, form.country].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {supplierTypeLabel(form.supplier_type)}
                      </span>
                      <span className={statusBadgeClass(form.status)}>
                        {statusLabel(form.status)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
                    <SectionTitle>Identificación</SectionTitle>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="supplier-name" className="text-sm font-medium">Nombre</label>
                      <Input
                        id="supplier-name"
                        value={form.name}
                        onChange={(e) => setField("name", e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                        placeholder="Ej: Salsas Gourmet SpA"
                        required
                      />
                      <FieldError message={showError("name")} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="supplier-business" className="text-sm font-medium">Razón social</label>
                      <Input
                        id="supplier-business"
                        value={form.business_name}
                        onChange={(e) => setField("business_name", e.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="supplier-tax" className="text-sm font-medium">RUT</label>
                      <Input
                        id="supplier-tax"
                        value={formatRUT(form.tax_id)}
                        onChange={(e) => setField("tax_id", e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, tax_id: true }))}
                        placeholder="12.345.678-5"
                        inputMode="text"
                        required
                      />
                      <FieldError message={showError("tax_id")} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="supplier-type" className="text-sm font-medium">Tipo</label>
                      <Select
                        id="supplier-type"
                        value={form.supplier_type}
                        onChange={(e) => setField("supplier_type", e.target.value as SupplierRequest["supplier_type"])}
                      >
                        {SUPPLIER_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </Select>
                    </div>

                    <SectionTitle>Contacto</SectionTitle>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="supplier-email" className="text-sm font-medium">Email</label>
                      <Input
                        id="supplier-email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setField("email", e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                        placeholder="contacto@empresa.cl"
                      />
                      <FieldError message={showError("email")} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="supplier-phone" className="text-sm font-medium">Teléfono</label>
                      <Input
                        id="supplier-phone"
                        value={form.phone}
                        onChange={(e) => setField("phone", e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                        placeholder="+56 9 1234 5678"
                      />
                      <FieldError message={showError("phone")} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="supplier-website" className="text-sm font-medium">Sitio web</label>
                      <Input
                        id="supplier-website"
                        type="url"
                        value={form.website ?? ""}
                        onChange={(e) => setField("website", e.target.value)}
                        onBlur={() => setTouched((t) => ({ ...t, website: true }))}
                        placeholder="https://empresa.cl"
                      />
                      <FieldError message={showError("website")} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="supplier-address" className="text-sm font-medium">Dirección</label>
                      <Input
                        id="supplier-address"
                        value={form.address}
                        onChange={(e) => setField("address", e.target.value)}
                        placeholder="Calle y número"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="supplier-city" className="text-sm font-medium">Ciudad</label>
                      <Input
                        id="supplier-city"
                        value={form.city}
                        onChange={(e) => setField("city", e.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="supplier-state" className="text-sm font-medium">Región</label>
                      <Input
                        id="supplier-state"
                        value={form.state}
                        onChange={(e) => setField("state", e.target.value)}
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="supplier-country" className="text-sm font-medium">País</label>
                      <Input
                        id="supplier-country"
                        value={form.country}
                        onChange={(e) => setField("country", e.target.value)}
                        placeholder="Chile"
                      />
                    </div>

                    <SectionTitle>Comercial</SectionTitle>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="supplier-status" className="text-sm font-medium">Estado</label>
                      <Select
                        id="supplier-status"
                        value={form.status}
                        onChange={(e) => setField("status", e.target.value as SupplierRequest["status"])}
                      >
                        {STATUS_OPTIONS.filter((o) => o.value !== "").map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="supplier-notes" className="text-sm font-medium">Notas</label>
                      <textarea
                        id="supplier-notes"
                        value={form.notes ?? ""}
                        onChange={(e) => setField("notes", e.target.value)}
                        placeholder="Condiciones de despacho, horarios de atención, observaciones…"
                        rows={2}
                        className="w-full resize-none rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-ring/50"
                      />
                    </div>

                    {submitAttempted && hasErrors && (
                      <p className="flex items-center gap-1.5 text-sm text-danger sm:col-span-2">
                        <CircleAlert className="h-4 w-4 shrink-0" />
                        Revisa los campos marcados antes de guardar.
                      </p>
                    )}
                    {save.isError && (
                      <p className="text-sm text-danger sm:col-span-2">
                        {save.error instanceof Error ? save.error.message : "Error al guardar"}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
              <Button type="button" variant="outline" onClick={closeModal} disabled={save.isPending}>
                Cancelar
              </Button>
              <Button type="submit" isLoading={save.isPending} disabled={detailLoading}>
                Guardar
              </Button>
            </div>
          </form>
        </div>
      </AnimatedOverlay>

      {confirmDelete && (
        <AnimatedOverlay
          open={true}
          onClose={() => setConfirmDelete(null)}
          panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
        >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Eliminar proveedor?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDelete.name}</span>.
              Si tiene órdenes de compra asociadas, el sistema no permitirá eliminarlo.
            </p>
            {remove.isError && (
              <p className="mt-2 text-sm text-danger">
                {remove.error instanceof Error ? remove.error.message : "Error al eliminar"}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={remove.isPending}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => remove.mutate(confirmDelete.id)} isLoading={remove.isPending}>
                Eliminar
              </Button>
            </div>
          </div>
        </AnimatedOverlay>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
  tone?: "success" | "info" | "warning" | "danger" | "slate";
}) {
  const toneStyles = {
    success: "from-success/10 via-background to-background",
    info: "from-primary/10 via-background to-background",
    warning: "from-warning/10 via-background to-background",
    danger: "from-danger/10 via-background to-background",
    slate: "from-muted/50 via-background to-background",
  };
  const toneText = {
    success: "text-success",
    info: "text-primary",
    warning: "text-warning",
    danger: "text-danger",
    slate: "text-muted-foreground",
  };
  const toneIcon = {
    success: "bg-success/12 text-success",
    info: "bg-primary/12 text-primary",
    warning: "bg-warning/12 text-warning",
    danger: "bg-danger/12 text-danger",
    slate: "bg-muted text-muted-foreground",
  };

  return (
    <div className={`rounded-2xl border border-border/60 bg-gradient-to-br p-4 shadow-sm ${toneStyles[tone]}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className={`block text-[11px] font-medium uppercase tracking-wider ${toneText[tone]}`}>
            {label}
          </span>
          <p className="mt-1 break-words text-base font-bold tabular-nums tracking-tight text-foreground sm:text-lg lg:text-xl">{value}</p>
        </div>
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneIcon[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-muted/50 via-background to-background p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      <Skeleton className="h-3 w-20" />
    </div>
  );
}
