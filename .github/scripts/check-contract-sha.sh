#!/usr/bin/env bash
# Compara YGGDRA_SCHEMA_SHA del front con el schema_sha256 vivo de prod.
set -euo pipefail

: "${CONTRACT_SHA_PATH:?}"
URL="https://api.yggdra.cl/api/schema/contract/"
RESP=$(curl -fsS --max-time 20 "$URL") || {
  echo "::error::No se pudo leer ${URL}"
  exit 1
}
LIVE=$(printf '%s' "$RESP" | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{let j;try{j=JSON.parse(d)}catch{process.exit(2)}const sha=j&&j.schema_sha256;if(!sha||!/^[0-9a-fA-F]{64}$/.test(sha))process.exit(3);process.stdout.write(String(sha).toLowerCase())})') || {
  echo "::error::${URL} no trae schema_sha256 legible"
  exit 1
}
if [ ! -f "$CONTRACT_SHA_PATH" ] || [ ! -r "$CONTRACT_SHA_PATH" ]; then
  echo "::error::No se puede leer ${CONTRACT_SHA_PATH}"
  exit 1
fi
LOCAL=$(sed -n 's/.*YGGDRA_SCHEMA_SHA = "\([0-9a-fA-F]\{64\}\)".*/\1/p' "$CONTRACT_SHA_PATH" | head -n 1 | tr 'A-F' 'a-f')
if [ -z "$LOCAL" ]; then
  echo "::error::No se pudo leer YGGDRA_SCHEMA_SHA en ${CONTRACT_SHA_PATH}"
  exit 1
fi
echo "prod:  ${LIVE}"
echo "front: ${LOCAL}"
if [ "$LIVE" != "$LOCAL" ]; then
  echo "::error::schema_sha256 de prod (${LIVE}) distinto del front (${LOCAL}). Actualiza el sha y los tipos, y vuelve a commitear."
  exit 1
fi
