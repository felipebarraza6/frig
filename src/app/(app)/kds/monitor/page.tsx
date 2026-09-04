"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, ChefHat, Utensils, ClipboardList } from "lucide-react";
import { useCurrentBranch } from "@/lib/store/session";
import { fetchKitchenTickets, type KitchenTicket } from "@/lib/api/kitchen";
import { cn } from "@/lib/utils";

type TicketStatus = Exclude<KitchenTicket["status"], undefined>;

const STATUS_LABEL: Record<TicketStatus, string> = {
  PENDING: "Pendiente",
  PREPARING: "En preparación",
  READY: "Listo",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

const STATUS_COLOR: Record<TicketStatus, string> = {
  PENDING: "text-amber-600",
  PREPARING: "text-primary",
  READY: "text-emerald-600",
  DELIVERED: "text-muted-foreground",
  CANCELLED: "text-danger",
};

export default function KdsMonitorPage() {
  const branch = useCurrentBranch();

  const { data: tickets = [] } = useQuery({
    queryKey: ["kitchen-tickets"],
    queryFn: () => fetchKitchenTickets(),
    refetchInterval: 10_000,
    enabled: !!branch,
  });

  const stats = useMemo(() => {
    const pending = tickets.filter((t) => t.status === "PENDING").length;
    const preparing = tickets.filter((t) => t.status === "PREPARING").length;
    const ready = tickets.filter((t) => t.status === "READY").length;
    return { pending, preparing, ready };
  }, [tickets]);

  const nextTicket = useMemo(() => {
    if (tickets.length === 0) return null;
    const sorted = [...tickets].sort(
      (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime()
    );
    const pending = sorted.find((t) => t.status === "PENDING");
    return pending || sorted[0];
  }, [tickets]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-8 bg-background p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">Cocina</h1>
        <p className="mt-2 text-lg text-primary/80">
          {branch?.business_name || "Sin sucursal seleccionada"}
        </p>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col items-center rounded-2xl border border-border bg-muted/30 p-6 shadow-sm">
          <Clock className="mb-2 h-8 w-8 text-amber-500" />
          <p className="text-4xl font-bold tabular-nums">{stats.pending}</p>
          <p className="text-sm text-muted-foreground">Pendientes</p>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-border bg-muted/30 p-6 shadow-sm">
          <ChefHat className="mb-2 h-8 w-8 text-primary" />
          <p className="text-4xl font-bold tabular-nums">{stats.preparing}</p>
          <p className="text-sm text-muted-foreground">En preparación</p>
        </div>
        <div className="flex flex-col items-center rounded-2xl border border-border bg-muted/30 p-6 shadow-sm">
          <Utensils className="mb-2 h-8 w-8 text-emerald-500" />
          <p className="text-4xl font-bold tabular-nums">{stats.ready}</p>
          <p className="text-sm text-muted-foreground">Listos</p>
        </div>
      </div>

      <div className="w-full max-w-4xl rounded-2xl border border-border bg-muted/30 p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Próxima orden
        </h2>
        {nextTicket ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xl font-semibold">Orden #{nextTicket.order.slice(0, 8)}</p>
              <p className="text-sm text-muted-foreground">
                {new Date(nextTicket.created).toLocaleTimeString("es-CL", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className={cn("text-lg font-semibold", STATUS_COLOR[nextTicket.status ?? "PENDING"])}>
              {STATUS_LABEL[nextTicket.status ?? "PENDING"]}
            </div>
            <ul className="flex flex-col gap-1">
              {nextTicket.items.slice(0, 4).map((item) => (
                <li key={item.id} className="text-sm">
                  <span className="font-medium">{item.product_name}</span>
                  <span className="ml-2 tabular-nums text-muted-foreground">
                    x{item.quantity ?? 0}
                  </span>
                </li>
              ))}
              {nextTicket.items.length > 4 && (
                <li className="text-xs text-muted-foreground">
                  +{nextTicket.items.length - 4} ítems más
                </li>
              )}
            </ul>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Sin comandas activas</p>
            <p className="text-xs text-muted-foreground">
              Aparecerá la próxima orden entrante.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
