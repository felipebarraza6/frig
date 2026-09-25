"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createTable, fetchTables, updateTable } from "@/lib/api/tables";
import { TablesCanvas } from "@/components/tables/tables-canvas";
import { TableOrderPanel } from "@/components/tables/table-order-panel";
import {
  useCanManageTables,
  useCurrentBranch,
  useIsWaiter,
} from "@/lib/store/session";
import { useToast } from "@/lib/store/toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  hasUnsetPosition,
  layoutTables,
  needsTableAutoLayout,
} from "@/lib/tables/layout";
import type { YggdraSchemas } from "@/lib/api/types";
import type { TableShape } from "@/components/tables/table-shape-icon";

type TableItem = YggdraSchemas["Table"];

const FULL_PATH = "/tables/map/full";

export function TablesMapView({ immersive = false }: { immersive?: boolean }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const branch = useCurrentBranch();
  const canManage = useCanManageTables();
  const isWaiter = useIsWaiter();
  const [inspectedTable, setInspectedTable] = useState<TableItem | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const autoSavedRef = useRef(false);

  const { data: page, isLoading, error } = useQuery({
    queryKey: ["tables", "map"],
    queryFn: () => fetchTables({ page_size: 200 }),
    refetchInterval: 15_000,
  });

  const tables = useMemo(() => page?.results ?? [], [page]);

  const resolvedPositions = useMemo(() => {
    if (!needsTableAutoLayout(tables)) {
      return new Map(
        tables.map((t) => [t.id, { x: t.x_position ?? 0, y: t.y_position ?? 0 }]),
      );
    }
    const laid = layoutTables(tables);
    return new Map(laid.map((p) => [p.id, { x: p.x, y: p.y }]));
  }, [tables]);

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

  const createMutation = useMutation({
    mutationFn: createTable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo crear la mesa"),
  });

  useEffect(() => {
    if (!canManage || isLoading || autoSavedRef.current || tables.length === 0) return;
    if (!needsTableAutoLayout(tables)) return;

    autoSavedRef.current = true;
    const laid = layoutTables(tables);
    const toSave = laid.filter((p) => {
      const t = tables.find((x) => x.id === p.id);
      if (!t) return false;
      if (hasUnsetPosition(t)) return true;
      return Math.abs((t.x_position ?? 0) - p.x) > 1 || Math.abs((t.y_position ?? 0) - p.y) > 1;
    });

    if (toSave.length === 0) return;

    void (async () => {
      setOrganizing(true);
      try {
        await Promise.all(
          toSave.map((p) => updateTable(p.id, { x_position: p.x, y_position: p.y })),
        );
        await queryClient.invalidateQueries({ queryKey: ["tables", "map"] });
      } catch {
        autoSavedRef.current = false;
        toast.error("No se pudieron organizar las mesas automáticamente");
      } finally {
        setOrganizing(false);
      }
    })();
  }, [canManage, isLoading, tables, queryClient, toast]);

  const suggestedNumber = useMemo(() => {
    const nums = tables
      .map((t) => parseInt(String(t.number), 10))
      .filter((n) => !Number.isNaN(n));
    const next = nums.length ? Math.max(...nums) + 1 : 1;
    return String(next);
  }, [tables]);

  function handleCreate(data: {
    number: string;
    capacity: number;
    shape: TableShape;
    x: number;
    y: number;
  }) {
    if (!branch) {
      toast.error("No hay sucursal seleccionada");
      return;
    }
    createMutation.mutate({
      number: data.number,
      branch: Number(branch.branch_id),
      capacity: data.capacity,
      shape: data.shape,
      area: null,
      description: null,
      assigned_waiter: null,
      x_position: data.x,
      y_position: data.y,
    });
  }

  function handleToggleImmersive() {
    if (immersive) {
      if (window.opener) window.close();
      else window.location.assign("/tables/map");
      return;
    }
    window.open(FULL_PATH, "frig-salon-virtual", "noopener,noreferrer");
  }

  const saving = moveMutation.isPending || organizing || createMutation.isPending;

  return (
    <div className={immersive ? "relative h-screen bg-background" : "relative min-h-0 flex-1"}>
      {error ? (
        <p className="p-4 text-sm text-danger">No se pudieron cargar las mesas.</p>
      ) : isLoading ? (
        <Skeleton className="glass h-full min-h-[320px] w-full rounded-2xl" />
      ) : (
        <div className="relative h-full min-h-0">
          <TablesCanvas
            tables={tables}
            mode="select"
            selectedTableId={inspectedTable?.id ?? null}
            resolvedPositions={resolvedPositions}
            onMove={canManage ? (id, x, y) => moveMutation.mutate({ id, x, y }) : undefined}
            onSelect={setInspectedTable}
            canManage={canManage}
            onCreate={canManage ? handleCreate : undefined}
            createBusy={createMutation.isPending}
            suggestedNumber={suggestedNumber}
            immersive={immersive}
            onToggleImmersive={handleToggleImmersive}
          />

          {inspectedTable && (
            <TableOrderPanel
              table={inspectedTable}
              isWaiter={isWaiter}
              onClose={() => setInspectedTable(null)}
              className="absolute bottom-3 right-3 top-14 z-20 max-h-[calc(100%-4rem)]"
            />
          )}

          {saving && (
            <span className="pointer-events-none absolute left-3 top-14 z-20 text-xs text-muted-foreground">
              {createMutation.isPending
                ? "Creando…"
                : organizing
                  ? "Organizando…"
                  : "Guardando…"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
