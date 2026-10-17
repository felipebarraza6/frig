/**
 * Flujo integrado caja → venta → cobro → cierre (API mockeada).
 * Cubre open, cash in/out, createOrder, createPayment/payOrder, close OWNER,
 * y 403 vs “sin caja” en getCurrentCashRegister.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();

vi.mock("./client", async () => {
  const actual = await vi.importActual<typeof import("./client")>("./client");
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => apiFetch(...args),
  };
});

beforeEach(() => {
  apiFetch.mockReset();
  window.localStorage.clear();
  window.localStorage.setItem("frig.branch_id", "7");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("flujo: caja + cobro (contrato mock)", () => {
  it("abrir → cash in → vender → pagar → cash out → cerrar", async () => {
    const { ApiError } = await import("./client");
    const { openCashRegister, cashIn, cashOut, closeCashRegister, getCurrentCashRegister } =
      await import("./cash-register");
    const { createOrder } = await import("./orders");
    const { createPayment } = await import("./payments");

    apiFetch
      .mockResolvedValueOnce({ id: 9, status: "OPEN", opening_amount: "10000" })
      .mockResolvedValueOnce({ id: 1, movement_type: "CASH_IN", amount: "2000" })
      .mockResolvedValueOnce({
        id: "ord-42",
        order_type: "SALE",
        status: "PENDING",
        payment_status: "PENDING",
        total_amount: "3500",
      })
      .mockResolvedValueOnce({ id: "pay-42", status: "COMPLETED", amount: "3500" })
      .mockResolvedValueOnce({ id: 2, movement_type: "CASH_OUT", amount: "500" })
      .mockResolvedValueOnce({ id: 9, status: "CLOSED", closing_amount: "15000" })
      .mockRejectedValueOnce(new ApiError(404, "No abierta"));

    const opened = await openCashRegister({
      branch_id: 7,
      opening_amount: 10000,
      station_id: 1,
    });
    expect(opened.id).toBe(9);
    expect(apiFetch.mock.calls[0]![0]).toBe("/finance/cash-registers/open/");

    await cashIn(9, { amount: "2000", reason: "Fondo extra" });
    expect(apiFetch.mock.calls[1]![0]).toBe("/finance/cash-registers/9/cash_in/");

    const order = await createOrder({
      items: [{ product: 11, quantity: 1, unit_price: "3500.00" }],
      order_type: "SALE",
    });
    expect(order.id).toBe("ord-42");

    await createPayment({
      payment_method_id: "pm-cash",
      order_id: order.id,
      amount: 3500,
      status: "COMPLETED",
      cash_register_id: 9,
    });
    const payBody = apiFetch.mock.calls[3]![1].body;
    expect(payBody).toMatchObject({
      order_id: "ord-42",
      cash_register_id: 9,
      skip_cash_register_validation: false,
    });

    await cashOut(9, { amount: "500", reason: "Retiro parcial" });
    expect(apiFetch.mock.calls[4]![0]).toBe("/finance/cash-registers/9/cash_out/");

    const closed = await closeCashRegister(9, {
      closing_amount: 15000,
      notes: "cierre turno",
    });
    expect(closed.status).toBe("CLOSED");
    expect(apiFetch.mock.calls[5]![0]).toBe("/finance/cash-registers/9/close/");

    await expect(getCurrentCashRegister(1)).resolves.toBeNull();
  });

  it("getCurrentCashRegister: 404 → null; 403 → throw", async () => {
    const { ApiError } = await import("./client");
    const { getCurrentCashRegister } = await import("./cash-register");

    apiFetch.mockRejectedValueOnce(new ApiError(404, "No abierta"));
    await expect(getCurrentCashRegister(3)).resolves.toBeNull();

    apiFetch.mockRejectedValueOnce(new ApiError(403, "Forbidden"));
    await expect(getCurrentCashRegister(3)).rejects.toMatchObject({ status: 403 });
  });

  it("payOrder desde Ventas exige skip_cash_register_validation=false", async () => {
    apiFetch.mockResolvedValueOnce({ id: "ord-1", payment_status: "PAID" });
    const { payOrder } = await import("./orders");
    await payOrder("ord-1", {
      payment_method_id: "pm-1",
      amount: "1000.00",
      cash_register_id: 9,
      skip_cash_register_validation: false,
    });
    expect(apiFetch.mock.calls[0]![1].body).toMatchObject({
      skip_cash_register_validation: false,
      cash_register_id: 9,
    });
    expect(apiFetch.mock.calls[0]![1].body).not.toHaveProperty("order_type");
  });

  it("cancel-movement acepta movement_id numérico o string (compat contrato)", async () => {
    const { cancelMovement } = await import("./cash-register");
    apiFetch
      .mockResolvedValueOnce({ id: 1, movement_type: "CASH_IN" })
      .mockResolvedValueOnce({ id: 2, movement_type: "CASH_OUT" });

    await cancelMovement(9, { movement_id: 11, reason: "error" });
    expect(apiFetch.mock.calls[0]![0]).toBe("/finance/cash-registers/9/cancel-movement/");
    expect(apiFetch.mock.calls[0]![1].body).toMatchObject({ movement_id: 11 });

    await cancelMovement(9, { movement_id: "12", reason: "duplicado" });
    expect(apiFetch.mock.calls[1]![1].body).toMatchObject({ movement_id: "12" });
  });
});

describe("regla: cerrar caja solo OWNER", () => {
  it("OWNER / superadmin pueden; cajero y mesero no", async () => {
    const { canManageCashMovements } = await import("../store/session");
    const user = (role: string, branchId = 7) =>
      ({
        branch_assignments: [{ branch_id: branchId, role_code: role }],
      }) as never;

    expect(canManageCashMovements(user("OWNER"), "7")).toBe(true);
    expect(canManageCashMovements(user("ADMIN_LOCAL"), "7")).toBe(false);
    expect(canManageCashMovements(user("CAJERO"), "7")).toBe(false);
    expect(canManageCashMovements(user("MESERO"), "7")).toBe(false);
    expect(canManageCashMovements(user("OWNER"), "8")).toBe(false);
    expect(canManageCashMovements({ is_superuser: true } as never, null)).toBe(true);
    expect(canManageCashMovements(null, "7")).toBe(false);
  });
});
