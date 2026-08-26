"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Pencil, Eye, Settings, Table } from "lucide-react";
import Link from "next/link";
import { fetchTables, updateTable } from "@/lib/api/tables";
import { TablesCanvas } from "@/components/tables/tables-canvas";
import { TableOrderDrawer } from "@/components/tables/table-order-drawer";
import { useCanManageTables, useIsWaiter } from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { cn } from "@/lib/utils";
import type { YggdraSchemas } from "@/lib/api/types";

type TableItem = YggdraSchemas["Table"];

export default function TablesMapPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const canManage = useCanManageTables();
  const isWaiter = useIsWaiter();
  // Los meseros siempre están en modo vista; gestión puede alternar.
  const [editMode, setEditMode] = useState(false);
  const [inspectedTable, setInspectedTable] = useState<TableItem | null>(null);
  const mode = isWaiter ? "select" : editMode ? "edit" : "select";

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["tables", "map"],
    queryFn: () => fetchTables({ page_size: 200 }),
    refetchInterval: 15_000,
  });

  const tables = useMemo(() => page?.results ?? [], [page]);

  const moveMutation = useMutation({
    mutationFn: ({ id, x, y }: { id: number; x: number; y: number }) =>
      updateTable(id, { x_position: x, y_position: y }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables", "map"] });
    },
    onError: () => {
      toast.error("No se pudo guardar la posición de la mesa");
    },
  });

  function handleMove(id: number, x: number, y: number) {
    moveMutation.mutate({ id, x, y });
  }

  function handleSelect(table: TableItem) {
    // En el mapa de gestión abrimos el drawer para administrar la mesa.
    setInspectedTable(table);
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-col gap-3 border-b border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/tables"
            className="inline-flex items-center gap-1 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Volver a mesas"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">Mapa de mesas</h1>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {mode === "edit"
                ? "Arrastra las mesas para ajustar su posición. Se guarda automáticamente."
                : "Toca una mesa para ver su orden o crear un pedido."}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {moveMutation.isPending && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Guardando…
            </span>
          )}
          {canManage && (
            <>
              <Link
                href="/tables"
                className="inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-background px-0 text-xs font-medium text-foreground transition-colors hover:bg-muted sm:w-auto sm:px-2.5"
                title="Gestionar mesas"
                aria-label="Gestionar mesas"
              >
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">Gestionar</span>
              </Link>
              <button
                type="button"
                onClick={() => setEditMode((v) => !v)}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center gap-1.5 rounded-lg border px-0 text-xs font-medium transition-colors sm:w-auto sm:px-2.5",
                  editMode
                    ? "border-primary bg-primary text-white"
                    : "border-border/60 bg-background text-foreground hover:bg-muted",
                )}
                title={editMode ? "Ver mapa" : "Mover mesas"}
                aria-label={editMode ? "Ver mapa" : "Mover mesas"}
                aria-pressed={editMode}
              >
                {editMode ? (
                  <>
                    <Eye className="h-4 w-4" />
                    <span className="hidden sm:inline">Ver</span>
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" />
                    <span className="hidden sm:inline">Mover</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 min-h-0 px-3 pb-3 sm:px-6 sm:pb-6">
        {error ? (
          <p className="text-sm text-danger">No se pudieron cargar las mesas.</p>
        ) : isLoading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tables.length === 0 ? (
          <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-border p-8 text-center">
            <div>
              <Table className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No hay mesas registradas</p>
              <p className="text-xs text-muted-foreground">
                Crea mesas en la vista de gestión para visualizarlas aquí.
              </p>
              <Link
                href="/tables"
                className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-border/60 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Settings className="h-4 w-4" />
                Gestionar mesas
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <TablesCanvas
              tables={tables}
              mode={mode}
              onMove={mode === "edit" ? handleMove : undefined}
              onSelect={mode === "select" ? handleSelect : undefined}
            />
          </div>
        )}
      </div>

      {inspectedTable && (
        <TableOrderDrawer
          table={inspectedTable}
          isWaiter={isWaiter}
          onClose={() => setInspectedTable(null)}
        />
      )}
    </div>
  );
}
