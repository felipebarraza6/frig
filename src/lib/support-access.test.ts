import { describe, expect, it } from "vitest";
import {
  SUPPORT_NAV_SEED,
  SUPPORT_PATH,
  canAccessSupportCreate,
  ensureSupportInMenuGroups,
  ensureSupportNavHref,
  isSupportNavItem,
  isSupportPath,
  supportAwareBottomNavHrefs,
} from "./support-access";

describe("support-access visibility", () => {
  it("marca /support como path de soporte", () => {
    expect(isSupportPath("/support")).toBe(true);
    expect(isSupportPath("/support/x")).toBe(true);
    expect(isSupportPath("/help")).toBe(true);
    expect(isSupportPath("/help/guides")).toBe(true);
    expect(isSupportPath("/pos")).toBe(false);
  });

  it("canAccessSupportCreate solo exige sesión (no rol ni módulo)", () => {
    expect(canAccessSupportCreate({ hasUser: true })).toBe(true);
    expect(canAccessSupportCreate({ hasUser: false })).toBe(false);
  });

  it("ensureSupportNavHref inyecta /support si falta", () => {
    expect(ensureSupportNavHref(["/dashboard", "/sales"])).toEqual([
      "/dashboard",
      "/sales",
      SUPPORT_PATH,
    ]);
    expect(ensureSupportNavHref(["/support", "/profile"])).toEqual([
      "/support",
      "/profile",
    ]);
  });

  it("ensureSupportInMenuGroups no duplica y crea grupo Ayuda si hace falta", () => {
    type G = { title: string; items: Array<{ href: string; label: string; module: string | null }> };
    const makeHelp = (item: G["items"][number]): G => ({
      title: "Ayuda",
      items: [item],
    });
    const support = { href: SUPPORT_PATH, label: "Soporte", module: null as string | null };

    const withHelp = ensureSupportInMenuGroups(
      [
        {
          title: "Ayuda",
          items: [{ href: "/help", label: "Docs", module: null }],
        },
      ],
      support,
      makeHelp,
    );
    expect(withHelp[0]!.items.map((i) => i.href)).toEqual(["/help", "/support"]);

    const already = ensureSupportInMenuGroups(withHelp, support, makeHelp);
    expect(already[0]!.items.filter((i) => i.href === "/support")).toHaveLength(1);

    const noHelp = ensureSupportInMenuGroups(
      [{ title: "Ops", items: [{ href: "/pos", label: "POS", module: "pos" }] }],
      support,
      makeHelp,
    );
    expect(noHelp.some((g) => g.title === "Ayuda")).toBe(true);
    expect(noHelp.flatMap((g) => g.items).some((i) => isSupportNavItem(i))).toBe(true);
  });
});

describe("supportAwareBottomNavHrefs por rol", () => {
  it("OWNER/admin (no operativo) incluye /support", () => {
    const hrefs = supportAwareBottomNavHrefs({
      isCashier: false,
      isWaiter: false,
      isCook: false,
    });
    expect(hrefs).toContain(SUPPORT_PATH);
  });

  it("cajero/mesero/cocinero también tienen /support en defaults", () => {
    expect(
      supportAwareBottomNavHrefs({ isCashier: true, isWaiter: false, isCook: false }),
    ).toContain(SUPPORT_PATH);
    expect(
      supportAwareBottomNavHrefs({ isCashier: false, isWaiter: true, isCook: false }),
    ).toContain(SUPPORT_PATH);
    expect(
      supportAwareBottomNavHrefs({ isCashier: false, isWaiter: false, isCook: true }),
    ).toContain(SUPPORT_PATH);
  });
});

describe("menú con módulos apagados", () => {
  it("Soporte (module:null) permanece aunque pos/config estén off", () => {
    const modulesOff = {
      pos: { is_enabled: false },
      config: { is_enabled: false },
      support: { is_enabled: false },
    };

    // Simula el filtro de useFrigMenu: module null siempre visible.
    function isVisible(moduleName: string | null): boolean {
      if (moduleName === null) return true;
      return modulesOff[moduleName as keyof typeof modulesOff]?.is_enabled === true;
    }

    const seed = SUPPORT_NAV_SEED;
    expect(isVisible(seed.module)).toBe(true);
    expect(isVisible("pos")).toBe(false);
    expect(isVisible("config")).toBe(false);
    expect(isVisible("support")).toBe(false);

    type G = { title: string; items: Array<{ href: string; label: string; module: string | null }> };
    const groups = ensureSupportInMenuGroups(
      [
        {
          title: "Operaciones",
          items: [
            { href: "/pos", label: "POS", module: "pos" as string | null },
          ].filter((i) => isVisible(i.module)),
        },
      ],
      { href: seed.href, label: seed.label, module: seed.module },
      (item): G => ({ title: "Ayuda", items: [item] }),
    );

    const visibleItems = groups.flatMap((g) =>
      g.items.filter((i) => isVisible(i.module)),
    );
    expect(visibleItems.some((i) => i.href === SUPPORT_PATH)).toBe(true);
    expect(visibleItems.some((i) => i.href === "/pos")).toBe(false);
  });

  it("roles OWNER y CAJERO pueden crear (solo hace falta hasUser)", () => {
    for (const _role of ["OWNER", "CAJERO", "WAITER", "COOK", "MANAGER"]) {
      expect(canAccessSupportCreate({ hasUser: true })).toBe(true);
    }
  });
});

describe("SUPPORT_NAV_SEED", () => {
  it("no declara módulo (siempre on)", () => {
    expect(SUPPORT_NAV_SEED.module).toBeNull();
    expect(SUPPORT_NAV_SEED.href).toBe("/support");
    expect(SUPPORT_NAV_SEED.label).toMatch(/Soporte/i);
  });
});
