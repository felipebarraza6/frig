import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductForm } from "./product-form";
import { useSessionStore } from "@/lib/store/session";
import { useToastStore } from "@/lib/store/toast";

vi.mock("@/lib/api/product-gallery", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/product-gallery")>(
    "@/lib/api/product-gallery",
  );
  return {
    ...actual,
    fetchProductGallery: vi.fn(async () => []),
  };
});

const galleryPosts: { product?: string }[] = [];
let galleryStatus = 200;
let galleryError = "No se pudo guardar la imagen";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (method === "POST" && url.includes("/inventory/gallery/")) {
        const form = init?.body;
        const product = form instanceof FormData ? String(form.get("product")) : undefined;
        galleryPosts.push({ product });
        if (galleryStatus !== 200) return json({ detail: galleryError }, galleryStatus);
        return json({ id: 9, product: Number(product), is_primary: true, image: "/m.png" });
      }
      if (url.includes("/inventory/categories")) return json({ results: [] });
      if (url.includes("/modifier")) return json([]);
      if (url.includes("/warehouse")) return json({ results: [] });
      if (url.includes("/supplier")) return json([]);
      if (url.includes("product-type") || url.includes("enabled")) {
        return json({ enabled_types: ["DIRECT_SALE", "RECIPE_BASED", "RAW_MATERIAL"] });
      }
      return json({ results: [] });
    }),
  );
}

function renderCreateForm() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const onClose = vi.fn();
  const onSubmit = vi.fn(async () => ({ id: 384, name: "Café" }));
  render(
    <QueryClientProvider client={client}>
      <ProductForm onClose={onClose} onSubmit={onSubmit as never} />
    </QueryClientProvider>,
  );
  return { onClose, onSubmit };
}

async function chooseImageAndPrice() {
  const name = await screen.findByLabelText(/nombre/i);
  fireEvent.change(name, { target: { value: "Café" } });

  const input = screen.getByLabelText("Subir imagen del producto");
  const file = new File(["img"], "cafe.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByAltText("cafe.png")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Precios" }));
  const price = await screen.findByLabelText(/precio venta/i);
  fireEvent.change(price, { target: { value: "1500" } });
  fireEvent.submit(screen.getByRole("button", { name: "Crear" }).closest("form")!);
  return file;
}

describe("ProductForm crear con imagen", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    galleryPosts.length = 0;
    galleryStatus = 200;
    localStorage.setItem("frig.token", "test-token");
    useToastStore.setState({ toasts: [] });
    useSessionStore.setState({
      user: {
        id: 1,
        email: "a@b.c",
        is_superuser: true,
        branch_assignments: [{ branch_id: 15, role_code: "OWNER" }],
      } as never,
      branches: [{ branch_id: 15, name: "Local" }] as never,
      currentBranchId: "15",
      modules: { inventory: { is_enabled: true } },
    });
    installFetch();
    const orig = HTMLElement.prototype.animate;
    HTMLElement.prototype.animate = function (this: HTMLElement, ...args: Parameters<HTMLElement["animate"]>) {
      const anim = orig.apply(this, args);
      void anim.finished.catch(() => undefined);
      return anim;
    };
  });

  it("sube la imagen pendiente al crear después de pasar a Precios", async () => {
    const { onClose } = renderCreateForm();
    await chooseImageAndPrice();

    await waitFor(() => {
      expect(galleryPosts).toEqual([expect.objectContaining({ product: "384" })]);
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("muestra un toast si la subida de la imagen falla y no cierra el formulario", async () => {
    galleryStatus = 400;
    galleryError = "No se pudo guardar la imagen";
    const { onClose } = renderCreateForm();
    await chooseImageAndPrice();

    await waitFor(() => {
      expect(useToastStore.getState().toasts.some((t) => t.variant === "error")).toBe(true);
    });
    expect(screen.getByText("No se pudo guardar la imagen")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
