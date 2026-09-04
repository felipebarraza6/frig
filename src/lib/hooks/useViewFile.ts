"use client";

import { useCallback, useState } from "react";
import type { ApiFileResult } from "@/lib/api/client";
import { viewBlobInNewTab } from "@/lib/utils";

interface UseViewFileOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Hook para previsualizar un archivo (PDF, etc.) en una pestaña nueva.
 * Pasa la misma función que pasas a `useDownloadFile().download` y el hook
 * se encarga de abrir el blob en una nueva pestaña del navegador.
 */
export function useViewFile() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const view = useCallback(
    async (fetchFile: () => Promise<ApiFileResult>, options: UseViewFileOptions = {}) => {
      setIsLoading(true);
      setError(null);
      try {
        const { blob } = await fetchFile();
        viewBlobInNewTab(blob);
        options.onSuccess?.();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Error al previsualizar");
        setError(error);
        options.onError?.(error);
        return;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { view, isLoading, error };
}
