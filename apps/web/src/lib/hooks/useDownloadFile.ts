"use client";

import { useCallback, useState } from "react";
import type { ApiFileResult } from "@/lib/api/client";
import { downloadBlob } from "@/lib/utils";
import { useToast } from "@/lib/store/toast";

interface UseDownloadFileOptions {
  filename?: string;
  extension?: string;
  onSuccess?: () => void;
  /** Si se omite, el error se muestra con un toast por defecto. */
  onError?: (error: Error) => void;
}

export function useDownloadFile() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const toast = useToast();

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
        if (options.onError) {
          options.onError(error);
        } else {
          // Feedback por defecto: varias páginas llaman download() sin manejar
          // el error y el hook no relanza (evita unhandled rejections), así que
          // sin este toast la descarga fallaba en silencio.
          toast.error(error.message || "No se pudo descargar el archivo");
        }
        return;
      } finally {
        setIsLoading(false);
      }
    },
    [toast],
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
