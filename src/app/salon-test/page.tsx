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

export default function SalonTestPage() {
  const [tables, setTables] = useState(MOCK_TABLES);
  const [selected, setSelected] = useState<TableItem | null>(null);

  return (
    <div className="h-screen p-3">
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
  );
}
