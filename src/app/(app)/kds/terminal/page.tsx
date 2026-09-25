"use client";

import { Suspense, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Hand, Tv } from "lucide-react";
import { KdsBoard } from "@/components/kds/kds-board";
import { cn } from "@/lib/utils";

function KdsTerminalInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const stationId = useMemo(() => {
    const raw = searchParams.get("station_id") ?? searchParams.get("id");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);

  const mode = useMemo(() => {
    const raw = (searchParams.get("mode") ?? "operate").toLowerCase();
    return raw === "monitor" ? "monitor" : "operate";
  }, [searchParams]);

  useEffect(() => {
    if (mode === "monitor" && stationId) {
      router.replace(`/kds/monitor?station_id=${stationId}`);
    }
  }, [mode, stationId, router]);

  if (mode === "monitor") {
    return (
      <div className="grid h-screen place-items-center text-sm text-muted-foreground">
        Abriendo monitor…
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {stationId != null && (
        <div className="flex flex-wrap items-center justify-end gap-1.5 border-b border-border/60 bg-muted/30 px-3 py-1.5">
          <span className="mr-auto text-[11px] font-medium text-muted-foreground">
            Modo de la estación
          </span>
          <span
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold",
              "border-primary bg-primary text-primary-foreground",
            )}
          >
            <Hand className="h-3.5 w-3.5" />
            Estación
          </span>
          <Link
            href={`/kds/monitor?station_id=${stationId}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs font-medium hover:bg-muted"
          >
            <Tv className="h-3.5 w-3.5" />
            Monitor
          </Link>
        </div>
      )}
      <KdsBoard
        className="min-h-0 flex-1 p-2 sm:p-4"
        title={stationId ? "Estación KDS" : "KDS"}
        fixedStationId={stationId ?? undefined}
        mode="operate"
      />
    </div>
  );
}

/** Pantalla operable del cocinero; cada estación también puede abrir modo monitor. */
export default function KdsTerminalPage() {
  return (
    <Suspense
      fallback={
        <div className="grid h-screen place-items-center text-sm text-muted-foreground">
          Cargando estación…
        </div>
      }
    >
      <KdsTerminalInner />
    </Suspense>
  );
}
