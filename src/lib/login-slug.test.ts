import { afterEach, describe, expect, it } from "vitest";
import {
  LOGIN_SLUG_STORAGE_KEY,
  getRememberedLoginSlug,
  loginPath,
  loginRedirectUrl,
  normalizeLoginSlug,
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
