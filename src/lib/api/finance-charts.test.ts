import { describe, expect, it } from "vitest";
import { expensesToFrequencyTotals, revenuesToDailyTotals } from "./finance-charts";

describe("revenuesToDailyTotals", () => {
  it("agrupa la lista revenues del API por fecha", () => {
    const rows = revenuesToDailyTotals({
      revenues: [
        { revenue_date: "2026-11-01", amount: "1000.00" },
        { revenue_date: "2026-11-01", amount: "500" },
        { revenue_date: "2026-11-02", amount: 200 },
      ],
    });
    expect(rows).toEqual([
      { date: "2026-11-01", total: 1500 },
      { date: "2026-11-02", total: 200 },
    ]);
  });
});

describe("expensesToFrequencyTotals", () => {
  it("lee la lista directa del API", () => {
    const rows = expensesToFrequencyTotals([
      { frequency: "MONTHLY", total: "120000.00", count: 2 },
    ]);
    expect(rows).toEqual([{ frequency: "MONTHLY", total: 120000, count: 2 }]);
  });
});
