#!/usr/bin/env node
/**
 * Cruza las llamadas API del frontend contra el schema OpenAPI del backend Yggdra.
 * Por defecto lee el freeze ../yggdra_infra/api/schema/openapi.yaml.
 * Override: YGGDRA_SCHEMA_YML o primer argumento CLI.
 * Reporta llamadas frontend sin endpoint en el schema y drift de método HTTP.
 * Exit 1 si hay gaps (para usar como gate).
 * Uso: npm run audit:api  [ruta/al/openapi.yaml]
 */

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as yamlLoad } from "js-yaml";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC_ROOT = path.join(REPO_ROOT, "src");
const SCHEMA = path.resolve(
  process.argv[2] ?? process.env.YGGDRA_SCHEMA_YML ?? path.join(REPO_ROOT, "../yggdra_infra/api/schema/openapi.yaml"),
);

const spec = yamlLoad(readFileSync(SCHEMA, "utf8"));
const backend = {};
for (const [p, methods] of Object.entries(spec.paths || {}).sort()) {
  const entry = {};
  for (const [m, op] of Object.entries(methods)) {
    if (!["get", "post", "put", "patch", "delete"].includes(m)) continue;
    entry[m.toUpperCase()] = { tags: op.tags || [] };
  }
  if (Object.keys(entry).length) backend[p] = entry;
}

const FNAMES = ["apiFetch", "apiFile", "apiGet", "apiPost", "apiPut", "apiPatch", "apiDelete", "fetch"];
const fnRe = new RegExp("\\b(" + FNAMES.join("|") + ")\\b", "g");
const methodRe = /\bmethod\s*:\s*["'](GET|POST|PUT|PATCH|DELETE)["']/;

function readString(src, i) {
  const quote = src[i];
  const out = [];
  i++;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\") { out.push(src.slice(i, i + 2)); i += 2; continue; }
    if (quote === "`" && ch === "$" && src[i + 1] === "{") {
      let depth = 1;
      const start = i;
      i += 2;
      while (i < src.length && depth) { if (src[i] === "{") depth++; else if (src[i] === "}") depth--; i++; }
      out.push(src.slice(start, i));
      continue;
    }
    if (ch === quote) return [out.join(""), i + 1];
    out.push(ch);
    i++;
  }
  return [out.join(""), i];
}

function callExtent(src, openParen) {
  let depth = 0, inStr = null, i = openParen;
  while (i < src.length) {
    const ch = src[i];
    if (inStr) {
      if (ch === "\\") { i += 2; continue; }
      if (ch === inStr) inStr = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") inStr = ch;
    else if (ch === "(") depth++;
    else if (ch === ")") { depth--; if (depth === 0) return src.slice(openParen, i + 1); }
    i++;
  }
  return src.slice(openParen, openParen + 2000);
}

const calls = [];
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) {
      const src = readFileSync(p, "utf8");
      let m;
      fnRe.lastIndex = 0;
      while ((m = fnRe.exec(src))) {
        const fname = m[1];
        let i = m.index + fname.length;
        while (i < src.length && /[A-Za-z0-9_<>,.\s]/.test(src[i])) i++;
        if (i >= src.length || src[i] !== "(") continue;
        let j = i + 1;
        while (j < src.length && /[ \t\n]/.test(src[j])) j++;
        if (j >= src.length || !"\"'`".includes(src[j])) continue;
        const [tmpl] = readString(src, j);
        const lineNo = src.slice(0, m.index).split("\n").length;
        const extent = callExtent(src, i);
        let method;
        if (fname === "apiFetch" || fname === "fetch") {
          const mm = extent.match(methodRe);
          method = mm ? mm[1] : "GET";
        } else if (fname === "apiFile") method = "FILE";
        else method = fname.replace("api", "").toUpperCase();
        calls.push({ file: path.relative(SRC_ROOT, p).split("\\").join("/"), line: lineNo, call: fname, method, template: tmpl.replace(/\n/g, " ").slice(0, 200) });
      }
    }
  }
}
walk(SRC_ROOT);

function stripInterpolation(t) {
  const out = [];
  let i = 0;
  while (i < t.length) {
    if (t[i] === "$" && t[i + 1] === "{") {
      let depth = 1;
      i += 2;
      const start = i;
      while (i < t.length && depth) { if (t[i] === "{") depth++; else if (t[i] === "}") depth--; i++; }
      const inner = t.slice(start, i - 1);
      if (inner.trim() === "API_BASE") continue;
      const isQuery = /^\s*(q|qs|query|queries|params|searchParams|filterQuery|search|firstQs)\s*$/.test(inner);
      if (!isQuery) out.push("{param}");
    } else { out.push(t[i]); i++; }
  }
  return out.join("");
}

function normalize(t) {
  t = stripInterpolation(t).replace(/\{param\}\?.*$/, "{param}").replace(/\?.*$/, "");
  if (!t.startsWith("/")) t = "/" + t;
  if (!t.startsWith("/api/")) t = "/api" + t;
  return t;
}

const backendPaths = Object.keys(backend);
const segs = (p) => p.split("/").filter(Boolean).length;
const sig = (p) => p.split("/").filter(Boolean).map((s) => (/^\{[^}]+\}$/.test(s) ? "{p}" : s)).join("/");
const sigIndex = {};
for (const p of backendPaths) { const s = sig(p); (sigIndex[s] = sigIndex[s] || []).push(p); }
const esc = (s) => [...s].map((ch) => (/[a-zA-Z0-9]/.test(ch) ? ch : "\\" + ch)).join("");

function match(pathT) {
  for (const candidate of [pathT, pathT.replace(/\/\{param\}$/, "")]) {
    const s = sig(candidate);
    if (sigIndex[s]) return sigIndex[s][0];
    if (backend[candidate]) return candidate;
    const rx = new RegExp("^" + esc(candidate).replaceAll(esc("{param}"), "[^/]+").replace(/\/+$/, "") + "/?$");
    for (const dn of [0, 1]) for (const cand of backendPaths) { if (segs(cand) === segs(candidate) + dn && rx.test(cand)) return cand; }
  }
  return null;
}

const used = {};
const unmatched = [];
for (const c of calls) {
  const t = normalize(c.template);
  const bp = match(t);
  const ref = c.file + ":" + c.line;
  if (bp === null) unmatched.push({ ...c, normalized: t });
  else (used[bp] = used[bp] || []).push(c.method + " " + ref);
}

const drift = [];
for (const c of calls) {
  const bp = match(normalize(c.template));
  if (bp && c.method !== "FILE" && !(c.method in backend[bp]))
    drift.push(c.method + " " + normalize(c.template) + " <- " + c.file + ":" + c.line + "  backend: " + Object.keys(backend[bp]).join(","));
}

console.log(JSON.stringify({
  schema: path.relative(REPO_ROOT, SCHEMA),
  backend_paths: backendPaths.length,
  backend_ops: Object.values(backend).reduce((a, v) => a + Object.keys(v).length, 0),
  frontend_calls: calls.length,
  frontend_files: new Set(calls.map((c) => c.file)).size,
  backend_paths_used: Object.keys(used).length,
  unmatched_frontend: unmatched.length,
  method_drift: drift.length,
}, null, 2));

if (unmatched.length) {
  console.log("\n-- UNMATCHED FRONTEND CALLS --");
  for (const u of unmatched) console.log("  " + u.method.padEnd(6) + " " + u.normalized.slice(0, 100).padEnd(102) + " <- " + u.file + ":" + u.line);
}
if (drift.length) {
  console.log("\n-- METHOD DRIFT --");
  drift.forEach((d) => console.log("  " + d));
}
if (unmatched.length || drift.length) {
  console.error(`\n[audit:api] FALLO: ${unmatched.length} llamadas sin match, ${drift.length} drift de método.`);
  process.exit(1);
}
console.log("\n[audit:api] OK: todas las llamadas frontend resuelven contra el schema.");
