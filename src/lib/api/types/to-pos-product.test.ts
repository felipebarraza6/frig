import { describe, expect, it } from "vitest";
import { API_ORIGIN } from "@/lib/api/client";
import { attachForSaleImages, toPosProduct } from "./index";
import type { YggdraProduct } from "./index";

describe("toPosProduct", () => {
  it("resuelve primary_image relativo contra el origen de la API", () => {
    const product = toPosProduct({
      id: 1,
      name: "Torta",
      quantity: 0,
      primary_image: "/media/products/383/gallery/x.png",
    } as unknown as YggdraProduct);
    expect(product.image).toBe(`${API_ORIGIN}/media/products/383/gallery/x.png`);
    expect(product.quantity).toBe(0);
  });

  it("conserva la foto del listado for-sale aunque el producto esté sin stock", () => {
    const [product] = attachForSaleImages(
      [
        {
          id: 383,
          name: "Pie",
          price: 1000,
          quantity: 0,
          image: null,
        },
      ],
      [{ id: 383, primary_image: "/media/products/383/gallery/x.png" }],
    );
    expect(product.image).toBe(`${API_ORIGIN}/media/products/383/gallery/x.png`);
    expect(product.quantity).toBe(0);
  });
});
