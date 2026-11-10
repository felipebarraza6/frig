import { describe, expect, it } from "vitest";
import { FRIG_MENU_DEF } from "./modules";

const items = FRIG_MENU_DEF.flatMap((g) => g.items);

describe("menú de cocina y despacho", () => {
  it("el KDS depende solo del módulo de cocina", () => {
    expect(items.find((i) => i.href === "/kds")?.module).toBe("production");
  });

  it("despacho aparece con el módulo de delivery, sin exigir cocina", () => {
    expect(items.find((i) => i.href === "/sales?view=despacho")?.module).toBe("deliveries");
  });
});
