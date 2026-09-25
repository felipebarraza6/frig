"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TablesMapView } from "@/components/tables/tables-map-view";

export default function TablesMapPage() {
  return (
    <div className="relative flex h-screen flex-col bg-transparent">
      <header className="glass-chip z-10 mx-3 mt-2 flex items-center gap-2 rounded-xl px-3 py-1.5 sm:mx-6">
        <Link
          href="/tables"
          className="inline-flex items-center gap-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-white/40 hover:text-foreground"
          aria-label="Volver a mesas"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight">
          Virtual
        </h1>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2 sm:px-6 sm:pb-4">
        <TablesMapView />
      </div>
    </div>
  );
}
