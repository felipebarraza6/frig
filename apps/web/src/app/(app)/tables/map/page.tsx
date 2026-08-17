"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowLeft, Pencil, Eye, Settings } from "lucide-react";
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
      <header className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/tables"
            className="inline-flex items-center gap-1 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Settings className="h-3.5 w-3.5" />
                Gestionar
              </Link>
              <button
                type="button"
                onClick={() => setEditMode((v) => !v)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors",
                  editMode
                    ? "border-primary bg-primary text-white"
                    : "border-border/60 bg-background text-foreground hover:bg-muted",
                )}
              >
                {editMode ? (
                  <>
                    <Eye className="h-3.5 w-3.5" /> Ver
                  </>
                ) : (
                  <>
                    <Pencil className="h-3.5 w-3.5" /> Mover
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
          <div className="grid flex-1 place-items-center rounded-2xl border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No hay mesas registradas.</p>
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
