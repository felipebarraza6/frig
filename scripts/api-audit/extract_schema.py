#!/usr/bin/env python3
"""Extrae paths+methods del schema OpenAPI vivo y los exporta a JSON.

Uso: python3 extract_schema.py [salida.json]
Lee el schema de $YGGDRA_SCHEMA_YML o /tmp/opencode/yggdra-schema.yml.
Descarga el schema con:
  curl -s http://localhost:8000/api/schema/ -o /tmp/opencode/yggdra-schema.yml
"""
import json
import os
import sys

import yaml

schema_path = os.environ.get("YGGDRA_SCHEMA_YML", "/tmp/opencode/yggdra-schema.yml")
out_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/opencode/backend-paths.json"

with open(schema_path) as f:
    spec = yaml.safe_load(f)

paths = spec.get("paths", {})
out = {}
for path, methods in sorted(paths.items()):
    entry = {}
    for method, op in methods.items():
        if method not in ("get", "post", "put", "patch", "delete"):
            continue
        entry[method.upper()] = {
            "operationId": op.get("operationId", ""),
            "summary": (op.get("summary") or "")[:120],
            "tags": op.get("tags", []),
        }
    if entry:
        out[path] = entry

with open(out_path, "w") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)

print(f"paths: {len(out)}")
print(f"operations: {sum(len(v) for v in out.values())}")
