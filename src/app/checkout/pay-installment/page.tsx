"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";
import { resolveInstallmentId } from "@/lib/installment-link";

interface InstallmentInfo {
  id?: string;
  number: number;
  total_installments: number;
  amount_clp?: number | string;
  due_date?: string;
  status: string;
  payment_url?: string | null;
  business_name?: string;
  message?: string;
}

/**
 * Link del correo recordatorio de cuotas (plan_checkout/tasks.py):
 * consulta la cuota y redirige a Flow; si ya está pagada lo informa.
 */
export default function PayInstallmentPage() {
  const [state, setState] = useState<
    { kind: "loading" } | { kind: "error"; msg: string } | { kind: "info"; data: InstallmentInfo }
  >({ kind: "loading" });

  useEffect(() => {
    const id = resolveInstallmentId(window.location.pathname, window.location.search);
    const request = id
      ? apiFetch<InstallmentInfo>(`/public/checkout/pay-installment/${id}/`, {
          auth: "none",
          branch: "none",
        })
      : Promise.reject(new Error("invalid-link"));
    request
      .then((data) => {
        if (data.status !== "PAID" && data.payment_url) {
          window.location.href = data.payment_url;
          return;
        }
        setState({ kind: "info", data });
      })
      .catch(() =>
        setState({
          kind: "error",
          msg: id
            ? "No encontramos esta cuota. Revisa el enlace o escríbenos."
            : "El enlace de pago no es válido.",
        }),
      );
  }, []);

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", padding: 24, fontFamily: "system-ui", textAlign: "center" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Pago de cuota</h1>
      {state.kind === "loading" && <p>Preparando el pago…</p>}
      {state.kind === "error" && <p>{state.msg}</p>}
      {state.kind === "info" && (
        <p>
          {state.data.status === "PAID"
            ? state.data.message ?? "Esta cuota ya está pagada."
            : "No pudimos generar el pago en este momento. Intenta más tarde o escríbenos."}
          {" "}(Cuota {state.data.number}/{state.data.total_installments})
        </p>
      )}
    </main>
  );
}
