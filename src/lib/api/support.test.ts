import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();

vi.mock("./client", async () => {
  const actual = await vi.importActual<typeof import("./client")>("./client");
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => apiFetch(...args),
  };
});

describe("supportCreateErrorMessage", () => {
  it("explica 403 y 401 con mensaje accionable", async () => {
    const { ApiError } = await import("./client");
    const { supportCreateErrorMessage } = await import("./support");
    expect(supportCreateErrorMessage(new ApiError(403, "Forbidden"))).toMatch(
      /No tienes permiso/,
    );
    expect(supportCreateErrorMessage(new ApiError(401, "Gone"))).toMatch(/sesión expiró/i);
    expect(supportCreateErrorMessage(new ApiError(503, "boom"))).toMatch(/no responde/i);
  });
});

describe("createSupportTicketByCode", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("usa POST /tickets/submit/ con category_code en minúsculas (sin bootstrap)", async () => {
    apiFetch.mockResolvedValueOnce({ id: "t-1", subject: "[Duda] Hola" });
    const { createSupportTicketByCode, SUPPORT_TICKET_SUBMIT_PATH } =
      await import("./support");
    const ticket = await createSupportTicketByCode({
      subject: "[Duda] Hola",
      description: "Necesito ayuda con la caja",
      category_code: "duda",
      priority: "MEDIUM",
      requester_email: "a@b.cl",
    });
    expect(ticket.id).toBe("t-1");
    expect(apiFetch).toHaveBeenCalledOnce();
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe(SUPPORT_TICKET_SUBMIT_PATH);
    expect(path).toBe("/support/tickets/submit/");
    expect(opts.method).toBe("POST");
    expect(opts.body).toEqual({
      subject: "[Duda] Hola",
      description: "Necesito ayuda con la caja",
      category_code: "duda",
      priority: "MEDIUM",
    });
    expect(opts.body).not.toHaveProperty("category");
    expect(opts.body).not.toHaveProperty("sla_policy");
    expect(opts.body).not.toHaveProperty("source");
    expect(opts.body).not.toHaveProperty("requester_email");
  });

  it("hace fallback a POST /tickets/ con category_code si submit es 404", async () => {
    const { ApiError } = await import("./client");
    apiFetch
      .mockRejectedValueOnce(new ApiError(404, "Not found"))
      .mockResolvedValueOnce({ id: "t-2", subject: "[Feedback] Idea" });
    const { createSupportTicketByCode } = await import("./support");
    const ticket = await createSupportTicketByCode({
      subject: "[Feedback] Idea",
      description: "Me gustaría un reporte semanal",
      category_code: "feedback",
      priority: "LOW",
    });
    expect(ticket.id).toBe("t-2");
    expect(apiFetch.mock.calls.map((c) => c[0])).toEqual([
      "/support/tickets/submit/",
      "/support/tickets/",
    ]);
    expect(apiFetch.mock.calls[1]![1].body).toMatchObject({
      category_code: "feedback",
      priority: "LOW",
    });
  });

  it("propaga 403 sin intentar seed de categorías", async () => {
    const { ApiError } = await import("./client");
    apiFetch.mockRejectedValueOnce(new ApiError(403, "Forbidden"));
    const { createSupportTicketByCode } = await import("./support");
    await expect(
      createSupportTicketByCode({
        subject: "[Incidencia] Caída",
        description: "El POS no carga",
        category_code: "incidencia",
        priority: "HIGH",
      }),
    ).rejects.toMatchObject({ status: 403 });
    expect(apiFetch).toHaveBeenCalledOnce();
    expect(apiFetch.mock.calls[0]![0]).toBe("/support/tickets/submit/");
  });

  it("fallback de lectura: categorías existentes sin POST de seed", async () => {
    const { ApiError } = await import("./client");
    apiFetch
      .mockRejectedValueOnce(new ApiError(404, "Not found"))
      .mockRejectedValueOnce(new ApiError(400, "category_code unknown"))
      .mockResolvedValueOnce([{ id: "cat-duda", name: "Duda", is_active: true }])
      .mockResolvedValueOnce([{ id: "sla-1", name: "Default", is_active: true }])
      .mockResolvedValueOnce({ id: "t-3", subject: "[Duda] X" });
    const { createSupportTicketByCode } = await import("./support");
    const ticket = await createSupportTicketByCode({
      subject: "[Duda] X",
      description: "Cómo cierro la caja del día",
      category_code: "duda",
      priority: "MEDIUM",
    });
    expect(ticket.id).toBe("t-3");
    const paths = apiFetch.mock.calls.map((c) => c[0] as string);
    expect(paths[0]).toBe("/support/tickets/submit/");
    expect(paths).toContain("/support/categories/?page_size=100");
    expect(paths).toContain("/support/sla-policies/?page_size=50");
    expect(paths.filter((p) => p === "/support/categories/")).toHaveLength(0);
    expect(paths.filter((p) => p === "/support/sla-policies/")).toHaveLength(0);
    const createCall = apiFetch.mock.calls.find(
      (c) => c[0] === "/support/tickets/" && c[1]?.method === "POST" && c[1]?.body?.category,
    );
    expect(createCall?.[1].body).toMatchObject({
      category: "cat-duda",
      sla_policy: "sla-1",
    });
  });
});

describe("SUPPORT_INQUIRY_OPTIONS", () => {
  it("cubre los cinco códigos del contrato submit (minúsculas)", async () => {
    const { SUPPORT_INQUIRY_OPTIONS } = await import("./support");
    expect(SUPPORT_INQUIRY_OPTIONS.map((o) => o.categoryCode)).toEqual([
      "duda",
      "incidencia",
      "reclamo",
      "feedback",
      "manual",
    ]);
  });
});
