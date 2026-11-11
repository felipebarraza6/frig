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

  it("un 304 es ApiError y no se parsea como fallo de servidor", async () => {
    window.localStorage.setItem("frig.token", "tok-1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 304, headers: { ETag: '"abc"' } })),
    );
    const { apiFetch, ApiError } = await import("./client");
    const seen: number[] = [];
    await expect(
      apiFetch("/shared/frontend-config/", {
        onResponse: (res) => seen.push(res.status),
      }),
    ).rejects.toMatchObject({ status: 304 });
    expect(seen).toEqual([304]);
    await expect(apiFetch("/shared/frontend-config/")).rejects.toBeInstanceOf(ApiError);
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
    expect(
      formatErrorDetail({ dni: ["Dígito verificador incorrecto"] }),
    ).toBe("Dígito verificador incorrecto");
    expect(
      formatErrorDetail({ email: ["Este correo ya está registrado."] }),
    ).toBe("Este correo ya está registrado.");
    expect(
      formatErrorDetail({
        name: ["Ya existe una zona activa con ese nombre"],
      }),
    ).toBe("Ya existe una zona activa con ese nombre");
  });

  it("en un dominio custom el POST de login no manda cookies ni pide CSRF", async () => {
    vi.stubEnv("NEXT_PUBLIC_YGGDRA_API_BASE", "https://api.yggdra.cl/api");
    vi.stubGlobal("location", {
      protocol: "https:",
      hostname: "dimatteo.michillan.cl",
      origin: "https://dimatteo.michillan.cl",
      assign: vi.fn(),
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ token: "t" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const { apiFetch } = await import("./client");
    await apiFetch("/accounts/users/login_complete/", {
      method: "POST",
      body: { email: "a@b.cl", password: "x" },
      auth: "none",
      credentials: "include",
    });
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain("/accounts/users/login_complete/");
    expect(init?.credentials).toBe("omit");
    const headers = init?.headers as Record<string, string>;
    expect(headers["X-CSRFToken"]).toBeUndefined();
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("apiFetch con sesión por cookie (frig.yggdra.cl)", () => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_YGGDRA_API_BASE", "https://api.yggdra.cl/api");
    vi.stubGlobal("location", {
      protocol: "https:",
      hostname: "frig.yggdra.cl",
      origin: "https://frig.yggdra.cl",
      assign: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("no manda Authorization y el GET no pide CSRF", async () => {
    window.localStorage.setItem("frig.cookie_session", "1");
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true })));
    const { apiFetch } = await import("./client");
    await apiFetch("/accounts/users/me/");
    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe("https://api.yggdra.cl/api/accounts/users/me/");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers["X-CSRFToken"]).toBeUndefined();
    expect(init?.credentials).toBe("include");
  });

  it("el POST lleva X-CSRFToken de /accounts/csrf/", async () => {
    window.localStorage.setItem("frig.cookie_session", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/accounts/csrf/") ? json({ csrfToken: "csrf-1" }) : json({ ok: true }),
      ),
    );
    const { apiFetch } = await import("./client");
    await apiFetch("/sales/orders/", { method: "POST", body: {} });
    const post = vi.mocked(fetch).mock.calls.find(([u]) => String(u).endsWith("/sales/orders/"));
    const headers = post?.[1]?.headers as Record<string, string>;
    expect(headers["X-CSRFToken"]).toBe("csrf-1");
    expect(headers.Authorization).toBeUndefined();
  });

  it("borra el token viejo de localStorage y conserva la sesión", async () => {
    window.localStorage.setItem("frig.token", "tok-legacy");
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true })));
    const { apiFetch } = await import("./client");
    await apiFetch("/accounts/users/me/");
    expect(window.localStorage.getItem("frig.token")).toBeNull();
    expect(window.localStorage.getItem("frig.cookie_session")).toBe("1");
    const headers = vi.mocked(fetch).mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("con CSRF vencido pide otro token y reintenta una vez", async () => {
    window.localStorage.setItem("frig.cookie_session", "1");
    let csrfCalls = 0;
    let postCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/accounts/csrf/")) {
          csrfCalls += 1;
          return json({ csrfToken: `csrf-${csrfCalls}` });
        }
        postCalls += 1;
        return postCalls === 1
          ? json({ detail: "CSRF Failed: CSRF token incorrect." }, 403)
          : json({ ok: true });
      }),
    );
    const { apiFetch } = await import("./client");
    await expect(apiFetch("/accounts/users/logout/", { method: "POST" })).resolves.toEqual({
      ok: true,
    });
    expect(csrfCalls).toBe(2);
    expect(postCalls).toBe(2);
  });
});
