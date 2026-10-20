"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  cancelKitchenTicket,
  deliverKitchenTicket,
  readyKitchenTicket,
  revertKitchenTicket,
  startKitchenTicket,
  type KitchenTicket,
} from "@/lib/api/kitchen";
import { useToast } from "@/lib/store/toast";

function patchTicketStatus(
  data: unknown,
  id: number,
  status: KitchenTicket["status"],
): unknown {
  if (Array.isArray(data)) {
    return (data as KitchenTicket[]).map((ticket) =>
      ticket.id === id ? { ...ticket, status } : ticket,
    );
  }
  return data;
}

export function useKitchenTicketMutations() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const run = async (
    id: number,
    nextStatus: KitchenTicket["status"],
    fn: (ticketId: number) => Promise<KitchenTicket>,
  ) => {
    const snapshots = queryClient.getQueriesData({ queryKey: ["kitchen-tickets"] });
    queryClient.setQueriesData({ queryKey: ["kitchen-tickets"] }, (old) =>
      patchTicketStatus(old, id, nextStatus),
    );
    try {
      const result = await fn(id);
      await queryClient.invalidateQueries({ queryKey: ["kitchen-tickets"] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      return result;
    } catch (error) {
      for (const [key, data] of snapshots) {
        queryClient.setQueryData(key, data);
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Error al actualizar la comanda";
      toast.error(message);
      throw error;
    }
  };

  const startMutation = useMutation({
    mutationFn: (id: number) => run(id, "PREPARING", startKitchenTicket),
  });
  const readyMutation = useMutation({
    mutationFn: (id: number) => run(id, "READY", readyKitchenTicket),
  });
  const deliverMutation = useMutation({
    mutationFn: (id: number) => run(id, "DELIVERED", deliverKitchenTicket),
  });
  const revertMutation = useMutation({
    mutationFn: ({
      id,
      previous,
    }: {
      id: number;
      previous: KitchenTicket["status"];
    }) => run(id, previous, revertKitchenTicket),
  });
  const cancelMutation = useMutation({
    mutationFn: (id: number) => run(id, "CANCELLED", cancelKitchenTicket),
  });

  return {
    startMutation,
    readyMutation,
    deliverMutation,
    revertMutation,
    cancelMutation,
  };
}
