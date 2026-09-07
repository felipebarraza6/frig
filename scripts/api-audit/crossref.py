#!/usr/bin/env python3
"""Cruza llamadas frontend vs paths backend.

Normaliza templates del frontend (/sales/orders/${id}/ -> /sales/orders/{param}/)
y los empareja contra los paths del schema. Detecta llamadas sin match.

Uso: python3 crossref.py [backend.json] [frontend.json] [salida.json]
"""
import json
import re
import sys
from collections import defaultdict

backend_path_arg = sys.argv[1] if len(sys.argv) > 1 else "/tmp/opencode/backend-paths.json"
frontend_path_arg = sys.argv[2] if len(sys.argv) > 2 else "/tmp/opencode/frontend-calls.json"
out_path = sys.argv[3] if len(sys.argv) > 3 else "/tmp/opencode/crossref.json"

backend = json.load(open(backend_path_arg))
calls = json.load(open(frontend_path_arg))

def strip_interpolation(t):
    out = []
    i = 0
    while i < len(t):
        if t[i] == "$" and i + 1 < len(t) and t[i + 1] == "{":
            depth = 1
            i += 2
            start = i
            while i < len(t) and depth:
                if t[i] == "{":
                    depth += 1
                elif t[i] == "}":
                    depth -= 1
                i += 1
            inner = t[start : i - 1]
            if inner.strip() == "API_BASE":
                continue
            is_query = (
                re.search(r"[`'\"]\?", inner)
                or re.fullmatch(r"\s*(q|qs|query|queries|params|searchParams|filterQuery|search|firstQs)\s*", inner)
            )
            if not is_query:
                out.append("{param}")
        else:
            out.append(t[i])
            i += 1
    return "".join(out)

def normalize(t):
    t = strip_interpolation(t)
    t = re.sub(r"\{param\}\?.*$", "{param}", t)
    t = re.sub(r"\?.*$", "", t)
    if not t.startswith("/"):
        t = "/" + t
    if not t.startswith("/api/"):
        t = "/api" + t
    return t

backend_paths = set(backend.keys())
by_segments = defaultdict(list)
for p in backend_paths:
    n = len([s for s in p.strip("/").split("/") if s])
    by_segments[n].append(p)

def signature(path):
    return tuple("{p}" if re.fullmatch(r"\{[^}]+\}", s) else s for s in path.strip("/").split("/"))

sig_index = defaultdict(list)
for p in backend_paths:
    sig_index[signature(p)].append(p)

def match(path_t):
    for candidate in (path_t, re.sub(r"/\{param\}$", "", path_t)):
        sig = signature(candidate)
        for cand in sig_index.get(sig, []):
            return cand
        if candidate in backend_paths:
            return candidate
        rx = re.escape(candidate).replace(re.escape("{param}"), r"[^/]+")
        rx = rx.rstrip("/") + "/?"
        segs = len([s for s in candidate.strip("/").split("/") if s])
        for dn in (0, 1):
            for cand in by_segments.get(segs + dn, []):
                if re.fullmatch(rx, cand):
                    return cand
    return None

used = {}
unmatched = []
used_ops = {}
for c in calls:
    t = normalize(c["template"])
    bp = match(t)
    ref = f"{c['file']}:{c['line']}"
    if bp is None:
        unmatched.append({**c, "normalized": t})
    else:
        used.setdefault(bp, []).append(f"{c['method']} {ref}")
        key = f"{c['method']} {bp}"
        used_ops[key] = used_ops.get(key, 0) + 1

unused = {}
for p, methods in backend.items():
    for m in methods:
        key = f"{m} {p}"
        if key not in used_ops:
            unused.setdefault(p, []).append(m)

json.dump({
    "used_paths": used,
    "used_ops": used_ops,
    "unmatched_frontend_calls": unmatched,
    "unused_backend": unused,
    "stats": {
        "backend_paths": len(backend),
        "backend_ops": sum(len(v) for v in backend.values()),
        "frontend_calls": len(calls),
        "backend_paths_used": len(used),
        "backend_ops_used": len(used_ops),
        "backend_ops_unused": sum(len(v) for v in unused.values()),
        "unmatched_frontend": len(unmatched),
    },
}, open(out_path, "w"), indent=1, ensure_ascii=False)

s = json.load(open(out_path))
print(json.dumps(s["stats"], indent=2))
print("\n-- UNMATCHED FRONTEND CALLS --")
for u in unmatched:
    print(f"  {u['method']:6} {u['normalized'][:90]}  <- {u['file']}:{u['line']}")
