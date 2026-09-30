"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquarePlus, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ActionTypePicker,
  CategoryPicker,
  PlanningCard,
  shortDateTime,
} from "@/components/customers/follow-up-kit";
import {
  completeOpportunityActivity,
  createOpportunityActivity,
  ensureClientFollowUpOpportunity,
  ensureFollowUpCategories,
  fetchClientFollowUpActivities,
  type OpportunityActivityType,
} from "@/lib/api/crm";
import { useToast } from "@/lib/store/toast";

export function CustomerFollowUpsTab({
  clientId,
  clientName,
  suggestDebtCall,
}: {
  clientId: number;
  clientName: string;
  suggestDebtCall?: boolean;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activityType, setActivityType] = useState<OpportunityActivityType>("CALL");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const categoriesQuery = useQuery({
    queryKey: ["crm", "follow-up-categories"],
    queryFn: ensureFollowUpCategories,
  });

  const setupQuery = useQuery({
    queryKey: ["crm", "follow-up-setup", clientId],
    queryFn: () =>
      ensureClientFollowUpOpportunity({
        clientId,
        clientName,
      }),
    staleTime: 30_000,
  });

  const opportunityId = setupQuery.data?.opportunity.id;

  const activitiesQuery = useQuery({
    queryKey: ["crm", "activities", "client", clientId],
    queryFn: () => fetchClientFollowUpActivities(clientId),
    enabled: Boolean(opportunityId),
  });

  const activities = useMemo(() => activitiesQuery.data ?? [], [activitiesQuery.data]);
  const openCount = useMemo(
    () => activities.filter((a) => !a.is_completed).length,
    [activities],
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!opportunityId) throw new Error("Sin seguimiento base");
      const text = description.trim();
      if (!text) throw new Error("Escribe el seguimiento");
      return createOpportunityActivity({
        opportunity: opportunityId,
        activity_type: activityType,
        category: categoryId || null,
        description: text,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      });
    },
    onSuccess: () => {
      setDescription("");
      setScheduledAt("");
      queryClient.invalidateQueries({ queryKey: ["crm", "activities"] });
      toast.success("Seguimiento registrado");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar");
    },
  });

  const complete = useMutation({
    mutationFn: (id: string) => completeOpportunityActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm", "activities"] });
    },
    onError: () => toast.error("No se pudo completar"),
  });

  if (setupQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (setupQuery.error || !opportunityId) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-border px-4 py-10 text-center">
        <NotebookPen className="h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">No se pudo preparar el seguimiento</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">
          {setupQuery.error instanceof Error
            ? setupQuery.error.message
            : "Revisa permisos del módulo Clientes o intenta de nuevo."}
        </p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() => setupQuery.refetch()}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {suggestDebtCall && (
        <button
          type="button"
          onClick={() => {
            setActivityType("CALL");
            setDescription((prev) =>
              prev.trim()
                ? prev
                : "Llamar por saldo pendiente de cobro",
            );
          }}
          className="glass rounded-2xl px-3 py-2 text-left text-xs text-warning transition-colors hover:bg-warning/10"
        >
          Hay montos por cobrar. Tocá para prellenar una llamada de cobro.
        </button>
      )}

      <div className="glass rounded-2xl p-3">
        <p className="text-xs font-medium text-muted-foreground">Nuevo seguimiento</p>
        <div className="mt-2">
          <ActionTypePicker value={activityType} onChange={setActivityType} />
        </div>
        <div className="mt-2">
          <CategoryPicker
            categories={categoriesQuery.data ?? []}
            value={categoryId}
            onChange={setCategoryId}
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Qué pasó o qué hay que hacer…"
          className="mt-2 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="h-9 min-w-0 flex-1"
            aria-label="Programar para"
          />
          <Button
            size="sm"
            className="shrink-0"
            disabled={!description.trim() || create.isPending}
            isLoading={create.isPending}
            onClick={() => create.mutate()}
          >
            <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />
            Registrar
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-0.5 text-xs text-muted-foreground">
        <span>
          {activities.length} seguimiento{activities.length === 1 ? "" : "s"}
          {openCount > 0 ? ` · ${openCount} abiertos` : ""}
        </span>
      </div>

      {activitiesQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed border-border px-4 py-8 text-center">
          <NotebookPen className="h-7 w-7 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Sin seguimientos</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Dejá la primera nota o programá una llamada.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {activities.map((activity) => (
            <li key={activity.id}>
              <PlanningCard
                activity={activity}
                clientName={clientName}
                onComplete={activity.is_completed ? undefined : (id) => complete.mutate(id)}
                completing={complete.isPending}
              />
              {activity.created ? (
                <p className="px-1 pt-1 text-[10px] text-muted-foreground">
                  Registrado {shortDateTime(activity.created)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
