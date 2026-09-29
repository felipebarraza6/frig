"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Combine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { formatCLP, cn } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";
import { fetchOrders, mergeOrders } from "@/lib/api/orders";

export function MergeOrdersModal({
  open,
  onClose,
  targetId,
  targetLabel,
}: {
  open: boolean;
  onClose: () => void;
  targetId: string;
  targetLabel: string;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);

  const listQuery = useQuery({
    queryKey: ["orders", "merge-candidates", targetId],
    queryFn: () =>
      fetchOrders({
        status: ["PENDING", "IN_PROGRESS", "DRAFT"],
        payment_status: ["PENDING", "PARTIAL"],
        page_size: 50,
      }),
    enabled: open,
  });

  const candidates = useMemo(() => {
    const rows = listQuery.data?.results ?? [];
    return rows.filter((o) => String(o.id) !== String(targetId) && o.status !== "CANCELLED");
  }, [listQuery.data, targetId]);

  const merge = useMutation({
    mutationFn: () => mergeOrders(targetId, picked),
    onSuccess: (res) => {
      toast.success(
        res.lines_moved
          ? `Unidas ${res.lines_moved} líneas en ${targetLabel}`
          : "Órdenes unidas",
      );
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setPicked([]);
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "No se pudieron unir"),
  });

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  return (
    <Modal open={open} onClose={onClose} title="Unir órdenes" size="md">
      <ModalBody>
        <p className="text-sm text-muted-foreground">
          Los productos de las órdenes que elijas pasan a{" "}
          <span className="font-medium text-foreground">{targetLabel}</span>. Las
          de origen se anulan. Sirve para mostrador, delivery o mesas.
        </p>
        {listQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Cargando cuentas abiertas…</p>
        ) : candidates.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No hay otras órdenes abiertas sin pago para unir.
          </p>
        ) : (
          <ul className="mt-4 flex max-h-72 flex-col gap-1 overflow-y-auto">
            {candidates.map((o) => {
              const id = String(o.id);
              const on = picked.includes(id);
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className={cn(
                      "flex w-full min-w-0 items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm",
                      on ? "bg-primary/10 ring-1 ring-primary/35" : "hover:bg-muted/50",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {o.order_number ?? id.slice(0, 8)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {(o as { client?: { name?: string } }).client?.name ?? "Sin cliente"}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold">
                      {formatCLP((o as { total_amount?: string }).total_amount ?? "0")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose}>
          Cerrar
        </Button>
        <Button
          disabled={picked.length === 0 || merge.isPending}
          onClick={() => merge.mutate()}
        >
          <Combine className="mr-1.5 h-4 w-4" />
          Unir {picked.length || ""}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
