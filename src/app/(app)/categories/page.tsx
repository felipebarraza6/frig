"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Pencil, Trash2, Tag, X, Copy, FolderOpen, Boxes, Folder } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { AnimatedOverlay } from "@/components/ui/animated-overlay";
import { useToast } from "@/lib/store/toast";
import { useCurrentBranch } from "@/lib/store/session";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  type CategoriesFilter,
} from "@/lib/api/categories";
import type { YggdraCategory } from "@/lib/api/types";

function categoryTypeLabel(type?: string | null) {
  switch (type) {
    case "FOOD":
      return "Alimentos";
    case "DRINK":
      return "Bebidas";
    case "RETAIL":
      return "Retail";
    case "SERVICE":
      return "Servicio";
    case "OTHER":
      return "General";
    default:
      return type ?? "General";
  }
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const branch = useCurrentBranch();
  const [search, setSearch] = useState("");
  const [pageUrl, setPageUrl] = useState<{ next?: string | null; previous?: string | null }>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<YggdraCategory | null>(null);
  const [name, setName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<YggdraCategory | null>(null);

  const filter = useMemo<CategoriesFilter>(
    () => ({
      search: search || undefined,
      ...pageUrl,
    }),
    [search, pageUrl],
  );

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["categories", "manage", filter],
    queryFn: () => fetchCategories(filter),
  });

  const categories = useMemo(() => page?.results ?? [], [page]);
  const totalCategories = page?.count ?? 0;
  const totalProducts = useMemo(
    () => categories.reduce((sum, c) => sum + Number(c.product_count ?? 0), 0),
    [categories],
  );

  const save = useMutation({
    mutationFn: async () => {
      const branchId = branch?.branch_id;
      if (!branchId) {
        throw new Error("No se detectó la sucursal activa. Selecciona una sucursal e intenta de nuevo.");
      }
      const payload = { name, branch_id: Number(branchId) };
      if (editing) {
        await updateCategory(editing.id, payload);
      } else {
        await createCategory(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      closeModal();
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setConfirmDelete(null);
    },
  });

  const duplicate = useMutation({
    mutationFn: (category: YggdraCategory) => {
      const branchId = branch?.branch_id;
      if (!branchId) {
        throw new Error("No se detectó la sucursal activa.");
      }
      return createCategory({ name: `${category.name} (copia)`, branch_id: Number(branchId) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categoría duplicada");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar la categoría.");
    },
  });

  function openModal(category?: YggdraCategory) {
    setEditing(category ?? null);
    setName(category?.name ?? "");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setName("");
  }

  const hasData = categories.length > 0;

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <h1 className="text-lg font-semibold">Categorías</h1>
          <p className="text-xs text-muted-foreground">
            Agrupa y organiza tus productos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            onClick={() => openModal()}
            className="sm:hidden"
            title="Nueva categoría"
            aria-label="Nueva categoría"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => openModal()}
            className="hidden sm:flex"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nueva categoría
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageUrl({});
            }}
            placeholder="Buscar categoría…"
            className="pl-9"
            aria-label="Buscar categoría"
          />
        </div>

        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar las categorías.</p>
        ) : isLoading ? (
          <div className="flex-1 py-8">
            <TableSkeleton rows={5} columns={3} />
          </div>
        ) : !hasData ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <FolderOpen className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">
                {search ? "Sin resultados" : "Aún no hay categorías"}
              </p>
              <p className="text-xs text-muted-foreground">
                {search
                  ? "Prueba con otro término de búsqueda."
                  : "Crea la primera categoría para organizar tu catálogo."}
              </p>
              {!search && (
                <Button className="mt-4" size="sm" onClick={() => openModal()}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Crear categoría
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Resumen */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Folder className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Categorías</p>
                  <p className="text-lg font-semibold leading-none">{totalCategories}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/30 p-3 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <Boxes className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Productos asignados</p>
                  <p className="text-lg font-semibold leading-none">{totalProducts}</p>
                </div>
              </div>
            </div>

            {/* Vista tabla para desktop */}
            <div className="hidden overflow-x-auto rounded-xl border border-border shadow-sm sm:block">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Categoría</th>
                    <th className="px-4 py-3 text-center">Tipo</th>
                    <th className="px-4 py-3 text-center">Productos</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categories.map((c) => {
                    const count = Number(c.product_count ?? 0);
                    return (
                      <tr
                        key={c.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                              <Tag className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <span className="font-medium">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex rounded-md border border-border/60 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            {categoryTypeLabel(c.category_type)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            <Boxes className="h-3 w-3" />
                            {count} producto{count === 1 ? "" : "s"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openModal(c)}
                            >
                              <Pencil className="mr-1.5 h-3.5 w-3.5" />
                              Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => duplicate.mutate(c)}
                              disabled={duplicate.isPending}
                            >
                              <Copy className="mr-1.5 h-3.5 w-3.5" />
                              Duplicar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-danger hover:text-danger"
                              onClick={() => setConfirmDelete(c)}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Eliminar
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Vista de cards — solo móvil */}
            <div className="grid grid-cols-1 gap-4 sm:hidden">
              {categories.map((c) => {
                const count = Number(c.product_count ?? 0);
                return (
                  <div
                    key={c.id}
                    className="flex min-w-0 flex-col rounded-2xl border border-border bg-muted/30 p-4 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                          <Tag className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {categoryTypeLabel(c.category_type)}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Editar"
                          aria-label="Editar"
                          onClick={() => openModal(c)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          <span className="sr-only">Editar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Duplicar"
                          aria-label="Duplicar"
                          onClick={() => duplicate.mutate(c)}
                          disabled={duplicate.isPending}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          <span className="sr-only">Duplicar</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-danger hover:text-danger"
                          title="Eliminar"
                          aria-label="Eliminar"
                          onClick={() => setConfirmDelete(c)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Eliminar</span>
                        </Button>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                      <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        <Boxes className="h-3.5 w-3.5" />
                        {count} producto{count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-muted-foreground">
                {totalCategories} categoría{totalCategories === 1 ? "" : "s"} en total
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1 sm:h-9 sm:flex-none"
                  onClick={() => setPageUrl({ previous: page?.previous })}
                  disabled={!page?.previous}
                >
                  <span className="sm:hidden">Ant.</span>
                  <span className="hidden sm:inline">Anterior</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 flex-1 sm:h-9 sm:flex-none"
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
          <div className="flex h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl border-x border-t border-border bg-card shadow-lg md:h-auto md:max-h-[90vh] md:max-w-md md:rounded-xl md:border">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold">
                {editing ? "Editar categoría" : "Nueva categoría"}
              </h2>
              <button onClick={closeModal} aria-label="Cerrar" className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
              }}
              className="flex flex-1 flex-col overflow-hidden"
              id="category-form"
            >
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="category-name" className="text-sm font-medium">Nombre</label>
                    <Input
                      id="category-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="Ej: Helados"
                    />
                  </div>
                  {save.isError && (
                    <p className="text-sm text-danger">
                      {save.error instanceof Error ? save.error.message : "Error al guardar"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
                <Button type="button" variant="outline" onClick={closeModal} disabled={save.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" isLoading={save.isPending}>
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
        zIndex="z-[60]"
        panelClassName="flex items-end justify-center overflow-hidden p-0 md:items-center md:p-4"
      >
          <div className="w-full rounded-t-xl border-x border-t border-border bg-card p-4 shadow-lg md:max-w-md md:rounded-xl md:border md:p-6">
            <h2 className="text-base font-semibold">¿Eliminar categoría?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Se desactivará <span className="font-medium text-foreground">{confirmDelete.name}</span>. Los productos asociados no se eliminan.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={remove.isPending}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => remove.mutate(confirmDelete.id)}
                isLoading={remove.isPending}
              >
                Eliminar
              </Button>
            </div>
          </div>
      </AnimatedOverlay>
)}
    </div>
  );
}
