import { describe, expect, it } from "vitest";
import { toPosProduct } from "./index";
import type { YggdraProduct } from "./index";

describe("toPosProduct", () => {
  it("antepone el origen de la API a una foto relativa", () => {
    const product = toPosProduct({
      id: 1,
      name: "Torta",
      quantity: 1,
      primary_image: "/media/torta.jpg",
    } as unknown as YggdraProduct);
    expect(product.image).toMatch(/\/media\/torta\.jpg$/);
    expect(product.image?.startsWith("/media/")).toBe(false);
  });
});
