"use client";

import "./mock";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
    <div className="flex h-dvh flex-col gap-3 p-3 sm:p-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-white">
            Demo del salón digital 3D
          </p>
          <p className="text-[11px] text-zinc-400">
            Datos de ejemplo · mové mesas, creá una nueva y seleccioná el detalle
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 px-3 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a FRIG
        </Link>
      </header>
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
