import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { KdsItemExtras } from "./kds-item-extras";

describe("KdsItemExtras", () => {
  afterEach(cleanup);

  it("muestra cada extra y la nota del ítem en la comanda", () => {
    render(
      <KdsItemExtras
        modifiers={[
          { modifier_option_name: "Queso cheddar" },
          { modifier_option_name: "Tocino" },
        ]}
        notes="Sin cebolla"
      />,
    );
    expect(screen.getByText("+ Queso cheddar")).toBeTruthy();
    expect(screen.getByText("+ Tocino")).toBeTruthy();
    expect(screen.getByText("Sin cebolla")).toBeTruthy();
  });

  it("no repite el extra si la nota ya lo trae", () => {
    render(<KdsItemExtras modifiers={[{ option_name: "Tocino" }]} notes={"+ Tocino\nBien cocido"} />);
    expect(screen.getAllByText(/Tocino/)).toHaveLength(1);
    expect(screen.getByText("Bien cocido")).toBeTruthy();
  });

  it("no dibuja nada sin extras ni nota", () => {
    const { container } = render(<KdsItemExtras modifiers={[]} notes="" />);
    expect(container.innerHTML).toBe("");
  });
});
