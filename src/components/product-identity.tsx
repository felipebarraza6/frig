"use client";

import { useEffect } from "react";
import { useProductBrand } from "@/lib/product-name";
import { setFaviconHref } from "@/lib/frig-identity";

/** Título y favicon de la marca activa (FRIG en local; org/sucursal en host). */
export function ProductIdentity() {
  const { name, logo } = useProductBrand();

  useEffect(() => {
    document.title = name;
    setFaviconHref(logo);
  }, [name, logo]);

  return null;
}
