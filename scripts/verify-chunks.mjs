// Falla si el export referencia un chunk de /_next/static que no está en out/.
// Eso es el "Failed to load chunk" de producción: el JS pide un archivo que
// el deploy no tiene.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = join(fileURLToPath(new URL("..", import.meta.url)), "out");
const chunkRef = /(?:\/_next\/)?static\/chunks\/([A-Za-z0-9_.~-]+\.(?:js|css))/g;
const textExt = new Set([".html", ".js", ".css", ".txt", ".json"]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, acc);
    else acc.push(path);
  }
  return acc;
}

function extOf(path) {
  const i = path.lastIndexOf(".");
  return i === -1 ? "" : path.slice(i);
}

const missing = new Map();
for (const file of walk(outDir)) {
  if (!textExt.has(extOf(file))) continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const match of text.matchAll(chunkRef)) {
    const rel = `_next/static/chunks/${match[1]}`;
    const abs = join(outDir, rel);
    try {
      if (!statSync(abs).isFile()) throw new Error("not a file");
    } catch {
      const from = relative(outDir, file);
      const list = missing.get(rel) ?? [];
      if (!list.includes(from)) list.push(from);
      missing.set(rel, list);
    }
  }
}

if (missing.size === 0) {
  console.log("OK: cada chunk referenciado está en out/");
  process.exit(0);
}

console.error(`Faltan ${missing.size} chunks en out/:`);
for (const [rel, from] of missing) {
  console.error(`  ${rel}`);
  for (const source of from.slice(0, 5)) console.error(`    ← ${source}`);
}
process.exit(1);
