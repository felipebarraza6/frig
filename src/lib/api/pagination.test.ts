import { describe, expect, it, vi } from "vitest";
import { fetchAllPages, nextApiPath } from "./pagination";

describe("nextApiPath", () => {
  it("recorta el prefijo /api de una ruta relativa", () => {
    expect(nextApiPath("/api/inventory/categories/?page=2")).toBe(
      "/inventory/categories/?page=2",
    );
  });

  it("deja pasar una URL absoluta", () => {
    const url = "https://api.yggdra.cl/api/inventory/categories/?page=2";
    expect(nextApiPath(url)).toBe(url);
  });

  it("devuelve null si no hay next", () => {
    expect(nextApiPath(null)).toBeNull();
    expect(nextApiPath("")).toBeNull();
  });
});

describe("fetchAllPages", () => {
  it("junta tres páginas y corta cuando next es null", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({
        results: [{ id: 1 }, { id: 2 }],
        next: "https://api.yggdra.cl/api/inventory/categories/?page=2&page_size=2",
      })
      .mockResolvedValueOnce({
        results: [{ id: 3 }, { id: 4 }],
        next: "/api/inventory/categories/?page=3&page_size=2",
      })
      .mockResolvedValueOnce({ results: [{ id: 5 }], next: null });

    const rows = await fetchAllPages<{ id: number }>("/inventory/categories/", {
      pageSize: 2,
      fetch,
    });

    expect(rows.map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[0][0]).toBe("/inventory/categories/?page_size=2");
    expect(fetch.mock.calls[2][0]).toBe("/inventory/categories/?page=3&page_size=2");
  });
});
