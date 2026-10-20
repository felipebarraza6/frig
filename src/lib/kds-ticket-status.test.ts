import { describe, expect, it } from "vitest";
import { kitchenAdvanceAction, kitchenRevertStatus } from "@/lib/kds-ticket-status";

describe("kitchenAdvanceAction", () => {
  it("Pendiente → En preparación (start)", () => {
    expect(kitchenAdvanceAction("PENDING")).toEqual({
      label: "Preparar",
      next: "PREPARING",
      endpoint: "start",
    });
  });

  it("En preparación → Listo (ready)", () => {
    expect(kitchenAdvanceAction("PREPARING")?.endpoint).toBe("ready");
  });

  it("Listo → Entregado (deliver)", () => {
    expect(kitchenAdvanceAction("READY")?.endpoint).toBe("deliver");
  });

  it("no avanza Entregado ni Cancelado", () => {
    expect(kitchenAdvanceAction("DELIVERED")).toBeNull();
    expect(kitchenAdvanceAction("CANCELLED")).toBeNull();
  });
});

describe("kitchenRevertStatus", () => {
  it("retrocede un paso", () => {
    expect(kitchenRevertStatus("PREPARING")).toBe("PENDING");
    expect(kitchenRevertStatus("READY")).toBe("PREPARING");
    expect(kitchenRevertStatus("DELIVERED")).toBe("READY");
  });

  it("no retrocede Pendiente ni Cancelado", () => {
    expect(kitchenRevertStatus("PENDING")).toBeNull();
    expect(kitchenRevertStatus("CANCELLED")).toBeNull();
  });
});
