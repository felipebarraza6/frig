const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Resuelve el id de cuota desde /checkout/pay-installment/<id> o ?id=. */
export function resolveInstallmentId(pathname: string, search: string): string | null {
  const fromQuery = new URLSearchParams(search).get("id");
  if (fromQuery && UUID_RE.test(fromQuery)) return fromQuery;
  const last = pathname.replace(/\/+$/, "").split("/").pop() ?? "";
  return UUID_RE.test(last) ? last : null;
}

