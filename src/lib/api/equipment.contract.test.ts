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
  apiFetch.mockResolvedValue({ id: 1 });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createEquipmentMeasurement", () => {
  it("envía branch en el body (requerido por la API)", async () => {
    const { createEquipmentMeasurement } = await import("./equipment");
    await createEquipmentMeasurement({
      branch: 13,
      product: 99,
      measurement_type: "temperature",
      value: 3.2,
      unit: "°C",
      min_value: 0,
      max_value: 5,
      notes: "QA lectura",
    });

    expect(apiFetch).toHaveBeenCalledOnce();
    const [path, init] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/equipment/measurements/");
    expect(init).toMatchObject({
      method: "POST",
      body: expect.objectContaining({
        branch: 13,
        product: 99,
        measurement_type: "temperature",
        value: 3.2,
        unit: "°C",
      }),
    });
  });

  it("el payload tipado exige branch (no se puede omitir en create)", async () => {
    const { createEquipmentMeasurement } = await import("./equipment");
    // Compilación: CreateEquipmentMeasurementPayload.branch es obligatorio.
    // En runtime comprobamos que el body lo incluye cuando se pasa.
    await createEquipmentMeasurement({
      branch: 13,
      product: 1,
      measurement_type: "humidity",
      value: 40,
      unit: "%",
    });
    const body = apiFetch.mock.calls[0]![1].body as { branch: number };
    expect(body.branch).toBe(13);
    expect(body).toHaveProperty("branch");
  });
});

describe("update/delete equipment measurement", () => {
  it("PATCH incluye branch si se envía", async () => {
    const { updateEquipmentMeasurement } = await import("./equipment");
    await updateEquipmentMeasurement(7, {
      branch: 13,
      value: 4.1,
      unit: "°C",
    });
    const [path, init] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/equipment/measurements/7/");
    expect(init).toMatchObject({
      method: "PATCH",
      body: { branch: 13, value: 4.1, unit: "°C" },
    });
  });

  it("DELETE medición", async () => {
    const { deleteEquipmentMeasurement } = await import("./equipment");
    await deleteEquipmentMeasurement(7);
    expect(apiFetch).toHaveBeenCalledWith("/equipment/measurements/7/", {
      method: "DELETE",
    });
  });
});

describe("equipment profile status / delete", () => {
  it("PATCH cambia equipment_status", async () => {
    const { updateEquipmentProfile } = await import("./equipment");
    await updateEquipmentProfile(5, { equipment_status: "OUT_OF_SERVICE" });
    expect(apiFetch).toHaveBeenCalledWith("/equipment/profiles/5/", {
      method: "PATCH",
      body: { equipment_status: "OUT_OF_SERVICE" },
    });
  });

  it("DELETE perfil", async () => {
    const { deleteEquipmentProfile } = await import("./equipment");
    await deleteEquipmentProfile(5);
    expect(apiFetch).toHaveBeenCalledWith("/equipment/profiles/5/", {
      method: "DELETE",
    });
  });
});

describe("equipment maintenances", () => {
  it("POST mantenimiento incluye branch y fecha", async () => {
    const { createEquipmentMaintenance } = await import("./equipment");
    await createEquipmentMaintenance({
      branch: 13,
      product: 99,
      maintenance_type: "PREVENTIVE",
      maintenance_date: "2026-10-17",
      description: "QA revisión filtros",
      cost: 15000,
    });
    const [path, init] = apiFetch.mock.calls[0]!;
    expect(path).toBe("/equipment/maintenances/");
    expect(init).toMatchObject({
      method: "POST",
      body: expect.objectContaining({
        branch: 13,
        product: 99,
        maintenance_type: "PREVENTIVE",
        maintenance_date: "2026-10-17",
        description: "QA revisión filtros",
      }),
    });
  });

  it("GET lista por producto", async () => {
    apiFetch.mockResolvedValueOnce({ results: [] });
    const { fetchEquipmentMaintenances } = await import("./equipment");
    await fetchEquipmentMaintenances({ product: 99 });
    expect(apiFetch.mock.calls[0]![0]).toContain("/equipment/maintenances/");
    expect(apiFetch.mock.calls[0]![0]).toContain("product=99");
  });

  it("DELETE mantenimiento", async () => {
    const { deleteEquipmentMaintenance } = await import("./equipment");
    await deleteEquipmentMaintenance(3);
    expect(apiFetch).toHaveBeenCalledWith("/equipment/maintenances/3/", {
      method: "DELETE",
    });
  });
});
