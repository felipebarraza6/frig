"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * El informe financiero ahora converge en /reports/dinero,
 * donde se despliegan ingresos, egresos y neto sin duplicar
 * el informe de ventas.
 */
export default function FinanzasRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/reports/dinero");
  }, [router]);

  return (
    <div className="grid min-h-[50vh] place-items-center p-6">
      <p className="text-sm text-muted-foreground">Redirigiendo al informe de dinero…</p>
    </div>
  );
}
