import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();

vi.mock("./client", async () => {
  const actual = await vi.importActual<typeof import("./client")>("./client");
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => apiFetch(...args),
  };
});

vi.mock("./pagination", () => ({
  fetchAllPages: vi.fn(),
}));

function file(name: string, type: string, size = 128): File {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe("validateProductImageFile", () => {
  it("acepta jpg, png y webp y rechaza tipo o tamaño", async () => {
    const { validateProductImageFile, PRODUCT_IMAGE_MAX_BYTES } = await import(
      "./product-gallery"
    );
    expect(validateProductImageFile(file("a.jpg", "image/jpeg"))).toBeNull();
    expect(validateProductImageFile(file("a.png", "image/png"))).toBeNull();
    expect(validateProductImageFile(file("a.webp", "image/webp"))).toBeNull();
    expect(validateProductImageFile(file("a.gif", "image/gif"))).toMatch(/JPG, PNG o WebP/);
    expect(
      validateProductImageFile(file("a.png", "image/png", PRODUCT_IMAGE_MAX_BYTES + 1)),
    ).toMatch(/5 MB/);
  });
});

describe("uploadProductImage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it("envía multipart a /inventory/gallery/ con producto e imagen principal", async () => {
    apiFetch.mockResolvedValueOnce({ id: 9, product: 4, is_primary: true, image: "/media/a.png" });
    const { uploadProductImage } = await import("./product-gallery");
    const image = file("helado.png", "image/png");
    const created = await uploadProductImage({
      productId: 4,
      file: image,
      isPrimary: true,
      altText: "Helado",
    });
    expect(created.id).toBe(9);
    expect(apiFetch).toHaveBeenCalledOnce();
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/inventory/gallery/");
    expect(opts.method).toBe("POST");
    expect(opts.body).toBeInstanceOf(FormData);
    const body = opts.body as FormData;
    expect(body.get("product")).toBe("4");
    expect(body.get("is_primary")).toBe("true");
    expect(body.get("alt_text")).toBe("Helado");
    expect(body.get("image")).toBeInstanceOf(File);
    expect((body.get("image") as File).name).toBe("helado.png");
  });

  it("no llama a la API si el archivo no es válido", async () => {
    const { uploadProductImage } = await import("./product-gallery");
    await expect(
      uploadProductImage({ productId: 1, file: file("x.gif", "image/gif") }),
    ).rejects.toThrow(/JPG, PNG o WebP/);
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("reemplaza borrando la imagen y subiendo otra con el mismo rol", async () => {
    apiFetch
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 11, product: 4, is_primary: true });
    const { replaceProductImage } = await import("./product-gallery");
    await replaceProductImage({
      productId: 4,
      imageId: 8,
      file: file("nueva.webp", "image/webp"),
      isPrimary: true,
    });
    expect(apiFetch.mock.calls[0]![0]).toBe("/inventory/gallery/8/");
    expect(apiFetch.mock.calls[0]![1].method).toBe("DELETE");
    expect(apiFetch.mock.calls[1]![0]).toBe("/inventory/gallery/");
    expect((apiFetch.mock.calls[1]![1].body as FormData).get("is_primary")).toBe("true");
  });

  it("marca principal con product_id en la query", async () => {
    apiFetch.mockResolvedValueOnce({ success: true });
    const { setPrimaryProductImage } = await import("./product-gallery");
    await setPrimaryProductImage(4, 8);
    expect(apiFetch).toHaveBeenCalledWith(
      "/inventory/gallery/set_primary/?product_id=4",
      { method: "POST", body: { image_id: 8 } },
    );
  });
});

describe("primaryImageByProduct", () => {
  it("prefiere la imagen marcada como principal", async () => {
    const { primaryImageByProduct } = await import("./product-gallery");
    const map = primaryImageByProduct([
      {
        id: 1,
        product: 7,
        image: "/media/sec.png",
        image_url: "/media/sec.png",
        is_primary: false,
        is_active: true,
        thumbnail_url: "",
        display_order: 1,
        is_profile_image: false,
        created: "",
        modified: "",
      },
      {
        id: 2,
        product: 7,
        image: "/media/pri.png",
        image_url: "/media/pri.png",
        is_primary: true,
        is_active: true,
        thumbnail_url: "",
        display_order: 0,
        is_profile_image: true,
        created: "",
        modified: "",
      },
    ]);
    expect(map.get(7)).toMatch(/pri\.png$/);
  });
});
