import { describe, expect, it } from "vitest";
import { findDemoCredentials, type DemoUseCaseSource } from "./demo-login";

const cases: DemoUseCaseSource[] = [
  {
    slug: "pos",
    name: "Kiosco Express San Miguel",
    brand_color: "#f97316",
    demo_user: "pos@example.test",
    demo_password: "secret-pos",
    active: true,
  },
  {
    slug: "heladeria",
    name: "Heladería Glacé Andino",
    brand_color: "#d946ef",
    demo_user: "heladeria@example.test",
    demo_password: "secret-helado",
    active: true,
  },
  {
    slug: "bistro",
    name: "Bistro La Tranquera",
    brand_color: "#d4a017",
    demo_user: "bistro@example.test",
    demo_password: "secret-bistro",
    active: true,
  },
  {
    slug: "apagada",
    demo_user: "off@example.test",
    demo_password: "x",
    active: false,
  },
  {
    slug: "incompleta",
    demo_user: "solo-user@example.test",
    demo_password: "",
    active: true,
  },
];

describe("findDemoCredentials", () => {
  it("resuelve pos / heladeria / bistro con user y password", () => {
    for (const slug of ["pos", "heladeria", "bistro"] as const) {
      const found = findDemoCredentials(cases, slug);
      expect(found).not.toBeNull();
      expect(found!.slug).toBe(slug);
      expect(found!.demoUser.length).toBeGreaterThan(0);
      expect(found!.demoPassword.length).toBeGreaterThan(0);
    }
  });

  it("acepta slug con mayúsculas/espacios", () => {
    const found = findDemoCredentials(cases, "  POS  ");
    expect(found?.slug).toBe("pos");
    expect(found?.demoUser).toBe("pos@example.test");
  });

  it("omite demos inactivas o sin ambas claves", () => {
    expect(findDemoCredentials(cases, "apagada")).toBeNull();
    expect(findDemoCredentials(cases, "incompleta")).toBeNull();
  });

  it("devuelve null sin slug o sin lista", () => {
    expect(findDemoCredentials(cases, null)).toBeNull();
    expect(findDemoCredentials(cases, "")).toBeNull();
    expect(findDemoCredentials(undefined, "pos")).toBeNull();
    expect(findDemoCredentials([], "pos")).toBeNull();
  });
});
