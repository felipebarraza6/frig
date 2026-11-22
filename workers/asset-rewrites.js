// Reescribe las rutas dinámicas del export estático y deja el resto a
// los assets. run_worker_first en wrangler.jsonc limita cuándo corre esto.
import { rewriteRequestUrl } from "../scripts/dynamic-rewrites.mjs";

export default {
  async fetch(request, env) {
    const dest = rewriteRequestUrl(request.url);
    if (!dest) return env.ASSETS.fetch(request);
    return env.ASSETS.fetch(new Request(dest, request));
  },
};
