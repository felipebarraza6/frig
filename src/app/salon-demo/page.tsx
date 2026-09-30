"use client";

import "./mock";
import { useState } from "react";
import { TablesCanvas } from "@/components/tables/tables-canvas";
import type { YggdraSchemas } from "@/lib/api/types";
import type { TableShape } from "@/components/tables/table-shape-icon";

type TableItem = YggdraSchemas["Table"];

const MOCK_TABLES = [
  {
    id: 1,
    number: "1",
    capacity: 4,
    shape: "ROUND",
    status: "FREE",
    x_position: 140,
    y_position: 140,
    area: "Terraza",
  },
  {
    id: 2,
    number: "2",
    capacity: 2,
    shape: "SQUARE",
    status: "OCCUPIED",
    x_position: 320,
    y_position: 150,
    area: "Salón",
  },
  {
    id: 3,
    number: "3",
    capacity: 6,
    shape: "RECTANGLE",
    status: "FREE",
    x_position: 500,
    y_position: 220,
    area: "Salón",
  },
] as TableItem[];

export default function SalonDemoPage() {
  const [tables, setTables] = useState(MOCK_TABLES);
  const [selected, setSelected] = useState<TableItem | null>(null);

  return (
    <div className="flex h-screen flex-col p-3">
      <p className="mb-2 shrink-0 rounded-xl border border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
        Demo interactiva del salón digital 3D — datos de ejemplo, sin conexión
        a tu cuenta. Mové mesas, creá una nueva y seleccioná para ver el
        detalle. El salón real vive en la app, en Mesas → Mapa 3D.
      </p>
      <div className="min-h-0 flex-1">
        <TablesCanvas
          tables={tables}
          mode="select"
          selectedTableId={selected?.id ?? null}
          canManage
          suggestedNumber="4"
          onSelect={setSelected}
          onMove={(id, x, y) => {
            setTables((prev) =>
              prev.map((t) => (t.id === id ? { ...t, x_position: x, y_position: y } : t)),
            );
          }}
          onCreate={(data: {
            number: string;
            capacity: number;
            shape: TableShape;
            x: number;
            y: number;
          }) => {
            setTables((prev) => [
              ...prev,
              {
                id: Math.max(...prev.map((t) => t.id)) + 1,
                number: data.number,
                capacity: data.capacity,
                shape: data.shape,
                status: "FREE",
                x_position: data.x,
                y_position: data.y,
                area: null,
              } as TableItem,
            ]);
          }}
        />
      </div>
    </div>
  );
}
