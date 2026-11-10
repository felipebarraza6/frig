import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KitchenTicket } from "@/lib/api/kitchen";
import type { useKitchenTicketMutations } from "@/lib/hooks/useKitchenTicketMutations";
import { KdsTicketActions } from "./kds-ticket-actions";

type Mutations = ReturnType<typeof useKitchenTicketMutations>;

function mutation() {
  return { mutate: vi.fn(), isPending: false };
}

function mutations(): Mutations {
  return {
    startMutation: mutation(),
    readyMutation: mutation(),
    deliverMutation: mutation(),
    revertMutation: mutation(),
    cancelMutation: mutation(),
  } as unknown as Mutations;
}

const ticket = (status: string) => ({ id: 41, status, items: [] }) as unknown as KitchenTicket;

describe("KdsTicketActions", () => {
  afterEach(cleanup);

  it("una comanda pendiente se manda a preparar", () => {
    const m = mutations();
    render(<KdsTicketActions ticket={ticket("PENDING")} mutations={m} />);
    expect(screen.queryByTitle("Retroceder un estado")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Preparar" }));
    expect(m.startMutation.mutate).toHaveBeenCalledWith(41);
  });

  it("en preparación se marca lista o se devuelve a pendiente", () => {
    const m = mutations();
    render(<KdsTicketActions ticket={ticket("PREPARING")} mutations={m} />);
    fireEvent.click(screen.getByRole("button", { name: "Listo" }));
    expect(m.readyMutation.mutate).toHaveBeenCalledWith(41);
    fireEvent.click(screen.getByTitle("Retroceder un estado"));
    expect(m.revertMutation.mutate).toHaveBeenCalledWith({ id: 41, previous: "PENDING" });
  });

  it("una comanda lista se entrega", () => {
    const m = mutations();
    render(<KdsTicketActions ticket={ticket("READY")} mutations={m} />);
    fireEvent.click(screen.getByRole("button", { name: "Entregar" }));
    expect(m.deliverMutation.mutate).toHaveBeenCalledWith(41);
  });

  it("cancelar solo aparece si se pide y la comanda sigue abierta", () => {
    const m = mutations();
    const { rerender } = render(
      <KdsTicketActions ticket={ticket("PENDING")} mutations={m} showCancel />,
    );
    fireEvent.click(screen.getByTitle("Cancelar comanda"));
    expect(m.cancelMutation.mutate).toHaveBeenCalledWith(41);

    rerender(<KdsTicketActions ticket={ticket("DELIVERED")} mutations={m} showCancel />);
    expect(screen.queryByTitle("Cancelar comanda")).toBeNull();
  });

  it("mientras una acción corre los botones quedan deshabilitados", () => {
    const m = mutations();
    (m.startMutation as unknown as { isPending: boolean }).isPending = true;
    render(<KdsTicketActions ticket={ticket("PREPARING")} mutations={m} />);
    expect(screen.getByRole("button", { name: /Listo/ }).hasAttribute("disabled")).toBe(true);
  });
});
