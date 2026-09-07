#!/usr/bin/env python3
"""Inventariar llamadas API del frontend con escaneo manual de strings.

Maneja template literals con interpolación ${...} anidada (incl. backticks
internos), imposible de capturar con regex.

Uso: python3 extract_frontend.py [raiz_src] [salida.json]
"""
import json
import os
import re
import sys

ROOT = sys.argv[1] if len(sys.argv) > 1 else "src"
out_path = sys.argv[2] if len(sys.argv) > 2 else "/tmp/opencode/frontend-calls.json"
FNAMES = ("apiFetch", "apiFile", "apiGet", "apiPost", "apiPut", "apiPatch", "apiDelete", "fetch")
method_re = re.compile(r"\bmethod\s*:\s*[\"'](GET|POST|PUT|PATCH|DELETE)[\"']")

def read_string(src, i):
    quote = src[i]
    out = []
    i += 1
    while i < len(src):
        ch = src[i]
        if ch == "\\":
            out.append(src[i : i + 2])
            i += 2
            continue
        if quote == "`" and ch == "$" and i + 1 < len(src) and src[i + 1] == "{":
            depth = 1
            start = i
            i += 2
            while i < len(src) and depth:
                if src[i] == "{":
                    depth += 1
                elif src[i] == "}":
                    depth -= 1
                i += 1
            out.append(src[start:i])
            continue
        if ch == quote:
            return "".join(out), i + 1
        out.append(ch)
        i += 1
    return "".join(out), i

def call_extent(src, open_paren):
    depth = 0
    in_str = None
    i = open_paren
    while i < len(src):
        ch = src[i]
        if in_str:
            if ch == "\\":
                i += 2
                continue
            if ch == in_str:
                in_str = None
            i += 1
            continue
        if ch in "\"'`":
            in_str = ch
        elif ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return src[open_paren : i + 1]
        i += 1
    return src[open_paren : open_paren + 2000]

out = []
fn_alt = "|".join(FNAMES)
for dirpath, _, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith((".ts", ".tsx")):
            continue
        p = os.path.join(dirpath, fn)
        with open(p, errors="replace") as f:
            src = f.read()
        for m in re.finditer(rf"\b({fn_alt})\b", src):
            fname = m.group(1)
            i = m.end()
            while i < len(src) and re.match(r"[A-Za-z0-9_<>,.\s]", src[i]):
                i += 1
            if i >= len(src) or src[i] != "(":
                continue
            j = i + 1
            while j < len(src) and src[j] in " \t\n":
                j += 1
            if j >= len(src) or src[j] not in "\"'`":
                continue
            tmpl, _ = read_string(src, j)
            line_no = src[: m.start()].count("\n") + 1
            extent = call_extent(src, i)
            if fname in ("apiFetch", "fetch"):
                mm = method_re.search(extent)
                method = mm.group(1) if mm else "GET"
            elif fname == "apiFile":
                method = "FILE"
            else:
                method = fname.replace("api", "").upper()
            out.append({
                "file": os.path.relpath(p, ROOT),
                "line": line_no,
                "call": fname,
                "method": method,
                "template": tmpl.replace("\n", " ")[:200],
            })

with open(out_path, "w") as f:
    json.dump(out, f, indent=1, ensure_ascii=False)

print(f"calls: {len(out)}")
print(f"files with calls: {len({c['file'] for c in out})}")
by_method = {}
for c in out:
    by_method[c["method"]] = by_method.get(c["method"], 0) + 1
print(by_method)
