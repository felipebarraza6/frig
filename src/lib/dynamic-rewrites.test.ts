import { describe, expect, it } from "vitest";
import { apacheTarget, assetTarget, rewriteRequestUrl } from "../../scripts/dynamic-rewrites.mjs";

describe("rewrites del export estático", () => {
  it("manda un slug de menú a la página placeholder", () => {
    expect(apacheTarget("/menu/arena-negra")).toBe("/menu/__.html");
    expect(assetTarget("/menu/arena-negra")).toBe("/menu/__");
  });

  it("no pisa las páginas estáticas de survey", () => {
    expect(apacheTarget("/survey/view")).toBeNull();
    expect(apacheTarget("/survey/fill")).toBeNull();
    expect(apacheTarget("/survey/local-1")).toBe("/survey/__.html");
  });

  it("pasa el id de estación y conserva la query original", () => {
    expect(rewriteRequestUrl("https://frig.yggdra.cl/kds/station/12?night=1")).toBe(
      "https://frig.yggdra.cl/kds/monitor?station_id=12&night=1",
    );
  });

  it("deja quietas las rutas normales", () => {
    expect(assetTarget("/pos")).toBeNull();
    expect(rewriteRequestUrl("https://frig.yggdra.cl/dashboard")).toBeNull();
  });
});
