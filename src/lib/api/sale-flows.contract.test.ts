/**
 * Tests de contrato / integración (mocks) para flujos críticos de venta.
 * Valida ruta, método y shape del body alineados a yggdra.d.ts + probes de api.yggdra.cl.
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

describe("contrato: crear venta", () => {
  it("POST /sales/orders/ con order_type, date e items", async () => {
    apiFetch.mockResolvedValueOnce({
      id: "ord-1",
      order_type: "SALE",
      status: "PENDING",
      payment_status: "PENDING",
      total_amount: 1500,
    });
    const { createOrder } = await import("./orders");
    const order = await createOrder({
      items: [
        {
          product: 11,
          quantity: 2,
          unit_price: "750.00",
          modifiers: [
            { modifier_option: 3, surcharge_applied: "0.00", notes: null },
          ],
        },
      ],
      order_type: "SALE",
      client_id: 5,
      table_id: 2,
      observation: "sin cebolla",
    });
    expect(order.id).toBe("ord-1");
    expect(apiFetch).toHaveBeenCalledOnce();
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/sales/orders/");
    expect(opts.method).toBe("POST");
    expect(opts.body).toMatchObject({
      order_type: "SALE",
      client_id: 5,
      table_id: 2,
      observation: "sin cebolla",
      items: [
        {
          product: 11,
          quantity: 2,
          unit_price: "750.00",
          modifiers: [{ modifier_option: 3, surcharge_applied: "0.00", notes: null }],
        },
      ],
    });
    expect(typeof opts.body.date).toBe("string");
    expect(Number.isNaN(Date.parse(opts.body.date))).toBe(false);
  });
});

describe("contrato: cobrar", () => {
  it("POST /finance/payments/ inyecta skip_cash_register_validation", async () => {
    apiFetch.mockResolvedValueOnce({ id: "pay-1", status: "COMPLETED" });
    const { createPayment } = await import("./payments");
    await createPayment({
      payment_method_id: "pm-cash",
      order_id: "ord-1",
      amount: 1500,
      status: "COMPLETED",
      cash_register_id: 9,
    });
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/finance/payments/");
    expect(opts.method).toBe("POST");
    expect(opts.body).toMatchObject({
      payment_method_id: "pm-cash",
      order_id: "ord-1",
      amount: 1500,
      status: "COMPLETED",
      cash_register_id: 9,
      skip_cash_register_validation: false,
    });
  });

  it("POST /sales/orders/{id}/pay/ con PayOrderPayload dedicado", async () => {
    apiFetch.mockResolvedValueOnce({ id: "ord-1", payment_status: "PAID" });
    const { payOrder } = await import("./orders");
    await payOrder("ord-1", {
      payment_method_id: "pm-1",
      amount: "1500.00",
      cash_register_id: 9,
      notes: "cobro cuenta",
    });
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/sales/orders/ord-1/pay/");
    expect(opts.method).toBe("POST");
    expect(opts.body).toEqual({
      payment_method_id: "pm-1",
      amount: "1500.00",
      cash_register_id: 9,
      notes: "cobro cuenta",
    });
    // OpenAPI tipa mal este action como OrderRequest; el front NO debe mandar order_type/date.
    expect(opts.body).not.toHaveProperty("order_type");
    expect(opts.body).not.toHaveProperty("date");
  });
});

describe("contrato: caja abrir/cerrar", () => {
  it("POST /finance/cash-registers/open/ con branch_id y opening_amount", async () => {
    apiFetch.mockResolvedValueOnce({ id: 9, status: "OPEN", opening_amount: 10000 });
    const { openCashRegister } = await import("./cash-register");
    await openCashRegister({
      branch_id: 7,
      opening_amount: 10000,
      station_id: 1,
      notes: "apertura turno",
    });
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/finance/cash-registers/open/");
    expect(opts.method).toBe("POST");
    expect(opts.body).toMatchObject({
      branch_id: 7,
      opening_amount: 10000,
      station_id: 1,
    });
  });

  it("POST /finance/cash-registers/{id}/close/", async () => {
    apiFetch.mockResolvedValueOnce({ id: 9, status: "CLOSED" });
    const { closeCashRegister } = await import("./cash-register");
    await closeCashRegister(9, {
      closing_amount: 25000,
      notes: "cierre OK",
    });
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/finance/cash-registers/9/close/");
    expect(opts.method).toBe("POST");
    expect(opts.body).toMatchObject({
      closing_amount: 25000,
      notes: "cierre OK",
    });
  });

  it("GET current: 404 → null; 403 → throw (no confundir con sin caja)", async () => {
    const { ApiError } = await import("./client");
    const { getCurrentCashRegister, getDailySummary } = await import("./cash-register");
    apiFetch.mockRejectedValueOnce(new ApiError(404, "No abierta"));
    await expect(getCurrentCashRegister(1)).resolves.toBeNull();
    apiFetch.mockRejectedValueOnce(new ApiError(403, "Sin permiso"));
    await expect(getCurrentCashRegister(1)).rejects.toMatchObject({ status: 403 });
    apiFetch.mockRejectedValueOnce(new ApiError(403, "Sin permiso"));
    await expect(getDailySummary(1)).resolves.toBeNull();
  });

  it("payOrder reenvía skip_cash_register_validation (Ventas debe usar false)", async () => {
    apiFetch.mockResolvedValueOnce({ id: "ord-1", status: "PAID" });
    const { payOrder } = await import("./orders");
    await payOrder("ord-1", {
      payment_method_id: "pm-1",
      amount: "1000.00",
      skip_cash_register_validation: false,
    });
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/sales/orders/ord-1/pay/");
    expect(opts.body).toMatchObject({
      payment_method_id: "pm-1",
      amount: "1000.00",
      skip_cash_register_validation: false,
    });
  });
});

describe("contrato: ingresos/retiros de caja (cualquier miembro)", () => {
  it("POST /finance/cash-registers/{id}/cash_in/ con amount y reason", async () => {
    apiFetch.mockResolvedValueOnce({ id: 1, movement_type: "CASH_IN" });
    const { cashIn } = await import("./cash-register");
    await cashIn(9, { amount: "1000", reason: "Vuelto" } as never);
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/finance/cash-registers/9/cash_in/");
    expect(opts.method).toBe("POST");
    expect(opts.body).toMatchObject({ amount: "1000", reason: "Vuelto" });
  });

  it("POST /finance/cash-registers/{id}/cash_out/ con amount y reason", async () => {
    apiFetch.mockResolvedValueOnce({ id: 2, movement_type: "CASH_OUT" });
    const { cashOut } = await import("./cash-register");
    await cashOut(9, { amount: "500", reason: "Retiro" } as never);
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/finance/cash-registers/9/cash_out/");
    expect(opts.method).toBe("POST");
    expect(opts.body).toMatchObject({ amount: "500", reason: "Retiro" });
  });

  it("cualquier rol de la sucursal activa puede registrar; no miembro no", async () => {
    const { canRegisterCashMovements } = await import("../store/session");
    const user = (role: string) =>
      ({ branch_assignments: [{ branch_id: 7, role_code: role }] }) as never;
    for (const role of ["OWNER", "ADMIN_LOCAL", "MANAGER", "CAJERO", "MESERO"]) {
      expect(canRegisterCashMovements(user(role), "7")).toBe(true);
    }
    expect(canRegisterCashMovements(user("CAJERO"), "8")).toBe(false);
    expect(canRegisterCashMovements(user("CAJERO"), null)).toBe(false);
    expect(canRegisterCashMovements(null, "7")).toBe(false);
    expect(canRegisterCashMovements({ is_superuser: true } as never, null)).toBe(true);
  });
});

describe("regla: abrir caja (cualquier miembro)", () => {
  it("cualquier rol de la sucursal activa o super admin puede abrir caja", async () => {
    const { canOpenCashRegister } = await import("../store/session");
    const user = (role: string) =>
      ({ branch_assignments: [{ branch_id: 7, role_code: role }] }) as never;
    for (const role of ["OWNER", "ADMIN_LOCAL", "CAJERO", "MESERO"]) {
      expect(canOpenCashRegister(user(role), "7")).toBe(true);
    }
    expect(canOpenCashRegister(user("CAJERO"), "8")).toBe(false);
    expect(canOpenCashRegister(null, "7")).toBe(false);
    expect(canOpenCashRegister({ type_user: "ADM" } as never, null)).toBe(true);
  });
});

describe("contrato: mesa / comanda", () => {
  it("POST /tables/tables/{id}/occupy/ con action occupy|free", async () => {
    apiFetch
      .mockResolvedValueOnce({ message: "ok", table: { id: 2, status: "OCCUPIED" } })
      .mockResolvedValueOnce({ message: "ok", table: { id: 2, status: "FREE" } });
    const { occupyTable, freeTable } = await import("./tables");
    await occupyTable(2, { action: "occupy", order_id: "ord-1", estimated_duration: 60 });
    expect(apiFetch.mock.calls[0]![0]).toBe("/tables/tables/2/occupy/");
    expect(apiFetch.mock.calls[0]![1]).toMatchObject({
      method: "POST",
      body: { action: "occupy", order_id: "ord-1", estimated_duration: 60 },
    });
    await freeTable(2);
    expect(apiFetch.mock.calls[1]![0]).toBe("/tables/tables/2/occupy/");
    expect(apiFetch.mock.calls[1]![1].body).toEqual({ action: "free" });
  });
});

describe("contrato: alta producto / receta", () => {
  it("POST /inventory/products/", async () => {
    apiFetch.mockResolvedValueOnce({ id: 55, name: "Empanada", price: 1200 });
    const { createProduct } = await import("./products");
    await createProduct({
      name: "Empanada",
      price: "1200.00",
      is_for_sale: true,
      is_active: true,
    } as never);
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/inventory/products/");
    expect(opts.method).toBe("POST");
    expect(opts.body).toMatchObject({ name: "Empanada", is_for_sale: true });
  });

  it("POST /recipes/recipes/ inyecta branch + code", async () => {
    apiFetch.mockResolvedValueOnce({ id: "rcp-1", name: "Salsa", code: "RCP-X" });
    const { createRecipe } = await import("./recipes");
    await createRecipe({ name: "Salsa", servings: 4 } as never);
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/recipes/recipes/");
    expect(opts.method).toBe("POST");
    expect(opts.body).toMatchObject({
      name: "Salsa",
      branch: 7,
      recipe_type: "SIMPLE",
      status: "ACTIVE",
    });
    expect(typeof opts.body.code).toBe("string");
    expect(opts.body.code.length).toBeGreaterThan(0);
  });
});

describe("contrato: checkout suscripción Flow", () => {
  it("POST /public/frig-checkout/ con campos PlanCheckoutCreateRequest", async () => {
    apiFetch.mockResolvedValueOnce({
      checkout_id: "chk-1",
      payment_url: "https://www.flow.cl/pay/x",
      status: "pending",
    });
    const { fetchCheckout, checkoutPath } = await import("./checkout");
    expect(checkoutPath("frig")).toBe("/public/frig-checkout/");
    await fetchCheckout({
      plan_id: "frig-pro",
      business_name: "Café Sur",
      contact_name: "Ana",
      email: "ana@cafe.cl",
      website: "https://cafe.cl",
    });
    const [path, opts] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/public/frig-checkout/");
    expect(opts.method).toBe("POST");
    expect(opts.auth).toBe("none");
    expect(opts.branch).toBe("none");
    expect(opts.body).toEqual({
      checkout_type: "organization",
      installments_count: 1,
      plan_id: "frig-pro",
      business_name: "Café Sur",
      contact_name: "Ana",
      email: "ana@cafe.cl",
      website: "https://cafe.cl",
    });
  });
});

describe("contrato: crear ticket soporte", () => {
  it("POST /support/tickets/submit/ con category_code en minúsculas", async () => {
    apiFetch.mockResolvedValueOnce({ id: "t-9", subject: "[Duda] Caja" });
    const { createSupportTicketByCode, SUPPORT_TICKET_SUBMIT_PATH } =
      await import("./support");
    await createSupportTicketByCode({
      subject: "[Duda] Caja",
      description: "No cierra el arqueo",
      category_code: "duda",
      priority: "MEDIUM",
    });
    expect(apiFetch.mock.calls[0]![0]).toBe(SUPPORT_TICKET_SUBMIT_PATH);
    expect(apiFetch.mock.calls[0]![1]).toMatchObject({
      method: "POST",
      body: {
        subject: "[Duda] Caja",
        description: "No cierra el arqueo",
        category_code: "duda",
        priority: "MEDIUM",
      },
    });
  });
});
