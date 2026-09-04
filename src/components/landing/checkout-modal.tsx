"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, CreditCard, Mail, Store } from "lucide-react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DEMO_CONTACTS, LANDING_INTEGRATION_UF, type LandingPlan } from "@/content/landing";
import { API_BASE } from "@/lib/api/client";

type CheckoutState = "form" | "processing" | "done";

interface CheckoutModalProps {
  plan: LandingPlan | null;
  onClose: () => void;
}

/**
 * Flujo de contratación: plan elegido → datos del negocio → pago → el sistema
 * envía un correo con el código de acceso.
 *
 * El POST a /public/frig-checkout/ está documentado en
 * docs/checkout-requerimientos-backend.md; mientras el endpoint no exista,
 * el modal cae a un mailto con todos los datos y muestra la misma pantalla
 * de confirmación (la promesa del flujo es el correo con el código).
 */
export function CheckoutModal({ plan, onClose }: CheckoutModalProps) {
  const [state, setState] = useState<CheckoutState>("form");
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (plan) {
      setState("form");
      setError(null);
    }
  }, [plan]);

  if (!plan) return null;

  const monthly = plan.priceUf !== null ? `${plan.priceUf} UF/mes` : "A convenir";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (state !== "form") return;
    setState("processing");
    setError(null);

    const payload = {
      plan_id: plan!.id,
      business_name: business.trim(),
      contact_name: contactName.trim(),
      email: email.trim().toLowerCase(),
    };

    try {
      const res = await fetch(`${API_BASE}/public/frig-checkout/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      // El endpoint de checkout aún no existe en el backend (ver docs). Mientras
      // tanto, caer al correo con todos los datos del pedido.
      const body = [
        `Plan: ${plan!.name} (${monthly})`,
        `Negocio: ${payload.business_name}`,
        `Contacto: ${payload.contact_name}`,
        `Correo: ${payload.email}`,
      ].join("\n");
      window.location.href =
        `mailto:${DEMO_CONTACTS.to}?subject=${encodeURIComponent(`Contratación FRIG — ${plan!.name}`)}` +
        `&body=${encodeURIComponent(body)}`;
    }
    setState("done");
  }

  return (
    <Modal
      open={plan !== null}
      onClose={onClose}
      title={state === "done" ? "¡Listo!" : `Contratar ${plan.name}`}
      description={
        state === "done"
          ? undefined
          : `${monthly} + ${LANDING_INTEGRATION_UF} UF única de integración`
      }
    >
      {state === "done" ? (
        <ModalBody className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
            <Mail className="h-7 w-7" />
          </div>
          <div>
            <p className="text-base font-semibold">Revisa tu correo</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Una vez confirmado tu pago, te enviaremos a{" "}
              <span className="font-medium text-foreground">{email}</span> un correo con
              tu código de acceso para entrar a FRIG.
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Entendido
          </Button>
        </ModalBody>
      ) : (
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit}
        >
          <ModalBody className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Store className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{plan.name}</p>
                <p className="text-xs text-muted-foreground">
                  {plan.resources.join(" · ")}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="checkout-business" className="text-sm font-medium">
                Nombre del negocio
              </label>
              <Input
                id="checkout-business"
                value={business}
                onChange={(e) => setBusiness(e.target.value)}
                placeholder="Ej: Sanguchería El Che"
                autoComplete="off"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="checkout-contact" className="text-sm font-medium">
                Tu nombre
              </label>
              <Input
                id="checkout-contact"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nombre y apellido"
                autoComplete="name"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="checkout-email" className="text-sm font-medium">
                Correo de acceso
              </label>
              <Input
                id="checkout-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@negocio.cl"
                autoComplete="email"
                required
              />
              <p className="text-xs text-muted-foreground">
                A este correo llegará tu código de acceso tras el pago.
              </p>
            </div>

            {error && (
              <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
            )}
          </ModalBody>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Volver
            </Button>
            <Button
              type="submit"
              disabled={state === "processing"}
              isLoading={state === "processing"}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Ir a pagar
            </Button>
          </ModalFooter>
        </form>
      )}
    </Modal>
  );
}
