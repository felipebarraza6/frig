import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./client";
import { fetchProductWarehouses } from "./warehouses";
import { fetchSupplierProductsByProduct } from "./suppliers";

const fetchMock = vi.mocked(apiFetch);

describe("filtros product del contrato nuevo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("pide warehouse-products filtrado por producto, sin paginar la colección", async () => {
    fetchMock.mockResolvedValueOnce({ results: [{ id: 1, product: 9 }], next: null });
    await fetchProductWarehouses(9);
    expect(fetchMock).toHaveBeenCalledOnce();
    const path = String(fetchMock.mock.calls[0]?.[0]);
    expect(path).toContain("/inventory/warehouse-products/?");
    expect(path).toContain("product=9");
    expect(path).not.toContain("search=");
  });

  it("pide supplier-products filtrado por producto", async () => {
    fetchMock.mockResolvedValueOnce({ results: [], next: null });
    await fetchSupplierProductsByProduct(4);
    const path = String(fetchMock.mock.calls[0]?.[0]);
    expect(path).toContain("/suppliers/supplier-products/?");
    expect(path).toContain("product=4");
  });
});
