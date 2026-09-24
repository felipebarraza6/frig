#!/usr/bin/env node
/**
 * Sincroniza el contrato del backend Yggdra con el frontend.
 * 1. Obtiene el schema OpenAPI: freeze ../yggdra_infra/api/schema/openapi.yaml o descarga del servidor.
 * 2. Regenera src/lib/api/types/yggdra.d.ts con openapi-typescript.
 * 3. Escribe src/lib/api/contract-sha.ts con el sha256 del contrato.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SIBLING_SCHEMA = resolve(REPO_ROOT, "../yggdra_infra/api/schema/openapi.yaml");
const SIBLING_META = resolve(REPO_ROOT, "../yggdra_infra/api/schema/meta.json");
const OUT_TYPES = resolve(REPO_ROOT, "src/lib/api/types/yggdra.d.ts");
const OUT_SHA = resolve(REPO_ROOT, "src/lib/api/contract-sha.ts");
const TMP_SCHEMA = resolve(REPO_ROOT, "node_modules/.cache/yggdra-openapi.json");

const apiBase = (process.env.NEXT_PUBLIC_YGGDRA_API_BASE ?? "http://localhost:8000/api").replace(/\/+$/, "");

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function writeContractSha(sha) {
  writeFileSync(OUT_SHA,
`// GENERADO POR sync-contract (scripts/sync-contract.mjs), no editar.
// Re-generar con: npm run sync-contract
export const YGGDRA_SCHEMA_SHA = "${sha}";
`);
}

function generateTypes(schemaPath) {
  mkdirSync(dirname(OUT_TYPES), { recursive: true });
  execFileSync(process.execPath, [
    resolve(REPO_ROOT, "node_modules/openapi-typescript/bin/cli.js"),
    schemaPath,
    "-o",
    OUT_TYPES,
  ], { stdio: "inherit", cwd: REPO_ROOT });
}

async function main() {
  const schemaOverride = process.env.YGGDRA_SCHEMA_YML;
  const localSchema = schemaOverride ? resolve(schemaOverride) : SIBLING_SCHEMA;

  if (existsSync(localSchema)) {
    console.log(`[sync-contract] Usando freeze local: ${localSchema}`);
    generateTypes(localSchema);
    let sha;
    const metaPath = schemaOverride ? resolve(dirname(localSchema), "meta.json") : SIBLING_META;
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, "utf8"));
      sha = meta.schema_sha256;
      console.log(`[sync-contract] sha256 desde meta.json: ${sha}`);
    } else {
      sha = sha256(readFileSync(localSchema, "utf8"));
      console.warn(`[sync-contract] meta.json no encontrado; sha256 calculado del YAML: ${sha}`);
    }
    writeContractSha(sha);
    console.log(`[sync-contract] OK -> ${OUT_TYPES} y ${OUT_SHA}`);
    return;
  }

  console.log(`[sync-contract] Freeze local no encontrado; descargando de ${apiBase}`);
  const schemaRes = await fetch(`${apiBase}/schema/?format=json`);
  if (!schemaRes.ok) throw new Error(`GET ${apiBase}/schema/?format=json -> HTTP ${schemaRes.status}`);
  const schemaText = await schemaRes.text();
  mkdirSync(dirname(TMP_SCHEMA), { recursive: true });
  writeFileSync(TMP_SCHEMA, schemaText);

  const contractRes = await fetch(`${apiBase}/schema/contract/`);
  if (!contractRes.ok) throw new Error(`GET ${apiBase}/schema/contract/ -> HTTP ${contractRes.status}`);
  const contract = JSON.parse(await contractRes.text());
  const sha = contract.schema_sha256;
  if (!sha) throw new Error("/api/schema/contract/ no devolvió schema_sha256");

  try {
    generateTypes(TMP_SCHEMA);
  } finally {
    rmSync(TMP_SCHEMA, { force: true });
  }
  writeContractSha(sha);
  console.log(`[sync-contract] sha256 del servidor: ${sha}`);
  console.log(`[sync-contract] OK -> ${OUT_TYPES} y ${OUT_SHA}`);
}

main().catch((err) => {
  console.error(`[sync-contract] ERROR: ${err.message}`);
  process.exit(1);
});
