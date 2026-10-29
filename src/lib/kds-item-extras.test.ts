import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import {
  kitchenModifierOptionNames,
  kitchenItemNotesForDisplay,
} from "@/lib/kds-item-extras";
import { KdsItemExtras } from "@/components/kds/kds-item-extras";

describe("kitchenModifierOptionNames", () => {
  it("usa option_name de KitchenTicketItem.modifiers", () => {
    expect(
      kitchenModifierOptionNames([
        {
          option_name: "Extra queso",
        },
      ]),
    ).toEqual(["Extra queso"]);
  });

  it("usa modifier_option_name de OrderProduct.modifiers", () => {
    expect(
      kitchenModifierOptionNames([
        { modifier_option_name: "Sin cebolla", option_name: undefined },
      ]),
    ).toEqual(["Sin cebolla"]);
  });

  it("ignora vacíos y null", () => {
    expect(kitchenModifierOptionNames(null)).toEqual([]);
    expect(kitchenModifierOptionNames([{ option_name: "  " }])).toEqual([]);
  });
});

describe("kitchenItemNotesForDisplay", () => {
  it("devuelve la nota del ítem cuando no hay extras duplicados", () => {
    expect(kitchenItemNotesForDisplay("sin hielo", ["Extra queso"])).toBe("sin hielo");
  });

  it("omite líneas '+ option' ya mostradas como modifiers", () => {
    expect(
      kitchenItemNotesForDisplay("sin hielo\n+ Extra queso", ["Extra queso"]),
    ).toBe("sin hielo");
  });

  it("si notes solo trae los '+ extra', no muestra nota", () => {
    expect(kitchenItemNotesForDisplay("+ Extra queso\n+ Tocino", ["Extra queso", "Tocino"])).toBeNull();
  });

  it("si no hay modifiers, deja notes intactas (pueden incluir '+ extra')", () => {
    expect(kitchenItemNotesForDisplay("+ Extra queso", [])).toBe("+ Extra queso");
  });
});

describe("KdsItemExtras render", () => {
  it("muestra '+ option_name' y la nota sin duplicar extras", () => {
    const html = renderToStaticMarkup(
      createElement(KdsItemExtras, {
        modifiers: [{ option_name: "Extra queso" }],
        notes: "sin hielo\n+ Extra queso",
      }),
    );
    expect(html).toContain("+ Extra queso");
    expect(html).toContain("sin hielo");
    // Una sola aparición del extra (línea estructurada; no se repite desde notes)
    expect(html.match(/\+ Extra queso/g)?.length).toBe(1);
  });
});
