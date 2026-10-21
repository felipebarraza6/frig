"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCLP } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import {
  assignOrderDriver,
  fetchAvailableDrivers,
  type AvailableDriver,
} from "@/lib/api/drivers";
import { ApiError } from "@/lib/api/client";

export type AssignDriverOrder = {
  id: string;
  delivery_address?: string | null;
  delivery_cost?: string | number | null;
  driver_fee?: string | number | null;
  delivered_by_id?: number | null;
  delivered_by_name?: string | null;
  total_amount?: string | number | null;
};

export type AssignDriverPatch = {
  delivered_by_id: number | null;
  delivered_by_name: string | null;
  driver_fee: number | null;
};

function isDeliveryOrder(order: AssignDriverOrder): boolean {
  return Boolean(order.delivery_address?.trim()) || Number(order.delivery_cost ?? 0) > 0;
}

export function AssignDriverControl({
  order,
  onAssigned,
}: {
  order: AssignDriverOrder;
  onAssigned?: (updated: AssignDriverPatch) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState(
    order.delivered_by_id ? String(order.delivered_by_id) : "",
  );

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["available-drivers"],
    queryFn: fetchAvailableDrivers,
    enabled: isDeliveryOrder(order),
  });

  const options = useMemo(() => {
    const opts = [{ value: "", label: isLoading ? "Cargando…" : "Seleccionar repartidor" }];
    const seen = new Set<string>();
    for (const d of drivers) {
      const value = String(d.user_id);
      seen.add(value);
      const fee = d.estimated_fee ?? d.pricing?.total_fee;
      opts.push({
        value,
        label: fee != null ? `${d.name} · ${formatCLP(fee)}` : d.name,
      });
    }
    if (order.delivered_by_id && !seen.has(String(order.delivered_by_id))) {
      opts.push({
        value: String(order.delivered_by_id),
        label: order.delivered_by_name || `Repartidor #${order.delivered_by_id}`,
      });
    }
    return opts;
  }, [drivers, isLoading, order.delivered_by_id, order.delivered_by_name]);

  const assign = useMutation({
    mutationFn: (driver: AvailableDriver) =>
      assignOrderDriver(order.id, { driver_user_id: driver.user_id }),
    onSuccess: (updated) => {
      toast.success("Repartidor asignado.");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      const row = updated as AssignDriverOrder;
      onAssigned?.({
        delivered_by_id: row.delivered_by_id ?? null,
        delivered_by_name: row.delivered_by_name ?? null,
        driver_fee: row.driver_fee != null ? Number(row.driver_fee) : null,
      });
    },
    onError: (err: Error) => {
      const message =
        err instanceof ApiError ? err.message : err.message || "No se pudo asignar el repartidor.";
      toast.error(message);
    },
  });

  if (!isDeliveryOrder(order)) return null;

  const selectedDriver = drivers.find((d) => String(d.user_id) === selectedId);

  return (
    <div className="mt-3 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
        Asignar repartidor
      </p>
      {order.delivered_by_name && (
        <p className="text-sm">
          <span className="text-muted-foreground">Asignado:</span> {order.delivered_by_name}
        </p>
      )}
      {Number(order.driver_fee ?? 0) > 0 && (
        <p className="text-sm">
          <span className="text-muted-foreground">Tarifa conductor:</span>{" "}
          {formatCLP(order.driver_fee ?? "0")}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          id="assign-driver"
          aria-label="Asignar repartidor"
          className="flex-1"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          options={options}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!selectedDriver || assign.isPending}
          onClick={() => selectedDriver && assign.mutate(selectedDriver)}
        >
          {assign.isPending ? "Asignando…" : "Asignar"}
        </Button>
      </div>
    </div>
  );
}
