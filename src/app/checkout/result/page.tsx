"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PixelFoodMark } from "@/components/landing/pixel-food-mark";

const PREFIX = "frig.checkout_id.";

/**
 * Flow redirige aquí tras completar (o cancelar) el pago con `?token=…&flowOrder=…`.
 * La página no llama a ninguna API: el checkout-modal ya guardó el checkout_id
 * en sessionStorage (`frig.checkout_id.{group}`) y sigue haciendo polling.
 * Solo devolvemos al usuario a la landing con el checkout_id en la URL para
 * que el modal retome la confirmación y muestre "Revisa tu correo".
 */
export default function CheckoutResultPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Token de Flow; no lo necesitamos — la confirmación la hace el polling.
    void params.get("token");

    let checkoutId: string | null = null;
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (key?.startsWith(PREFIX)) {
        checkoutId = window.sessionStorage.getItem(key);
        if (checkoutId) break;
      }
    }

    router.replace(checkoutId ? `/?checkout_id=${encodeURIComponent(checkoutId)}` : "/");
  }, [router]);

  return (
    <div
      className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 px-4 font-sans"
      style={{ background: "#0b110c", color: "#f5efdd" }}
    >
      <span className="flex h-12 w-12 items-center justify-center bg-primary text-primary-foreground">
        <PixelFoodMark className="h-7 w-7" />
      </span>
      <div className="pixel-frame flex flex-col items-center gap-4 px-8 py-10 text-center" style={{ background: "#10160f" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <div>
          <p className="font-pixel text-sm font-semibold tracking-wider">PROCESANDO TU PAGO…</p>
          <p className="mt-2 text-sm leading-relaxed text-emerald-100/70">
            Te llevamos de vuelta para confirmar tu contratación.
          </p>
        </div>
      </div>
    </div>
  );
}
