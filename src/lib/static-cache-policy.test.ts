import { describe, expect, it } from "vitest";
import { isCacheableStatic } from "../../public/sw-policy.mjs";

function response(ok: boolean, type: string) {
  return {
    ok,
    headers: { get: (name: string) => (name === "content-type" ? type : null) },
  };
}

describe("isCacheableStatic", () => {
  it("guarda js y css", () => {
    expect(isCacheableStatic(response(true, "application/javascript"))).toBe(true);
    expect(isCacheableStatic(response(true, "text/css; charset=utf-8"))).toBe(true);
  });

  it("no guarda el HTML de un 404 ni una respuesta fallida", () => {
    expect(isCacheableStatic(response(false, "text/html"))).toBe(false);
    expect(isCacheableStatic(response(true, "text/html; charset=utf-8"))).toBe(false);
  });
});
