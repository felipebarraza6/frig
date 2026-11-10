import { describe, expect, it } from "vitest";
import type { TelemetryReading } from "@/lib/api/iot";
import { valueDomain, variableSeries } from "./iot-chart";

const reading = (over: Partial<TelemetryReading>): TelemetryReading => ({
  id: "1",
  device: "7",
  variable: "3",
  reading_at: "2026-11-10T10:00:00Z",
  raw_value: 0,
  processed_value: 0,
  unit: "°C",
  branch: 15,
  ...over,
});

describe("variableSeries", () => {
  it("ordena por fecha y deja fuera errores y otras variables", () => {
    const series = variableSeries(
      [
        reading({ id: "a", reading_at: "2026-11-10T12:00:00Z", processed_value: "6.5" }),
        reading({ id: "b", reading_at: "2026-11-10T10:00:00Z", processed_value: 4 }),
        reading({ id: "c", is_error: true, processed_value: 99 }),
        reading({ id: "d", variable: "9", processed_value: 1 }),
      ],
      "3",
    );
    expect(series.map((p) => p.value)).toEqual([4, 6.5]);
  });
});

describe("valueDomain", () => {
  it("incluye el umbral aunque ninguna lectura lo alcance", () => {
    const [min, max] = valueDomain([2, 4], [8]);
    expect(min).toBeLessThan(2);
    expect(max).toBeGreaterThan(8);
  });
  it("abre el rango cuando todas las lecturas son iguales", () => {
    expect(valueDomain([5, 5], [])).toEqual([3.8, 6.2]);
  });
  it("acepta valores bajo cero", () => {
    const [min] = valueDomain([-18, -20], [-15]);
    expect(min).toBeLessThan(-20);
  });
});
