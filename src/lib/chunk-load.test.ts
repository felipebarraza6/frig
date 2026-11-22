import { describe, expect, it, vi } from "vitest";
import { isChunkLoadFailure, reloadOnceForChunkError } from "./chunk-load";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("isChunkLoadFailure", () => {
  it("reconoce el error de Turbopack en producción", () => {
    const error = new Error(
      "Failed to load chunk /_next/static/chunks/3ffac_-gt_s18.js from module 64893",
    );
    expect(isChunkLoadFailure(error)).toBe(true);
  });

  it("reconoce ChunkLoadError de webpack", () => {
    const error = new Error("Loading chunk 123 failed.");
    error.name = "ChunkLoadError";
    expect(isChunkLoadFailure(error)).toBe(true);
  });

  it("ignora otros fallos", () => {
    expect(isChunkLoadFailure(new Error("NetworkError"))).toBe(false);
    expect(isChunkLoadFailure(undefined)).toBe(false);
  });
});

describe("reloadOnceForChunkError", () => {
  it("recarga una vez y no vuelve a hacerlo en la misma pestaña", () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    expect(reloadOnceForChunkError(storage, reload)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(reloadOnceForChunkError(storage, reload)).toBe(false);
    expect(reload).toHaveBeenCalledOnce();
  });
});
