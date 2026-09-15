"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

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
      className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 bg-[#0a0a0a] px-4 text-zinc-100"
    >
      <span className="flex h-12 w-12 items-center justify-center bg-primary text-primary-foreground">
        <img src="/brand/frig-symbol.png" alt="Frig" className="h-7 w-7" />
      </span>
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-8 py-10 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
        <div>
          <p className="text-sm font-semibold tracking-wide">Procesando tu pago…</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Te llevamos de vuelta para confirmar tu contratación.
          </p>
        </div>
      </div>
    </div>
  );
}
