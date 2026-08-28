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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Select } from "@/components/ui/select";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { useCategoryOptions } from "@/lib/hooks/useCategoryOptions";
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
  publicMenuUrl,
  type PublicCatalog,
  type PublicCatalogPayload,
  type PublicCatalogSummary,
  type MenuMode,
  type StationType,
  type TargetAudience,
  type OrderType,
  type FontFamily,
} from "@/lib/api/public-catalog";
import { useCurrentBranch } from "@/lib/store/session";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";

const MENU_MODES: { value: MenuMode; label: string }[] = [
  { value: "VITRINA", label: "Solo vitrina" },
  { value: "ORDENAR", label: "Ordenar" },
  { value: "PAGAR", label: "Ordenar y pagar" },
];

const STATION_TYPES: { value: StationType; label: string }[] = [
  { value: "QR", label: "Menú QR" },
  { value: "POS", label: "Punto de venta" },
  { value: "PANTALLA", label: "Pantalla física" },
  { value: "GENERAL", label: "General" },
];

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

function emptyForm(): PublicCatalogPayload {
  return {
    title: "",
    description: "",
    slug: "",
    mode: "VITRINA",
    station_type: "QR",
    station: null,
    target_audience: "PUBLIC",
    order_type: "SALE",
    theme_color: "#1890ff",
    secondary_color: "#f0f0f0",
    show_prices: true,
    show_descriptions: true,
    show_categories: true,
    is_active: true,
    is_default: false,
    products: [],
    categories: [],
    font_family: "system",
    expires_at: null,
  };
}

function catalogToForm(catalog: PublicCatalog): PublicCatalogPayload {
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
    description: catalog.description,
    slug: catalog.slug,
    mode: catalog.mode ?? "VITRINA",
    station_type: catalog.station_type ?? "QR",
    station: catalog.station ?? null,
    target_audience: catalog.target_audience ?? "PUBLIC",
    order_type: catalog.order_type ?? "SALE",
    theme_color: catalog.theme_color ?? "#1890ff",
    secondary_color: catalog.secondary_color ?? "#f0f0f0",
    show_prices: catalog.show_prices ?? true,
    show_descriptions: catalog.show_descriptions ?? true,
    show_categories: catalog.show_categories ?? true,
    is_active: catalog.is_active ?? true,
    is_default: catalog.is_default ?? false,
    products,
    categories,
    font_family: catalog.font_family ?? "system",
    expires_at: catalog.expires_at ?? null,
  };
}

export default function MenusPage() {
  const queryClient = useQueryClient();
  const branch = useCurrentBranch();
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PublicCatalogSummary | null>(null);
  const [form, setForm] = useState<PublicCatalogPayload>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState<PublicCatalogSummary | null>(null);
  const [qrCatalog, setQrCatalog] = useState<PublicCatalogSummary | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const { data: catalogs = { count: 0, results: [] }, isLoading, error } = useQuery({
    queryKey: ["public-catalogs", search],
    queryFn: () => fetchPublicCatalogs(search || undefined),
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

  const createMutation = useMutation({
    mutationFn: createPublicCatalog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-catalogs"] });
      closeModal();
      toast.success("Menú creado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Error al crear el menú");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<PublicCatalogPayload> }) =>
      updatePublicCatalog(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["public-catalogs"] });
      closeModal();
      toast.success("Menú actualizado");
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
      toast.success("Menú eliminado");
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

    const payload: PublicCatalogPayload = {
      ...form,
      title: form.title.trim(),
      slug: form.slug.trim().toLowerCase(),
      description: form.description?.trim() || null,
      products: form.products ?? [],
      categories: form.categories ?? [],
      station: form.station ?? null,
      expires_at: form.expires_at || null,
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
    const url = `${window.location.origin}${publicMenuUrl(slug)}`;
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Link copiado al portapapeles");
    });
  }

  const filtered = catalogs.results;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Menús y vitrinas</h1>
          <p className="text-xs text-muted-foreground">
            Gestiona catálogos QR, pantallas y menús de sucursal
          </p>
        </div>
        <Button
          size="icon"
          onClick={() => openModal()}
          className="sm:hidden"
          title="Nuevo menú"
          aria-label="Nuevo menú"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          onClick={() => openModal()}
          className="hidden sm:flex"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo menú
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar menú…"
            className="pl-9"
            aria-label="Buscar menú"
          />
        </div>

        {error ? (
          <div className="rounded-lg border border-danger/20 bg-danger/10 p-4 text-sm text-danger">
            <p className="font-medium">No se pudieron cargar los menús.</p>
            {error instanceof Error && (
              <p className="mt-1 opacity-90">{error.message}</p>
            )}
            {(error as { status?: number }).status !== undefined && (
              <p className="mt-1 text-xs opacity-80">
                Código HTTP: {(error as { status?: number }).status}
              </p>
            )}
          </div>
        ) : isLoading ? (
          <TableSkeleton rows={5} columns={4} />
        ) : filtered.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <LayoutTemplate className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {search ? "No se encontraron menús" : "Aún no hay menús"}
              </p>
              <p className="text-xs text-muted-foreground">
                {search ? "Prueba con otro término de búsqueda." : "Crea tu primer menú QR o vitrina."}
              </p>
              {!search && (
                <Button className="mt-4" size="sm" onClick={() => openModal()}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Nuevo menú
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3">Menú</th>
                    <th className="px-4 py-3">Modo</th>
                    <th className="px-4 py-3">Estación</th>
                    <th className="px-4 py-3 text-center">Productos</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((catalog) => (
                    <tr key={catalog.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                            <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{catalog.title}</p>
                            <p className="text-xs text-muted-foreground">/{catalog.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {catalog.mode_display}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {catalog.station_type_display}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">
                        {catalog.product_count}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={cn(
                            "inline-flex rounded px-2 py-0.5 text-xs font-medium",
                            catalog.is_active
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-danger/10 text-danger",
                          )}
                        >
                          {catalog.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => copyLink(catalog.slug)}
                            title="Copiar link"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setQrCatalog(catalog)}
                            title="Generar QR"
                          >
                            <QrCode className="h-3.5 w-3.5" />
                          </Button>
                          <a
                            href={publicMenuUrl(catalog.slug)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Ver público"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => openModal(catalog)} title="Editar">
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-danger hover:text-danger"
                            onClick={() => setConfirmDelete(catalog)}
                            title="Eliminar"
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {filtered.map((catalog) => (
                <div
                  key={catalog.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary">
                        <LayoutTemplate className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{catalog.title}</p>
                        <p className="text-xs text-muted-foreground">/{catalog.slug}</p>
                        <span
                          className={cn(
                            "mt-1 inline-flex rounded px-2 py-0.5 text-[10px] font-medium",
                            catalog.is_active
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-danger/10 text-danger",
                          )}
                        >
                          {catalog.is_active ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => copyLink(catalog.slug)}
                        title="Copiar link"
                        aria-label="Copiar link"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        <span className="sr-only">Copiar link</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setQrCatalog(catalog)}
                        title="Generar QR"
                        aria-label="Generar QR"
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        <span className="sr-only">Generar QR</span>
                      </Button>
                      <a
                        href={publicMenuUrl(catalog.slug)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="Ver público"
                        aria-label="Ver público"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="sr-only">Ver público</span>
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => openModal(catalog)}
                        title="Editar"
                        aria-label="Editar"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-danger hover:text-danger"
                        onClick={() => setConfirmDelete(catalog)}
                        title="Eliminar"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Eliminar</span>
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Modo</span>
                      <span className="font-medium text-foreground">{catalog.mode_display}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Estación</span>
                      <span className="font-medium text-foreground">{catalog.station_type_display}</span>
                    </div>
                    <div className="text-muted-foreground">
                      <span className="block text-[10px] uppercase tracking-wide">Productos</span>
                      <span className="font-medium tabular-nums text-foreground">{catalog.product_count}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-sm text-muted-foreground">
              {catalogs.count} menú{catalogs.count === 1 ? "" : "s"} en total
            </p>
          </>
        )}
      </div>

      <AnimatedOverlay
        open={modalOpen}
        onClose={closeModal}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-xl md:border">
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
                  <div className="absolute inset-0 z-10 grid place-items-center bg-card/80">
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
                      placeholder="Ej: Menú Principal"
                      required
                    />
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

                  <div className="flex flex-col gap-2">
                    <label htmlFor="menu-mode" className="text-sm font-medium">
                      Modo
                    </label>
                    <Select
                      id="menu-mode"
                      value={form.mode}
                      onChange={(e) => setForm({ ...form, mode: e.target.value as MenuMode })}
                    >
                      {MENU_MODES.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </Select>
                  </div>

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
                      Si seleccionas categorías, solo se mostrarán productos de esas categorías.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 sm:col-span-2">
                    <label className="text-sm font-medium">Productos destacados</label>
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                      {products.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No hay productos para la venta.</p>
                      ) : (
                        [...products]
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
                                  <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
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
                      Si seleccionas productos, el menú se limitará a ellos. Si no seleccionas ninguno, se mostrarán solo los productos marcados como públicos.
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

      <AnimatedOverlay
        open={!!qrCatalog}
        onClose={() => setQrCatalog(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="flex h-auto w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:max-w-md md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3 md:px-6">
              <div>
                <h2 className="text-base font-semibold">Código QR</h2>
                <p className="text-xs text-muted-foreground">
                  Menú: <span className="font-medium text-foreground">{qrCatalog!.title}</span>
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
              <div className="rounded-xl border border-border bg-white p-3">
                <QRCodeSVG
                  value={`${window.location.origin}${publicMenuUrl(qrCatalog!.slug)}`}
                  size={256}
                  level="M"
                  includeMargin
                />
              </div>
              <a
                href={publicMenuUrl(qrCatalog!.slug)}
                target="_blank"
                rel="noreferrer"
                className="max-w-full truncate text-xs text-primary hover:underline"
              >
                {window.location.origin}{publicMenuUrl(qrCatalog!.slug)}
              </a>
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-4 md:px-6">
              <Button variant="outline" onClick={() => setQrCatalog(null)}>
                Cerrar
              </Button>
              <a
                href={`/menu/${qrCatalog!.slug}/totem`}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "default" }))}
              >
                Abrir tótem / imprimir
              </a>
            </div>
          </div>
      </AnimatedOverlay>

      <AnimatedOverlay
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Eliminar menú?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se eliminará <span className="font-medium text-foreground">{confirmDelete!.title}</span>. Esta
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
    </div>
  );
}
