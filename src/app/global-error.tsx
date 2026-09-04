"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, LogIn } from "lucide-react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body className="flex min-h-full flex-col items-center justify-center bg-background p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
          <AlertTriangle className="h-8 w-8 text-danger" />
        </div>
        <h1 className="mt-4 text-lg font-semibold">Error crítico</h1>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          La aplicación no pudo cargar correctamente. Intenta recargar la página o vuelve a iniciar sesión.
        </p>
        {error.message && (
          <p className="mt-2 max-w-md rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <RotateCcw className="h-4 w-4" />
            Intentar de nuevo
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            Recargar página
          </button>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <LogIn className="h-4 w-4" />
            Volver al login
          </Link>
        </div>
      </body>
    </html>
  );
}
