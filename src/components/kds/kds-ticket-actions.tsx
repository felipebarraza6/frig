"use client";

import { Undo2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KitchenTicket } from "@/lib/api/kitchen";
import type { useKitchenTicketMutations } from "@/lib/hooks/useKitchenTicketMutations";
import { kitchenAdvanceAction, kitchenRevertStatus } from "@/lib/kds-ticket-status";

type Mutations = ReturnType<typeof useKitchenTicketMutations>;

export function KdsTicketActions({
  ticket,
  mutations,
  showCancel = false,
  compact = false,
}: {
  ticket: KitchenTicket;
  mutations: Mutations;
  showCancel?: boolean;
  compact?: boolean;
}) {
  const advance = kitchenAdvanceAction(ticket.status);
  const previous = kitchenRevertStatus(ticket.status);
  const isPending =
    mutations.startMutation.isPending ||
    mutations.readyMutation.isPending ||
    mutations.deliverMutation.isPending ||
    mutations.revertMutation.isPending ||
    mutations.cancelMutation.isPending;

  if (!advance && !previous && !showCancel) return null;

  const btnClass = compact ? "min-h-9 flex-1 text-sm" : "min-h-11 flex-1 text-base";

  const runAdvance = () => {
    if (!advance) return;
    if (advance.endpoint === "start") mutations.startMutation.mutate(ticket.id);
    else if (advance.endpoint === "ready") mutations.readyMutation.mutate(ticket.id);
    else mutations.deliverMutation.mutate(ticket.id);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {previous ? (
        <Button
          variant="outline"
          className={compact ? "min-h-9 text-sm" : "min-h-11 text-base"}
          onClick={() => mutations.revertMutation.mutate({ id: ticket.id, previous })}
          disabled={isPending}
          isLoading={mutations.revertMutation.isPending}
          title="Retroceder un estado"
        >
          <Undo2 className="h-4 w-4" />
          Volver
        </Button>
      ) : null}
      {advance ? (
        <Button
          className={btnClass}
          onClick={runAdvance}
          disabled={isPending}
          isLoading={
            (advance.endpoint === "start" && mutations.startMutation.isPending) ||
            (advance.endpoint === "ready" && mutations.readyMutation.isPending) ||
            (advance.endpoint === "deliver" && mutations.deliverMutation.isPending)
          }
        >
          {advance.label}
        </Button>
      ) : null}
      {showCancel && ticket.status !== "DELIVERED" && ticket.status !== "CANCELLED" ? (
        <Button
          size="icon"
          variant="outline"
          className={compact ? "min-h-9 min-w-9 text-danger hover:bg-danger/10" : "min-h-11 min-w-11 text-danger hover:bg-danger/10"}
          onClick={() => mutations.cancelMutation.mutate(ticket.id)}
          disabled={isPending}
          isLoading={mutations.cancelMutation.isPending}
          title="Cancelar comanda"
        >
          <XCircle className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}
