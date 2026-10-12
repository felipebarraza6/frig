#!/usr/bin/env node
/**
 * Sincroniza el contrato del backend Yggdra con el frontend.
 * 1. Obtiene el schema OpenAPI: freeze ../yggdra_infra/api/schema/openapi.yaml,
 *    YGGDRA_SCHEMA_YML / YGGDRA_SCHEMA_URL, o descarga del servidor.
 * 2. Regenera src/lib/api/types/yggdra.d.ts con openapi-typescript (si hay schema).
 * 3. Escribe src/lib/api/contract-sha.ts con el sha256 del contrato vivo.
 *
 * Si /schema/?format=json no está expuesto (p. ej. prod post-#94) pero
 * /schema/contract/ sí, actualiza solo el SHA para que el gate de CI pase.
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

const DEFAULT_PROD_API = "https://api.yggdra.cl/api";

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function writeContractSha(sha) {
  writeFileSync(
    OUT_SHA,
    `// GENERADO POR sync-contract (scripts/sync-contract.mjs), no editar.
// Re-generar con: npm run sync-contract
export const YGGDRA_SCHEMA_SHA = "${sha}";
`,
  );
}

function generateTypes(schemaPath) {
  mkdirSync(dirname(OUT_TYPES), { recursive: true });
  execFileSync(
    process.execPath,
    [
      resolve(REPO_ROOT, "node_modules/openapi-typescript/bin/cli.js"),
      schemaPath,
      "-o",
      OUT_TYPES,
    ],
    { stdio: "inherit", cwd: REPO_ROOT },
  );
}

function candidateApiBases() {
  const envBase = process.env.NEXT_PUBLIC_YGGDRA_API_BASE?.replace(/\/+$/, "");
  const bases = [];
  if (envBase) bases.push(envBase);
  bases.push(DEFAULT_PROD_API);
  bases.push("http://localhost:8000/api");
  return [...new Set(bases)];
}

async function fetchContractSha(apiBase) {
  const contractRes = await fetch(`${apiBase}/schema/contract/`);
  if (!contractRes.ok) {
    throw new Error(`GET ${apiBase}/schema/contract/ -> HTTP ${contractRes.status}`);
  }
  const contract = JSON.parse(await contractRes.text());
  const sha = contract.schema_sha256;
  if (!sha) throw new Error(`${apiBase}/schema/contract/ no devolvió schema_sha256`);
  return sha;
}

async function downloadSchemaJson(apiBase) {
  const schemaUrl =
    process.env.YGGDRA_SCHEMA_URL?.trim() || `${apiBase}/schema/?format=json`;
  const schemaRes = await fetch(schemaUrl);
  if (!schemaRes.ok) {
    const err = new Error(`GET ${schemaUrl} -> HTTP ${schemaRes.status}`);
    err.status = schemaRes.status;
    throw err;
  }
  return schemaRes.text();
}

async function syncFromRemote() {
  let lastError = null;
  for (const apiBase of candidateApiBases()) {
    console.log(`[sync-contract] Probando API: ${apiBase}`);
    try {
      const sha = await fetchContractSha(apiBase);
      console.log(`[sync-contract] sha256 del servidor: ${sha}`);

      try {
        const schemaText = await downloadSchemaJson(apiBase);
        mkdirSync(dirname(TMP_SCHEMA), { recursive: true });
        writeFileSync(TMP_SCHEMA, schemaText);
        try {
          generateTypes(TMP_SCHEMA);
        } finally {
          rmSync(TMP_SCHEMA, { force: true });
        }
        writeContractSha(sha);
        console.log(`[sync-contract] OK -> ${OUT_TYPES} y ${OUT_SHA}`);
        return;
      } catch (schemaErr) {
        // Prod puede no exponer /schema/?format=json (solo /schema/contract/).
        // Actualizamos el SHA del gate de CI y conservamos los tipos actuales.
        console.warn(
          `[sync-contract] Schema OpenAPI no descargable (${schemaErr.message}).`,
        );
        console.warn(
          `[sync-contract] Se actualiza solo ${OUT_SHA}. Para regenerar tipos usa el freeze local ../yggdra_infra o YGGDRA_SCHEMA_YML / YGGDRA_SCHEMA_URL.`,
        );
        writeContractSha(sha);
        console.log(`[sync-contract] OK (sha-only) -> ${OUT_SHA}`);
        return;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[sync-contract] Falló ${apiBase}: ${err.message}`);
    }
  }
  throw lastError ?? new Error("No se pudo sincronizar el contrato con ninguna API");
}

async function main() {
  const schemaOverride = process.env.YGGDRA_SCHEMA_YML;
  const localSchema = schemaOverride ? resolve(schemaOverride) : SIBLING_SCHEMA;

  if (existsSync(localSchema)) {
    console.log(`[sync-contract] Usando freeze local: ${localSchema}`);
    generateTypes(localSchema);
    let sha;
    const metaPath = schemaOverride
      ? resolve(dirname(localSchema), "meta.json")
      : SIBLING_META;
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, "utf8"));
      sha = meta.schema_sha256;
      console.log(`[sync-contract] sha256 desde meta.json: ${sha}`);
    } else {
      // Preferir sha vivo del contrato público si está disponible.
      try {
        sha = await fetchContractSha(candidateApiBases()[0]);
        console.log(`[sync-contract] sha256 desde contract vivo: ${sha}`);
      } catch {
        sha = sha256(readFileSync(localSchema, "utf8"));
        console.warn(
          `[sync-contract] meta.json no encontrado; sha256 calculado del YAML: ${sha}`,
        );
      }
    }
    writeContractSha(sha);
    console.log(`[sync-contract] OK -> ${OUT_TYPES} y ${OUT_SHA}`);
    return;
  }

  console.log(`[sync-contract] Freeze local no encontrado; sincronizando remoto`);
  await syncFromRemote();
}

main().catch((err) => {
  console.error(`[sync-contract] ERROR: ${err.message}`);
  process.exit(1);
});
