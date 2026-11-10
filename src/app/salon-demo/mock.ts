/**
 * Aislamiento de la demo pública del salón: fetch de la API interceptado
 * para que el canvas 3D corra sin sesión ni datos reales.
 * No pisa un token real: guarda/restaura claves al salir.
 */
if (typeof window !== "undefined") {
  const TOKEN_KEY = "frig.token";
  const COOKIE_SESSION_KEY = "frig.cookie_session";
  const BRANCH_KEY = "frig.branch_id";
  const prevToken = window.localStorage.getItem(TOKEN_KEY);
  const prevCookieSession = window.localStorage.getItem(COOKIE_SESSION_KEY);
  const prevBranch = window.localStorage.getItem(BRANCH_KEY);
  const hadRealSession =
    Boolean(prevToken && prevToken !== "salon-demo-dummy") || prevCookieSession === "1";

  if (!hadRealSession) {
    window.localStorage.setItem(TOKEN_KEY, "salon-demo-dummy");
    window.localStorage.setItem(COOKIE_SESSION_KEY, "1");
    window.localStorage.setItem(BRANCH_KEY, "1");
  }

  const restoreKey = (key: string, value: string | null) => {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  };
  const restore = () => {
    if (hadRealSession) return;
    restoreKey(TOKEN_KEY, prevToken);
    restoreKey(COOKIE_SESSION_KEY, prevCookieSession);
    restoreKey(BRANCH_KEY, prevBranch);
  };
  window.addEventListener("pagehide", restore);
  window.addEventListener("beforeunload", restore);

  const orig = window.fetch.bind(window);
  const flagged = orig as typeof fetch & { __salonDemo?: boolean };
  if (!flagged.__salonDemo) {
    const mocked: typeof fetch = async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      if (url.includes("/api/") || url.includes("localhost:8000")) {
        return new Response(JSON.stringify({ results: [], count: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return orig(input, init);
    };
    (mocked as typeof fetch & { __salonDemo?: boolean }).__salonDemo = true;
    window.fetch = mocked;
  }
}

export {};
