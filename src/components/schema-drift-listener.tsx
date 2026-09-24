"use client";

import { useSchemaDrift } from "@/lib/hooks/useSchemaDrift";

/**
 * Monta la detección de drift de contrato backend↔frontend.
 * No renderiza nada: solo traduce el evento "api:schema-drift" a un toast.
 */
export function SchemaDriftListener() {
  useSchemaDrift();
  return null;
}
