// Recupera archivos src/ perdidos desde los sourcemaps de .next (sourcesContent).
// Resuelve cada source contra el directorio del .map y acepta solo lo que cae
// dentro de <repo>/src. Solo escribe archivos que NO existen en el árbol.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(import.meta.dirname, "..");

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".map")) out.push(p);
  }
  return out;
}

const maps = walk(join(ROOT, ".next"));
console.log("maps encontrados:", maps.length);

const found = new Map(); // rel -> { content, from, mtime }
let parseErrors = 0;

function harvest(mapObj, mapPath) {
  const sources = mapObj.sources || [];
  const contents = mapObj.sourcesContent || [];
  for (let i = 0; i < sources.length; i++) {
    const c = contents[i];
    const raw = sources[i];
    if (!c || !raw) continue;
    let abs;
    try {
      if (raw.startsWith("file://")) abs = fileURLToPath(raw);
      else if (isAbsolute(raw)) abs = resolve(raw);
      else abs = resolve(dirname(mapPath), raw);
    } catch { continue; }
    const rel = relative(ROOT, abs).replace(/\\/g, "/");
    if (!rel.startsWith("src/") || rel.includes("node_modules") || rel.includes("..")) continue;
    if (!/\.(ts|tsx|js|jsx|css|mjs|cjs)$/.test(rel)) continue;
    const mtime = statSync(mapPath).mtimeMs;
    const prev = found.get(rel);
    if (!prev || mtime > prev.mtime) found.set(rel, { content: c, from: mapPath, mtime });
  }
  if (Array.isArray(mapObj.sections)) {
    for (const sec of mapObj.sections) if (sec && sec.map) harvest(sec.map, mapPath);
  }
}

for (const mp of maps) {
  try {
    harvest(JSON.parse(readFileSync(mp, "utf8")), mp);
  } catch { parseErrors++; }
}

console.log("fuentes src/ del proyecto con contenido:", found.size, "| maps sin parsear:", parseErrors);

let written = 0, skipped = 0;
for (const [rel, { content }] of [...found].sort(([a], [b]) => a.localeCompare(b))) {
  const dest = join(ROOT, rel);
  if (existsSync(dest)) { skipped++; continue; }
  try {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, content);
    written++;
    console.log("  ✓", rel);
  } catch (e) {
    console.log("  ✗ ERROR", JSON.stringify(rel), "->", e.code);
  }
}
console.log(`\nRECUPERADOS: ${written} | ya existían (omitidos): ${skipped}`);
