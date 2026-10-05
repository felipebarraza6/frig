"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Ruta legacy: el salón 3D vive en `/salon-demo`. */
export default function SalonTestRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/salon-demo");
  }, [router]);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#07080c] text-sm text-zinc-400">
      Abriendo demo del salón…
    </div>
  );
}
