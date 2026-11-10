import { expect, test } from "@playwright/test";

// Solo lectura: entra a una demo pública y recorre pantallas sin vender ni
// mover caja, para no ensuciar producción cada noche.
const API = process.env.FRIG_E2E_API_BASE ?? "https://api.yggdra.cl/api";
const DEMO_SLUG = process.env.FRIG_E2E_DEMO ?? "bistro";

type UseCase = { slug?: string; demo_user?: string; demo_password?: string };

test("demo: login, POS y KDS sin violaciones de CSP ni token legible", async ({
  page,
  request,
  baseURL,
}) => {
  // El backend resuelve el grupo de la landing por el Origin del front.
  const res = await request.get(`${API}/public/landing-config/`, {
    headers: { Origin: new URL(baseURL!).origin },
  });
  expect(res.ok(), `landing-config respondió ${res.status()}`).toBeTruthy();
  const config = (await res.json()) as { content?: { use_cases?: UseCase[] } };
  const demo = config.content?.use_cases?.find((u) => u.slug === DEMO_SLUG);
  expect(demo?.demo_user, `la demo ${DEMO_SLUG} no publica credenciales`).toBeTruthy();

  const cspViolations: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) {
      cspViolations.push(msg.text());
    }
  });

  await page.goto(`/login?branch=${DEMO_SLUG}`);
  await page.waitForLoadState("networkidle");
  const email = page.locator("#email");
  const password = page.locator("#password");
  await email.fill(demo!.demo_user!);
  await password.fill(demo!.demo_password!);
  await expect(email).toHaveValue(demo!.demo_user!);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });

  for (const path of ["/pos", "/kds"]) {
    await page.goto(path);
    await page.waitForLoadState("load");
    await page.waitForTimeout(4_000);
    expect(new URL(page.url()).pathname, `${path} mandó a login`).not.toMatch(/^\/login/);
  }

  if (new URL(baseURL!).hostname.endsWith(".yggdra.cl")) {
    const token = await page.evaluate(() => window.localStorage.getItem("frig.token"));
    expect(token, "en *.yggdra.cl la sesión vive en la cookie HttpOnly").toBeNull();
  }
  expect(cspViolations).toEqual([]);
});
