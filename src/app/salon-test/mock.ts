/** Mock temporal para QA visual del salón. Borrar con la página. */
if (typeof window !== "undefined") {
  window.localStorage.setItem("frig.token", "salon-test-dummy");
  window.localStorage.setItem("frig.branch_id", "1");
  const orig = window.fetch.bind(window);
  const flagged = orig as typeof fetch & { __salonTest?: boolean };
  if (!flagged.__salonTest) {
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
    (mocked as typeof fetch & { __salonTest?: boolean }).__salonTest = true;
    window.fetch = mocked;
  }
}

export {};
