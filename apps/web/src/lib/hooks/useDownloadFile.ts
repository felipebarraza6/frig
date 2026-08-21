"use client";

import { useCallback, useState } from "react";
import type { ApiFileResult } from "@/lib/api/client";
import { downloadBlob } from "@/lib/utils";

interface UseDownloadFileOptions {
  filename?: string;
  extension?: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function useDownloadFile() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const download = useCallback(
    async (
      fetchFile: () => Promise<ApiFileResult>,
      options: UseDownloadFileOptions = {},
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const { blob, filename } = await fetchFile();
        const finalName =
          filename ??
          (options.filename
            ? options.extension && !options.filename.toLowerCase().endsWith(`.${options.extension.toLowerCase()}`)
              ? `${options.filename}.${options.extension}`
              : options.filename
            : `descarga.${options.extension ?? "pdf"}`);
        downloadBlob(blob, finalName);
        options.onSuccess?.();
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Error al descargar");
        setError(error);
        options.onError?.(error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return { download, isLoading, error };
}

/**
 * Genera un nombre de archivo con timestamp para exports.
 */
export function exportFilename(base: string, extension: string): string {
  const date = new Date().toLocaleDateString("en-CA");
  return `${base}_${date}.${extension}`;
}
