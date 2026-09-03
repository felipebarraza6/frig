"use client";

import { useEffect, useState } from "react";
import { KdsBoard } from "@/components/kds/kds-board";

// La estación se resuelve después del montaje para que el HTML estático
// (exportación con placeholder "__") hidrate sin diferencias.
export function KdsStationClient({ id }: { id: string }) {
  const [stationId, setStationId] = useState<number | null>(null);

  useEffect(() => {
    const parsed = Number(id);
    setStationId(Number.isNaN(parsed) || parsed <= 0 ? null : parsed);
  }, [id]);

  if (stationId === null) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">
        Cargando estación…
      </div>
    );
  }

  return <KdsBoard fixedStationId={stationId} title="Estación de cocina" />;
}
