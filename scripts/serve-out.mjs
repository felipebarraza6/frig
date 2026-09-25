// Servidor estático mínimo para out/ (build export). Uso: node scripts/serve-out.mjs [puerto]
import { createServer } from "node:http";
import { readFile, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = join(import.meta.dirname, "..", "out");
const PORT = Number(process.argv[2] || 3000);
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json",
};

createServer((req, res) => {
  try {
    const url = decodeURIComponent(req.url.split("?")[0]);
    let p = join(ROOT, url);
    let st = statSync(p);
    if (st.isDirectory()) p = join(p, "index.html");
    else if (!st.isFile()) throw new Error("nf");
    res.setHeader("Content-Type", MIME[extname(p)] || "application/octet-stream");
    res.end(readFile(p));
  } catch {
    // fallback: /ruta → /ruta.html
    try {
      const url = decodeURIComponent(req.url.split("?")[0]);
      const p = join(ROOT, url + ".html");
      statSync(p);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(readFile(p));
    } catch {
      res.statusCode = 404;
      res.end("not found");
    }
  }
}).listen(PORT, () => console.log(`sirviendo out/ en http://localhost:${PORT}`));
