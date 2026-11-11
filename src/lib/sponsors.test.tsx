import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SponsorBadge } from "@/components/sponsor-badge";
import { LOGIN_SLUG_STORAGE_KEY } from "@/lib/login-slug";
import {
  SPONSORED_SLUGS,
  getSponsorForSlug,
  resolveActiveLoginSlug,
  sponsorTicketLine,
} from "@/lib/sponsors";

describe("SPONSORED_SLUGS", () => {
  it("marca todas las sucursales de Michillan con Sercotec", () => {
    for (const slug of [
      "revista-cobquecura",
      "arena-negra",
      "minimarket-buchupureo",
      "dimatteo",
      "hielo-olas-altas",
      "vignosi",
    ]) {
      expect(SPONSORED_SLUGS[slug]).toBe("sercotec");
    }
  });

  it("no patrocina otros slugs", () => {
    expect(getSponsorForSlug("pos")).toBeNull();
    expect(getSponsorForSlug("minimarket")).toBeNull();
    expect(getSponsorForSlug(null)).toBeNull();
  });

  it("normaliza mayúsculas y espacios", () => {
    expect(getSponsorForSlug("  Arena-Negra  ")).toBe("sercotec");
  });
});

describe("resolveActiveLoginSlug", () => {
  afterEach(() => {
    window.localStorage.removeItem(LOGIN_SLUG_STORAGE_KEY);
  });

  it("prioriza login_slug de la sucursal", () => {
    window.localStorage.setItem(LOGIN_SLUG_STORAGE_KEY, "pos");
    expect(resolveActiveLoginSlug({ login_slug: "arena-negra" })).toBe("arena-negra");
  });

  it("cae al slug recordado", () => {
    window.localStorage.setItem(LOGIN_SLUG_STORAGE_KEY, "minimarket-buchupureo");
    expect(resolveActiveLoginSlug(null)).toBe("minimarket-buchupureo");
  });
});

describe("sponsorTicketLine", () => {
  it("devuelve el texto del sello o null", () => {
    expect(sponsorTicketLine("arena-negra")).toBe("Apoyado por Sercotec");
    expect(sponsorTicketLine("pos")).toBeNull();
  });
});

describe("SponsorBadge", () => {
  afterEach(() => cleanup());

  it("no renderiza sin patrocinio", () => {
    const { container } = render(<SponsorBadge slug="pos" />);
    expect(container.firstChild).toBeNull();
  });

  it("muestra Apoyado por Sercotec para Arena Negra", () => {
    render(<SponsorBadge slug="arena-negra" />);
    expect(screen.getByText("Apoyado por Sercotec")).toBeTruthy();
  });
});
