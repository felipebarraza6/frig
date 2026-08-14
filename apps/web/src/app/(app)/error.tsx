"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
        <AlertTriangle className="h-8 w-8 text-danger" />
      </div>
      <h1 className="mt-4 text-lg font-semibold">Algo salió mal</h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
      </p>
      {error.message && (
        <p className="mt-2 max-w-md rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          {error.message}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <Button onClick={() => reset()}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Intentar de nuevo
        </Button>
        <Button variant="outline" onClick={() => router.push("/pos")}>
          <Home className="mr-2 h-4 w-4" />
          Volver al inicio
        </Button>
      </div>
    </div>
  );
}
