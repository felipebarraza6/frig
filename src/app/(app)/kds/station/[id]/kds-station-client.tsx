"use client";

import { KdsBoard } from "@/components/kds/kds-board";

// stationId se deriva directamente del prop — no necesita efecto.
export function KdsStationClient({ id }: { id: string }) {
  const parsed = Number(id);
  const stationId = Number.isNaN(parsed) || parsed <= 0 ? null : parsed;

  if (stationId === null) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">
        Cargando estación…
      </div>
    );
  }

  return <KdsBoard fixedStationId={stationId} title="Estación de cocina" />;
}
