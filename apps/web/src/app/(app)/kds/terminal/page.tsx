"use client";

import { KdsBoard } from "@/components/kds/kds-board";

export default function KdsTerminalPage() {
  return (
    <div className="h-screen bg-background">
      <KdsBoard
        className="h-screen p-2 sm:p-4"
        title="Cocina"
        mode="monitor"
      />
    </div>
  );
}
