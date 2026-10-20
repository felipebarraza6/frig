import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/login-slug", () => ({
  loginRedirectUrl: (origin?: string) => `${origin ?? ""}/login/demo-slug`,
}));

vi.mock("./branch-scope", () => ({
  getEffectiveBranchId: (id: string | null) => id,
}));

describe("apiFetch", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("envía Authorization Token y X-Branch-ID", async () => {
    window.localStorage.setItem("frig.token", "tok-1");
    window.localStorage.setItem("frig.branch_id", "42");
    const { apiFetch } = await import("./client");
    await apiFetch("/shared/ping/");
    expect(fetch).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Token tok-1");
    expect(headers["X-Branch-ID"]).toBe("42");
  });

  it("en 401 limpia sesión y redirige a /login/<slug>", async () => {
    window.localStorage.setItem("frig.token", "tok-1");
    window.localStorage.setItem("frig.branch_id", "42");
    window.localStorage.setItem("frig.session", "{}");
    const assign = vi.fn();
    vi.stubGlobal("location", {
      origin: "https://frig.yggdra.cl",
      assign,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: "Token inválido" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { apiFetch, ApiError } = await import("./client");
    await expect(apiFetch("/shared/ping/")).rejects.toBeInstanceOf(ApiError);
    expect(window.localStorage.getItem("frig.token")).toBeNull();
    expect(window.localStorage.getItem("frig.branch_id")).toBeNull();
    expect(assign).toHaveBeenCalledWith("https://frig.yggdra.cl/login/demo-slug");
  });

  it("formatea ApiError en 403 sin redirigir", async () => {
    window.localStorage.setItem("frig.token", "tok-1");
    const assign = vi.fn();
    vi.stubGlobal("location", { origin: "https://frig.yggdra.cl", assign });
    const dispatch = vi.spyOn(window, "dispatchEvent");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: "Sin permiso" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { apiFetch } = await import("./client");
    await expect(apiFetch("/shared/ping/")).rejects.toMatchObject({
      status: 403,
      message: "Sin permiso",
    });
    expect(assign).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalled();
  });

  it("muestra el mensaje real del API sin prefijo notes: ni Error 500", async () => {
    window.localStorage.setItem("frig.token", "tok-1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ notes: ["Este campo no puede ser nulo."] }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { apiFetch, formatErrorDetail } = await import("./client");
    await expect(apiFetch("/sales/orders/1/pay/")).rejects.toMatchObject({
      status: 400,
      message: "Este campo no puede ser nulo.",
    });
    expect(formatErrorDetail({ error: "Error procesando el pago: Falta referencia." })).toBe(
      "Falta referencia.",
    );
    expect(
      formatErrorDetail({
        detail: "Debes abrir la caja antes de cobrar",
        code: "cash_register_closed",
      }),
    ).toBe("Debes abrir la caja antes de cobrar");
  });
});
