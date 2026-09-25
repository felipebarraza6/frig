"use client";

import { useSearchParams } from "next/navigation";
import PublicMenuPage from "../[slug]/menu-client";

/** Lee `?slug=` y lo pasa explícito al menú público. */
export default function MenuViewClient() {
  const search = useSearchParams();
  const slug = search.get("slug")?.trim() || "";
  return <PublicMenuPage slug={slug || undefined} />;
}
