import { afterEach, describe, expect, it } from "vitest";
import {
  LOGIN_SLUG_STORAGE_KEY,
  forgotPasswordBody,
  getRememberedLoginSlug,
  loginPath,
  loginRedirectUrl,
  normalizeLoginSlug,
  recoverLoginSlug,
  rememberLoginSlug,
} from "./login-slug";

describe("normalizeLoginSlug", () => {
  it("acepta slugs válidos", () => {
    expect(normalizeLoginSlug("macanuobowl")).toBe("macanuobowl");
    expect(normalizeLoginSlug("  mani-demo  ")).toBe("mani-demo");
  });

  it("rechaza basura e inyección de path", () => {
    expect(normalizeLoginSlug("")).toBeNull();
    expect(normalizeLoginSlug("login")).toBeNull();
    expect(normalizeLoginSlug("../evil")).toBeNull();
    expect(normalizeLoginSlug("a/b")).toBeNull();
    expect(normalizeLoginSlug(null)).toBeNull();
  });

  it("recupera arena-negra desde un slug con punto y sufijo", () => {
    expect(normalizeLoginSlug("arena-negra-.ll-nkce-de-ac-a")).toBe("arena-negra");
    expect(recoverLoginSlug("arena-negra-extra-junk", ["hielo-olas-altas", "arena-negra"])).toBe(
      "arena-negra",
    );
  });
});

describe("forgotPasswordBody", () => {
  it("manda login_slug normalizado cuando hay branch", () => {
    expect(
      forgotPasswordBody("a@b.cl", "arena-negra-.ll-nkce-de-ac-a", ["arena-negra"]),
    ).toEqual({ email: "a@b.cl", login_slug: "arena-negra" });
  });

  it("el login genérico solo manda el email", () => {
    expect(forgotPasswordBody("a@b.cl", null)).toEqual({ email: "a@b.cl" });
    expect(forgotPasswordBody("a@b.cl", "")).toEqual({ email: "a@b.cl" });
  });
});

describe("rememberLoginSlug / loginPath", () => {
  afterEach(() => {
    window.localStorage.removeItem(LOGIN_SLUG_STORAGE_KEY);
  });

  it("persiste y construye /login/<slug>", () => {
    rememberLoginSlug("macanuobowl");
    expect(getRememberedLoginSlug()).toBe("macanuobowl");
    expect(loginPath()).toBe("/login/macanuobowl");
    expect(loginRedirectUrl("https://frig.yggdra.cl")).toBe(
      "https://frig.yggdra.cl/login/macanuobowl",
    );
  });

  it("sin slug vuelve a /login", () => {
    expect(loginPath()).toBe("/login");
  });
});
