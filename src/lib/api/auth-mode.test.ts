import { describe, expect, it } from "vitest";
import { isCookieSessionHost } from "./auth-mode";

const API = "https://api.yggdra.cl/api";

describe("isCookieSessionHost", () => {
  it("usa cookie en frig.yggdra.cl (mismo sitio que la API)", () => {
    expect(isCookieSessionHost({ protocol: "https:", hostname: "frig.yggdra.cl" }, API)).toBe(true);
  });
  it("usa token en las intranets de clientes", () => {
    expect(
      isCookieSessionHost({ protocol: "https:", hostname: "intranet.macanuobowl.cl" }, API),
    ).toBe(false);
    expect(
      isCookieSessionHost({ protocol: "https:", hostname: "mani.agenciapatagoniachile.com" }, API),
    ).toBe(false);
  });
  it("usa token en staging de GitHub Pages", () => {
    expect(
      isCookieSessionHost(
        { protocol: "https:", hostname: "felipebarraza6.github.io" },
        "https://api-staging.yggdra.cl/api",
      ),
    ).toBe(false);
  });
  it("usa token en desarrollo local", () => {
    expect(
      isCookieSessionHost({ protocol: "http:", hostname: "localhost" }, "http://localhost:8000/api"),
    ).toBe(false);
  });
});
