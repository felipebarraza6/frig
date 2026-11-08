import { apiFetch } from "./client";

export type Paginated<T> = {
  results?: T[] | null;
  next?: string | null;
};

type FetchPage = <T>(path: string) => Promise<T>;

/** Deja `next` de DRF en una ruta que `apiFetch` puede llamar. */
export function nextApiPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (/^https?:\/\//i.test(next)) return next;
  if (next.startsWith("/api/")) return next.slice(4);
  return next;
}

function withPageSize(path: string, pageSize: number): string {
  if (/^https?:\/\//i.test(path)) {
    const url = new URL(path);
    if (!url.searchParams.has("page_size")) {
      url.searchParams.set("page_size", String(pageSize));
    }
    return url.toString();
  }
  const [base, query = ""] = path.split("?");
  const qs = new URLSearchParams(query);
  if (!qs.has("page_size")) qs.set("page_size", String(pageSize));
  const q = qs.toString();
  return q ? `${base}?${q}` : base;
}

/**
 * Recorre `next` hasta vaciar el listado. Tope de 50 páginas para no
 * enganchar un `next` que se repite.
 */
export async function fetchAllPages<T>(
  path: string,
  opts: { pageSize?: number; fetch?: FetchPage } = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 200;
  const fetchPage = opts.fetch ?? apiFetch;
  const out: T[] = [];
  let url: string | null = withPageSize(path, pageSize);
  const seen = new Set<string>();
  for (let i = 0; i < 50 && url; i++) {
    if (seen.has(url)) break;
    seen.add(url);
    const data = await fetchPage<Paginated<T>>(url);
    out.push(...(data.results ?? []));
    url = nextApiPath(data.next);
  }
  return out;
}
