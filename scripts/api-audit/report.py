#!/usr/bin/env python3
"""Reporte de cobertura por dominio (tag) y drift de métodos.

Uso: python3 report.py [backend.json] [frontend.json] [crossref.json] [salida.json]
"""
import json
import re
import sys
from collections import defaultdict

backend = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "/tmp/opencode/backend-paths.json"))
calls = json.load(open(sys.argv[2] if len(sys.argv) > 2 else "/tmp/opencode/frontend-calls.json"))
json.load(open(sys.argv[3] if len(sys.argv) > 3 else "/tmp/opencode/crossref.json"))
out_path = sys.argv[4] if len(sys.argv) > 4 else "/tmp/opencode/report.json"

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

used_ops = set()
for c in calls:
    bp = match(normalize(c["template"]))
    if bp:
        m = "GET" if c["method"] == "FILE" else c["method"]
        used_ops.add(f"{m} {bp}")

drift = []
for c in calls:
    t = normalize(c["template"])
    bp = match(t)
    if bp and c["method"] != "FILE" and c["method"] not in backend[bp]:
        drift.append({
            "call": f"{c['method']} {t}",
            "where": f"{c['file']}:{c['line']}",
            "backend_methods": list(backend[bp].keys()),
            "matched": bp,
        })

INFRA = {"docs", "schema", "redoc", "health", "public", "audit"}
tag_stats = defaultdict(lambda: {"total": 0, "used": 0, "unused_paths": []})
for p, methods in backend.items():
    tags = methods[list(methods.keys())[0]]["tags"] or ["(sin tag)"]
    tag = tags[0]
    if tag in INFRA:
        continue
    for m in methods:
        tag_stats[tag]["total"] += 1
        if f"{m} {p}" in used_ops:
            tag_stats[tag]["used"] += 1
    if not any(f"{m} {p}" in used_ops for m in methods):
        tag_stats[tag]["unused_paths"].append(p)

print("== COBERTURA POR DOMINIO (ops usadas/total) ==")
for tag, s in sorted(tag_stats.items(), key=lambda x: x[1]["used"] / max(x[1]["total"], 1)):
    pct = 100 * s["used"] / max(s["total"], 1)
    bar = "█" * int(pct // 10) + "░" * (10 - int(pct // 10))
    print(f"  {bar} {pct:5.1f}%  {s['used']:3}/{s['total']:<4} {tag}")

print(f"\n== DRIFT DE MÉTODO ({len(drift)}) ==")
for d in drift:
    print(f"  {d['call'][:70]}  <- {d['where']}  backend: {','.join(d['backend_methods'])}")

json.dump({
    "tag_stats": {t: {"total": s["total"], "used": s["used"], "unused_paths": s["unused_paths"]} for t, s in tag_stats.items()},
    "drift": drift,
}, open(out_path, "w"), indent=1, ensure_ascii=False)
print(f"\nsaved {out_path}")
