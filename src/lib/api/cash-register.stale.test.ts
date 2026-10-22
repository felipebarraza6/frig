import { describe, expect, it } from "vitest";
import {
  isTodayOpenRegister,
  staleOpenCount,
  staleOpenRegistersFromCurrent,
  type CashRegister,
} from "./cash-register";

function stale(id: number, date: string): CashRegister {
  return {
    id,
    date,
    status: "OPEN",
    station: 1,
    station_name: "Caja Principal",
    opening_amount: "10000.00",
    expected_amount: "12000.00",
    opened_by: 7,
    stale: true,
    blocking: true,
  } as unknown as CashRegister;
}

describe("staleOpenRegistersFromCurrent", () => {
  it("devuelve todas las OPEN antiguas del payload", () => {
    const current = {
      ...stale(22, "2026-10-21"),
      stale_open_count: 2,
      stale_open_registers: [
        {
          id: 21,
          date: "2026-10-20",
          station_name: "Caja Principal",
          opening_amount: "10000.00",
          expected_amount: "11000.00",
          opened_by: 7,
        },
        {
          id: 22,
          date: "2026-10-21",
          station_name: "Caja Principal",
          opening_amount: "20000.00",
          expected_amount: "22000.00",
          opened_by: 7,
        },
      ],
    };
    const listed = staleOpenRegistersFromCurrent(current);
    expect(listed.map((r) => r.id)).toEqual([21, 22]);
    expect(staleOpenCount(current)).toBe(2);
  });

  it("caja de hoy con antiguas: count > 0 y la de hoy no es stale", () => {
    const current = {
      id: 30,
      date: "2026-10-22",
      status: "OPEN" as const,
      station: 1,
      stale: false,
      blocking: true,
      stale_open_count: 1,
      stale_open_registers: [
        {
          id: 21,
          date: "2026-10-20",
          station_name: "Caja Principal",
          opening_amount: "10000.00",
          expected_amount: "11000.00",
          opened_by: 7,
        },
      ],
    } as CashRegister;
    expect(isTodayOpenRegister(current, "2026-10-22")).toBe(true);
    expect(staleOpenCount(current)).toBe(1);
    expect(staleOpenRegistersFromCurrent(current)[0]?.id).toBe(21);
  });
});
