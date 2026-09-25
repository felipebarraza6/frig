"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  QrCode,
  ExternalLink,
  Copy,
  X,
  LayoutTemplate,
  Store,
  ShoppingCart,
  ClipboardList,
  Monitor,
  Eye,
  Star,
  Package,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { useCategoryOptions } from "@/lib/hooks/useCategoryOptions";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { fetchProducts } from "@/lib/api/products";
import type { YggdraProduct } from "@/lib/api/types";

type MenuProduct = YggdraProduct & { is_public?: boolean };
import {
  fetchPublicCatalogs,
  fetchPublicCatalog,
  createPublicCatalog,
  updatePublicCatalog,
  deletePublicCatalog,
  fetchCashRegisterStations,
  publicMenuAbsoluteUrl,
  publicTotemAbsoluteUrl,
  modeLabel,
  stationTypeLabel,
  extractWhatsappFromDescription,
  stripWhatsappMarker,
  embedWhatsappInDescription,
  syncCatalogLogoFromUrl,
  type PublicCatalog,
  type PublicCatalogPayload,
  type PublicCatalogSummary,
  type MenuMode,
  type StationType,
  type TargetAudience,
  type OrderType,
  type FontFamily,
} from "@/lib/api/public-catalog";
import { fetchBranchTheme } from "@/lib/api/branches";
import { useCurrentBranch } from "@/lib/store/session";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";

const MENU_MODES: { value: MenuMode; label: string; hint: string; impact: string }[] = [
  {
    value: "VITRINA",
    label: "Vitrina",
    hint: "Solo exhibe la carta",
    impact: "Sin carrito ni pedidos. Ideal para menú del día o pantalla.",
  },
  {
    value: "ORDENAR",
    label: "Ordenar",
    hint: "Cliente arma pedido",
    impact: "Botón Agregar + envío por WhatsApp al local.",
  },
  {
    value: "PAGAR",
    label: "Ordenar y pagar",
    hint: "Pedido + cobro",
    impact: "Carrito + pagar online (Flow) o WhatsApp si Flow no está activo.",
  },
];

const STATION_TYPES: { value: StationType; label: string }[] = [
  { value: "QR", label: "Menú QR" },
  { value: "POS", label: "Punto de venta" },
  { value: "PANTALLA", label: "Pantalla física" },
  { value: "GENERAL", label: "General" },
];

function modeIcon(mode: MenuMode | string | undefined): LucideIcon {
  switch (mode) {
    case "VITRINA":
      return Store;
    case "ORDENAR":
      return ClipboardList;
    case "PAGAR":
      return ShoppingCart;
    default:
      return LayoutTemplate;
  }
}

function stationIcon(type: StationType | string | undefined): LucideIcon {
  switch (type) {
    case "QR":
      return QrCode;
    case "POS":
      return Monitor;
    case "PANTALLA":
      return Monitor;
    default:
      return LayoutTemplate;
  }
}

function modeBadgeClass(mode: MenuMode | string | undefined): string {
  switch (mode) {
    case "VITRINA":
      return "bg-sky-500/10 text-sky-800 ring-sky-500/20";
    case "ORDENAR":
      return "bg-amber-500/10 text-amber-800 ring-amber-500/20";
    case "PAGAR":
      return "bg-emerald-500/10 text-emerald-800 ring-emerald-500/20";
    default:
      return "bg-muted text-muted-foreground ring-border";
  }
}

const TARGET_AUDIENCES: { value: TargetAudience; label: string }[] = [
  { value: "PUBLIC", label: "Público general" },
  { value: "CUSTOMER", label: "Cliente específico" },
  { value: "MEMBER", label: "Miembro" },
];

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: "SALE", label: "Venta" },
  { value: "ORDER", label: "Pedido" },
  { value: "AGREEMENT", label: "Convenio" },
];

const FONT_FAMILIES: { value: FontFamily; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "serif", label: "Serif" },
  { value: "sans", label: "Sans-serif" },
  { value: "rounded", label: "Rounded" },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type MenuFormState = PublicCatalogPayload & { whatsapp?: string };

function emptyForm(): MenuFormState {
  return {
    title: "",
    description: "",
    slug: "",
    mode: "VITRINA",
    station_type: "QR",
    station: null,
    target_audience: "PUBLIC",
    order_type: "SALE",
    theme_color: "#2f6b3c",
    secondary_color: "#f2e8cf",
    show_prices: true,
    show_descriptions: true,
    show_categories: true,
    is_active: true,
    is_default: false,
    products: [],
    categories: [],
    font_family: "system",
    expires_at: null,
    whatsapp: "",
  };
}

function catalogToForm(catalog: PublicCatalog): MenuFormState {
  const products =
    catalog.products && catalog.products.length > 0
      ? catalog.products
      : (catalog.product_details?.map((p) => p.id) ?? []);
  const categories =
    catalog.categories && catalog.categories.length > 0
      ? catalog.categories
      : (catalog.category_details?.map((c) => c.id) ?? []);
  return {
    title: catalog.title,
    description: stripWhatsappMarker(catalog.description),
    slug: catalog.slug,
    mode: catalog.mode ?? "VITRINA",
    station_type: catalog.station_type ?? "QR",
    station: catalog.station ?? null,
    target_audience: catalog.target_audience ?? "PUBLIC",
    order_type: catalog.order_type ?? "SALE",
    theme_color: catalog.theme_color ?? "#2f6b3c",
    secondary_color: catalog.secondary_color ?? "#f2e8cf",
    show_prices: catalog.show_prices ?? true,
    show_descriptions: catalog.show_descriptions ?? true,
    show_categories: catalog.show_categories ?? true,
    is_active: catalog.is_active ?? true,
    is_default: catalog.is_default ?? false,
    products,
    categories,
    font_family: catalog.font_family ?? "system",
    expires_at: catalog.expires_at ?? null,
    whatsapp: extractWhatsappFromDescription(catalog.description) ?? "",
  };
}

export default function MenusPage() {
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [modeFilter, setModeFilter] = useState<string>("");
  const [stationFilter, setStationFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicCatalogSummary | null>(null);
  const [form, setForm] = useState<MenuFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState<PublicCatalogSummary | null>(null);
  const [qrCatalog, setQrCatalog] = useState<PublicCatalogSummary | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const { data: catalogs = { count: 0, results: [] }, isLoading, error } = useQuery({
    queryKey: ["public-catalogs", debouncedSearch],
    queryFn: () => fetchPublicCatalogs(debouncedSearch || undefined),
  });

  const { data: productsPage } = useQuery({
    queryKey: ["products", "all", "menus"],
    queryFn: () => fetchProducts({ is_for_sale: true, is_active: true, page_size: 1000 }),
  });

  // El servidor ya filtra is_for_sale/is_active (el refiltrado en cliente era
  // redundante y ocultaba productos si el listado paginaba).
  const products = useMemo<MenuProduct[]>(() => {
    return (productsPage?.results ?? []) as MenuProduct[];
  }, [productsPage]);

  const { options: categoryOptions = [] } = useCategoryOptions();

  const { data: stations = [] } = useQuery({
    queryKey: ["cash-register-stations", "list"],
    queryFn: fetchCashRegisterStations,
  });

  async function afterSaveSyncLogo(catalogId: number) {
    try {
      const theme = await fetchBranchTheme(String(branch?.branch_id ?? ""));
      if (theme?.logo) {
        const synced = await syncCatalogLogoFromUrl(catalogId, theme.logo);
        if (synced?.logo) {
          toast.success("Logo de sucursal aplicado al menú público");
        }
      }
    } catch {
      // Silencioso: el menú ya se guardó; el logo puede faltar en QR anónimo.
    }
  }

  const createMutation = useMutation({
    mutationFn: createPublicCatalog,
    onSuccess: async (created) => {
      await afterSaveSyncLogo(created.id);
      queryClient.invalidateQueries({ queryKey: ["public-catalogs"] });
      closeModal();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al crear el menú");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<PublicCatalogPayload> }) =>
      updatePublicCatalog(id, payload),
    onSuccess: async (_data, vars) => {
      await afterSaveSyncLogo(vars.id);
      queryClient.invalidateQueries({ queryKey: ["public-catalogs"] });
      closeModal();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al actualizar el menú");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePublicCatalog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-catalogs"] });
      setConfirmDelete(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al eliminar el menú");
    },
  });

  function openModal(catalog?: PublicCatalogSummary) {
    setEditing(catalog ?? null);
    setFormError(null);
    setForm(emptyForm());
    setLoadingCatalog(!!catalog);
    if (catalog) {
      fetchPublicCatalog(catalog.id)
        .then((full) => setForm(catalogToForm(full)))
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "No se pudo cargar el menú.");
          setForm(emptyForm());
        })
        .finally(() => setLoadingCatalog(false));
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
  }

  function toggleSelection(field: "products" | "categories", id: number) {
    setForm((prev) => {
      const list = prev[field] ?? [];
      const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      return { ...prev, [field]: next };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim()) {
      setFormError("El título es obligatorio.");
      return;
    }
    if (!form.slug.trim()) {
      setFormError("El slug es obligatorio.");
      return;
    }

    if (
      (form.mode === "ORDENAR" || form.mode === "PAGAR") &&
      !(form.whatsapp ?? "").trim()
    ) {
      setFormError("Para Ordenar / Pagar indica el WhatsApp del local (con código de país).");
      return;
    }

    const { whatsapp, ...rest } = form;
    const payload: PublicCatalogPayload = {
      ...rest,
      title: form.title.trim(),
      slug: form.slug.trim().toLowerCase(),
      description: embedWhatsappInDescription(form.description, whatsapp),
      products: form.products ?? [],
      categories: form.categories ?? [],
      station: form.station ?? null,
      expires_at: form.expires_at || null,
      target_audience: "PUBLIC",
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, payload });
    } else {
      createMutation.mutate({ ...payload, branch: Number(branch?.branch_id ?? 0) });
    }
  }

  function handleDelete() {
    if (confirmDelete) deleteMutation.mutate(confirmDelete.id);
  }

  function copyLink(slug: string) {
    const url = publicMenuAbsoluteUrl(slug);
    void navigator.clipboard.writeText(url).then(
      () => toast.success("Link copiado. Ábrelo en el navegador para ver el menú."),
      () => toast.error("No se pudo copiar el link."),
    );
  }

  function openInBrowser(slug: string) {
    window.open(publicMenuAbsoluteUrl(slug), "_blank", "noopener,noreferrer");
  }

  function openTotemInBrowser(slug: string) {
    window.open(publicTotemAbsoluteUrl(slug), "_blank", "noopener,noreferrer");
  }

  const filtered = useMemo(() => {
    return catalogs.results.filter((c) => {
      if (modeFilter && c.mode !== modeFilter) return false;
      if (stationFilter && c.station_type !== stationFilter) return false;
      if (statusFilter === "active" && !c.is_active) return false;
      if (statusFilter === "inactive" && c.is_active) return false;
      return true;
    });
  }, [catalogs.results, modeFilter, stationFilter, statusFilter]);

  const stats = useMemo(() => {
    const all = catalogs.results;
    return {
      total: catalogs.count,
      active: all.filter((c) => c.is_active).length,
      vitrinas: all.filter((c) => c.mode === "VITRINA").length,
      orderables: all.filter((c) => c.mode === "ORDENAR" || c.mode === "PAGAR").length,
    };
  }, [catalogs]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const hasClientFilters = Boolean(modeFilter || stationFilter || statusFilter);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
      <PageHeader
        title="Menús y vitrinas"
        icon={<Store className="h-5 w-5" />}
        subtitle="Cartas digitales, QR y pantallas. Ábrelas siempre en el navegador para gestionarlas y verlas como el cliente."
        actions={
          <>
            <Button
              size="icon"
              onClick={() => openModal()}
              className="sm:hidden"
              title="Nuevo menú"
              aria-label="Nuevo menú"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={() => openModal()} className="hidden sm:flex">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo menú
            </Button>
          </>
        }
      />

      <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total" value={stats.total} icon={LayoutTemplate} sub="menús / vitrinas" />
          <StatCard label="Activos" value={stats.active} icon={Eye} sub="visibles al público" />
          <StatCard label="Vitrinas" value={stats.vitrinas} icon={Store} sub="solo exhibición" />
          <StatCard
            label="Con pedido"
            value={stats.orderables}
            icon={ShoppingCart}
            sub="ordenar / pagar"
          />
        </section>

        {/* Desktop filters */}
        <div className="hidden flex-wrap items-end gap-3 md:flex">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título o slug…"
              className="pl-9"
              aria-label="Buscar menú"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-mode" className="text-xs text-muted-foreground">
              Modo
            </label>
            <Select
              id="filter-mode"
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
            >
              <option value="">Todos</option>
              {MENU_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-station" className="text-xs text-muted-foreground">
              Estación
            </label>
            <Select
              id="filter-station"
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
            >
              <option value="">Todas</option>
              {STATION_TYPES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-status" className="text-xs text-muted-foreground">
              Estado
            </label>
            <Select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </Select>
          </div>
        </div>

        {/* Mobile filters */}
        <div className="flex flex-col gap-3 md:hidden">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar menú…"
                className="pl-9"
                aria-label="Buscar menú"
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
          {showMobileFilters && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Modo</label>
                <Select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)}>
                  <option value="">Todos</option>
                  {MENU_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Estación</label>
                <Select value={stationFilter} onChange={(e) => setStationFilter(e.target.value)}>
                  <option value="">Todas</option>
                  {STATION_TYPES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">Estado</label>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </Select>
              </div>
            </div>
          )}
        </div>

        {error ? (
          <div className="rounded-lg border border-danger/20 bg-danger/10 p-4 text-sm text-danger">
            <p className="font-medium">No se pudieron cargar los menús.</p>
            {error instanceof Error && <p className="mt-1 opacity-90">{error.message}</p>}
          </div>
        ) : isLoading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : filtered.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <Store className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {search || hasClientFilters ? "No se encontraron menús" : "Aún no hay menús"}
              </p>
              <p className="text-xs text-muted-foreground">
                {search || hasClientFilters
                  ? "Prueba con otros filtros o busca por título."
                  : "Crea un menú o vitrina (por ejemplo “Menú del día”) y ábrelo en el navegador."}
              </p>
              {!search && !hasClientFilters && (
                <Button className="mt-4" size="sm" onClick={() => openModal()}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Nuevo menú
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop cards grid — más claro que tabla densa para modos/iconos */}
            <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((catalog) => {
                const ModeIcon = modeIcon(catalog.mode);
                const StationIcon = stationIcon(catalog.station_type);
                return (
                  <article
                    key={catalog.id}
                    className="flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                          modeBadgeClass(catalog.mode),
                        )}
                      >
                        <ModeIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h3 className="truncate text-sm font-semibold">{catalog.title}</h3>
                          {catalog.is_default && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              <Star className="h-2.5 w-2.5" />
                              Default
                            </span>
                          )}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">/{catalog.slug}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                              modeBadgeClass(catalog.mode),
                            )}
                          >
                            <ModeIcon className="h-3 w-3" />
                            {catalog.mode_display || modeLabel(catalog.mode)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
                            <StationIcon className="h-3 w-3" />
                            {catalog.station_type_display || stationTypeLabel(catalog.station_type)}
                          </span>
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              catalog.is_active
                                ? "bg-success/10 text-success"
                                : "bg-danger/10 text-danger",
                            )}
                          >
                            {catalog.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-border/60 bg-background px-2.5 py-2">
                        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          <Package className="h-3 w-3" /> Productos
                        </span>
                        <p className="mt-0.5 font-semibold tabular-nums">{catalog.product_count}</p>
                      </div>
                      <div className="rounded-lg border border-border/60 bg-background px-2.5 py-2">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Categorías
                        </span>
                        <p className="mt-0.5 font-semibold tabular-nums">
                          {catalog.category_count ?? 0}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => openInBrowser(catalog.slug)}
                        >
                          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                          Abrir en navegador
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => openTotemInBrowser(catalog.slug)}
                          title="Abrir vista tótem / pantalla"
                        >
                          <Monitor className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => copyLink(catalog.slug)}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copiar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => setQrCatalog(catalog)}
                        >
                          <QrCode className="mr-1 h-3.5 w-3.5" />
                          QR
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => openModal(catalog)}
                        >
                          <Pencil className="mr-1 h-3.5 w-3.5" />
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-danger hover:text-danger"
                          onClick={() => setConfirmDelete(catalog)}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {filtered.map((catalog) => {
                const ModeIcon = modeIcon(catalog.mode);
                const StationIcon = stationIcon(catalog.station_type);
                return (
                  <div
                    key={catalog.id}
                    className="rounded-2xl border border-border bg-background p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                          modeBadgeClass(catalog.mode),
                        )}
                      >
                        <ModeIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate font-medium">{catalog.title}</p>
                          {catalog.is_default && (
                            <Star className="h-3 w-3 shrink-0 text-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">/{catalog.slug}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                              modeBadgeClass(catalog.mode),
                            )}
                          >
                            {catalog.mode_display || modeLabel(catalog.mode)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            <StationIcon className="h-3 w-3" />
                            {catalog.station_type_display || stationTypeLabel(catalog.station_type)}
                          </span>
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium",
                              catalog.is_active
                                ? "bg-success/10 text-success"
                                : "bg-danger/10 text-danger",
                            )}
                          >
                            {catalog.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide">Productos</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {catalog.product_count}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase tracking-wide">Categorías</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {catalog.category_count ?? 0}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                      <Button size="sm" className="w-full" onClick={() => openInBrowser(catalog.slug)}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Abrir en navegador
                      </Button>
                      <div className="flex items-center justify-between gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 flex-1"
                          onClick={() => openTotemInBrowser(catalog.slug)}
                        >
                          <Monitor className="mr-1 h-3.5 w-3.5" />
                          Tótem
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => copyLink(catalog.slug)}
                          aria-label="Copiar link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => setQrCatalog(catalog)}
                          aria-label="QR"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => openModal(catalog)}
                          aria-label="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-danger hover:text-danger"
                          onClick={() => setConfirmDelete(catalog)}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-sm text-muted-foreground">
              {filtered.length} menú{filtered.length === 1 ? "" : "s"}
              {hasClientFilters || search ? " filtrados" : ""} · {catalogs.count} en total
            </p>
          </>
        )}
      </div>

      <AnimatedOverlay
        open={modalOpen}
        onClose={closeModal}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 md:px-6 md:py-4">
              <h2 className="text-base font-semibold">
                {editing ? "Editar menú" : "Nuevo menú"}
              </h2>
              <button
                onClick={closeModal}
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="relative flex-1 overflow-y-auto p-4 md:p-6">
                {loadingCatalog && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-background/80">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label htmlFor="menu-title" className="text-sm font-medium">
                      Título
                    </label>
                    <Input
                      id="menu-title"
                      value={form.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setForm((prev) => ({
                          ...prev,
                          title,
                          slug: editing ? prev.slug : slugify(title),
                        }));
                      }}
                      placeholder="Ej: Menú del día, Carta principal, Vitrina postres…"
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">
                      El nombre es libre: puedes crear varios menús (del día, fin de semana, etc.).
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="menu-slug" className="text-sm font-medium">
                      Slug (URL)
                    </label>
                    <Input
                      id="menu-slug"
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                      placeholder="menu-principal"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="text-sm font-medium">Modo del menú público</label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {MENU_MODES.map((m) => {
                        const selected = form.mode === m.value;
                        const Icon = modeIcon(m.value);
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setForm({ ...form, mode: m.value })}
                            className={cn(
                              "rounded-xl border p-3 text-left transition-colors",
                              selected
                                ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                                : "border-border hover:bg-muted/40",
                            )}
                          >
                            <span className="flex items-center gap-2 text-sm font-semibold">
                              <Icon className="h-4 w-4" />
                              {m.label}
                            </span>
                            <p className="mt-1 text-[11px] text-muted-foreground">{m.hint}</p>
                            <p className="mt-1 text-[10px] leading-snug text-muted-foreground/90">
                              {m.impact}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {(form.mode === "ORDENAR" || form.mode === "PAGAR") && (
                    <div className="flex flex-col gap-2 sm:col-span-2">
                      <label htmlFor="menu-whatsapp" className="text-sm font-medium">
                        WhatsApp del local (pedidos)
                      </label>
                      <Input
                        id="menu-whatsapp"
                        value={form.whatsapp ?? ""}
                        onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                        placeholder="Ej: +56912345678"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Se usa en el menú público para enviar el pedido. Incluye código de país.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    <label htmlFor="menu-station-type" className="text-sm font-medium">
                      Tipo de estación
                    </label>
                    <Select
                      id="menu-station-type"
                      value={form.station_type}
                      onChange={(e) =>
                        setForm({ ...form, station_type: e.target.value as StationType })
                      }
                    >
                      {STATION_TYPES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="menu-station" className="text-sm font-medium">
                      Estación asignada
                    </label>
                    <Select
                      id="menu-station"
                      value={form.station ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, station: e.target.value ? Number(e.target.value) : null })
                      }
                    >
                      <option value="">Ninguna</option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="menu-audience" className="text-sm font-medium">
                      Audiencia
                    </label>
                    <Select
                      id="menu-audience"
                      value={form.target_audience}
                      onChange={(e) =>
                        setForm({ ...form, target_audience: e.target.value as TargetAudience })
                      }
                    >
                      {TARGET_AUDIENCES.map((a) => (
                        <option key={a.value} value={a.value}>
                          {a.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="menu-order-type" className="text-sm font-medium">
                      Tipo de orden
                    </label>
                    <Select
                      id="menu-order-type"
                      value={form.order_type}
                      onChange={(e) =>
                        setForm({ ...form, order_type: e.target.value as OrderType })
                      }
                    >
                      {ORDER_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="menu-font" className="text-sm font-medium">
                      Tipografía
                    </label>
                    <Select
                      id="menu-font"
                      value={form.font_family}
                      onChange={(e) =>
                        setForm({ ...form, font_family: e.target.value as FontFamily })
                      }
                    >
                      {FONT_FAMILIES.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="menu-expires" className="text-sm font-medium">
                      Expira el
                    </label>
                    <Input
                      id="menu-expires"
                      type="datetime-local"
                      value={form.expires_at?.slice(0, 16) ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, expires_at: e.target.value ? e.target.value : null })
                      }
                    />
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label htmlFor="menu-description" className="text-sm font-medium">
                      Descripción
                    </label>
                    <Input
                      id="menu-description"
                      value={form.description ?? ""}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="menu-theme" className="text-sm font-medium">
                      Color del tema
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="menu-theme"
                        type="color"
                        value={form.theme_color}
                        onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
                        className="h-10 w-16 p-1"
                      />
                      <Input
                        value={form.theme_color}
                        onChange={(e) => setForm({ ...form, theme_color: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="menu-secondary" className="text-sm font-medium">
                      Color secundario
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="menu-secondary"
                        type="color"
                        value={form.secondary_color}
                        onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                        className="h-10 w-16 p-1"
                      />
                      <Input
                        value={form.secondary_color}
                        onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.show_prices}
                        onChange={(e) => setForm({ ...form, show_prices: e.target.checked })}
                        className="h-4 w-4 rounded border-border"
                      />
                      Mostrar precios
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.show_descriptions}
                        onChange={(e) =>
                          setForm({ ...form, show_descriptions: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      Mostrar descripciones
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.show_categories}
                        onChange={(e) =>
                          setForm({ ...form, show_categories: e.target.checked })
                        }
                        className="h-4 w-4 rounded border-border"
                      />
                      Mostrar categorías
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.is_default}
                        onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                        className="h-4 w-4 rounded border-border"
                      />
                      Menú por defecto
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.is_active}
                        onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                        className="h-4 w-4 rounded border-border"
                      />
                      Activo
                    </label>
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="text-sm font-medium">Categorías incluidas</label>
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2">
                      {categoryOptions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay categorías.</p>
                      ) : (
                        categoryOptions.map((c) => (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
                          >
                            <input
                              type="checkbox"
                              checked={(form.categories ?? []).includes(c.id)}
                              onChange={() => toggleSelection("categories", c.id)}
                              className="h-4 w-4 rounded border-border"
                            />
                            <span className="text-sm">{c.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Con categoría (p. ej. Bowls) el menú público incluye los productos de esa
                      categoría. También puedes marcar productos sueltos abajo.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="text-sm font-medium">
                      Productos
                      {(form.categories?.length ?? 0) > 0 && (
                        <span className="ml-2 font-normal text-muted-foreground">
                          (filtrados por categoría seleccionada)
                        </span>
                      )}
                    </label>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                      {products.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay productos para la venta.</p>
                      ) : (
                        [...products]
                          .filter((p) => {
                            const cats = form.categories ?? [];
                            if (cats.length === 0) return true;
                            const catId =
                              p.category && typeof p.category === "object"
                                ? (p.category as { id?: number }).id
                                : typeof p.category === "number"
                                  ? p.category
                                  : null;
                            return catId != null && cats.includes(catId);
                          })
                          .sort((a, b) => Number(b.is_public) - Number(a.is_public))
                          .map((p) => (
                            <label
                              key={p.id}
                              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted"
                            >
                              <input
                                type="checkbox"
                                checked={(form.products ?? []).includes(p.id)}
                                onChange={() => toggleSelection("products", p.id)}
                                className="h-4 w-4 rounded border-border"
                              />
                              <span className="text-sm">{p.name}</span>
                              <span className="ml-auto flex items-center gap-2">
                                {!p.is_public && (
                                  <span className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                                    No público
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {p.category && typeof p.category === "object" ? p.category.name : "—"}
                                </span>
                              </span>
                            </label>
                          ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Si marcas productos aquí, el menú usa esa lista. Si dejas vacío y solo eliges
                      categorías, salen los de esas categorías. Sin ambos, salen los marcados como públicos.
                    </p>
                  </div>
                </div>

                {formError && <p className="mt-4 text-sm text-danger">{formError}</p>}
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-4 md:px-6">
                <Button type="button" variant="outline" onClick={closeModal} disabled={isSaving}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={isSaving}>
                  Guardar
                </Button>
              </div>
            </form>
          </div>
      </AnimatedOverlay>

{qrCatalog && (
      <AnimatedOverlay
        open={true}
        onClose={() => setQrCatalog(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-auto w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-background shadow-lg md:max-w-md md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 md:px-6">
              <div>
                <h2 className="text-base font-semibold">Código QR</h2>
                <p className="text-xs text-muted-foreground">
                  Menú: <span className="font-medium text-foreground">{qrCatalog.title}</span>
                </p>
              </div>
              <button
                onClick={() => setQrCatalog(null)}
                aria-label="Cerrar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 overflow-y-auto p-4 md:p-6">
              <div className="rounded-2xl border border-border bg-background p-3">
                <QRCodeSVG
                  value={publicMenuAbsoluteUrl(qrCatalog.slug)}
                  size={256}
                  level="M"
                  includeMargin
                />
              </div>
              <button
                type="button"
                onClick={() => openInBrowser(qrCatalog.slug)}
                className="max-w-full truncate text-xs text-primary hover:underline"
              >
                {publicMenuAbsoluteUrl(qrCatalog.slug)}
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                Escanea el QR o ábrelo en el navegador para verlo como el cliente.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 border-t border-border px-4 py-4 sm:flex-row sm:justify-end md:px-6">
              <Button variant="outline" onClick={() => setQrCatalog(null)} className="w-full sm:w-auto">
                Cerrar
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => copyLink(qrCatalog.slug)}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copiar link
              </Button>
              <Button
                className="w-full sm:w-auto"
                onClick={() => openInBrowser(qrCatalog.slug)}
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Abrir en navegador
              </Button>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => openTotemInBrowser(qrCatalog.slug)}
              >
                <Monitor className="mr-1.5 h-3.5 w-3.5" />
                Vista tótem
              </Button>
            </div>
          </div>
      </AnimatedOverlay>
)}

{confirmDelete && (
      <AnimatedOverlay
        open={true}
        onClose={() => setConfirmDelete(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-background p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Eliminar menú?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDelete.title}</span>. Esta
              acción no se puede deshacer.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setConfirmDelete(null)}
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </Button>
              <Button variant="danger" onClick={handleDelete} isLoading={deleteMutation.isPending}>
                Eliminar
              </Button>
            </div>
          </div>
      </AnimatedOverlay>
)}
    </div>
  );
}
