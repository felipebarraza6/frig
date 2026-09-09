"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CreditCard, Mail, Store } from "lucide-react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DEMO_CONTACTS, LANDING_INTEGRATION_UF, type LandingPlan } from "@/content/landing";
import { fetchCheckout, fetchCheckoutStatus } from "@/lib/api/checkout";
import { ApiError } from "@/lib/api/client";
import { useApp } from "@/lib/app-context";

type CheckoutState = "form" | "processing" | "polling" | "done";

interface CheckoutModalProps {
  plan: LandingPlan | null;
  /** UF única de integración (del catálogo vivo del grupo; fallback local). */
  integrationUf?: number;
  /** Correo de contacto para el fallback mailto (del grupo; fallback local). */
  contactEmail?: string;
  onClose: () => void;
}

/** Máximo de intentos de polling (3 s c/u ≈ 4 min) antes de dar por perdido el pago. */
const POLL_MAX_ATTEMPTS = 80;

/**
 * Flujo de contratación: plan elegido → datos del negocio → pago → el sistema
 * envía un correo con el código de acceso.
 *
 * Tras crear la sesión (POST /public/frig-checkout/) el modal se mantiene
 * abierto en estado "polling": la pasarela se abre en otra pestaña y aquí se
 * confirma el pago consultando el estado cada 3 s. Si el POST falla con error
 * de servidor, se cae a un mailto con todos los datos (la promesa del flujo
 * es el correo con el código).
 */
export function CheckoutModal({ plan, integrationUf = LANDING_INTEGRATION_UF, contactEmail = DEMO_CONTACTS.to, onClose }: CheckoutModalProps) {
  const { checkoutGroup } = useApp();
  const storageKey = `frig.checkout_id.${checkoutGroup}`;
  const [state, setState] = useState<CheckoutState>(() => {
    if (typeof window === "undefined") return "form";
    const params = new URLSearchParams(window.location.search);
    const pending =
      params.get("checkout_id") ??
      window.sessionStorage.getItem(storageKey);
    return pending ? "polling" : "form";
  });
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [website, setWebsite] = useState("");
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevPlanIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!plan || plan.id === prevPlanIdRef.current) return;
    prevPlanIdRef.current = plan.id;
    // React 18/19 auto-batches — single commit
    setState("form");
    setError(null);
  }, [plan]);

  useEffect(() => {
    if (state !== "polling" || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id =
      params.get("checkout_id") ??
      window.sessionStorage.getItem(storageKey);
    if (!id) return;
    let cancelled = false;
    let attempts = 0;
    const timer = window.setInterval(async () => {
      attempts += 1;
      try {
        const s = await fetchCheckoutStatus(id, checkoutGroup);
        if (cancelled) return;
        if (s.payment_url) setPaymentUrl(s.payment_url);
        if (s.status === "PAID") {
          window.clearInterval(timer);
          window.sessionStorage.removeItem(storageKey);
          setState("done");
        } else if (s.status === "EXPIRED" || s.status === "FAILED") {
          window.clearInterval(timer);
          setError("Tu pago no se completó, intenta de nuevo");
          setState("form");
        } else if (attempts >= POLL_MAX_ATTEMPTS) {
          window.clearInterval(timer);
          setError("Todavía no vemos tu pago, revisa tu correo en unos minutos");
          setState("form");
        }
      } catch {
        if (cancelled) return;
        if (attempts >= POLL_MAX_ATTEMPTS) {
          window.clearInterval(timer);
          setState("form");
        }
      }
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [state, checkoutGroup, storageKey]);

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
      website: website || undefined,
    };

    try {
      const res = await fetchCheckout(payload, checkoutGroup);
      window.sessionStorage.setItem(storageKey, res.checkout_id);

      if (!res.payment_url && res.status === "PAID") {
        setState("done");
        return;
      }

      setPaymentUrl(res.payment_url);
      setState("polling");
      window.open(res.payment_url, "_blank", "noopener,noreferrer");
      return;
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status >= 400 &&
        e.status < 500 &&
        e.status !== 429
      ) {
        setError(e.message || "Revisa los datos e intenta de nuevo");
        setState("form");
        return;
      }
      const body = [
        `Plan: ${plan!.name} (${monthly})`,
        `Negocio: ${payload.business_name}`,
        `Contacto: ${payload.contact_name}`,
        `Correo: ${payload.email}`,
      ].join("\n");
      window.location.href =
        `mailto:${contactEmail}?subject=${encodeURIComponent(`Contratación FRIG — ${plan!.name}`)}` +
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
          : `${monthly} + ${integrationUf} UF única de integración`
      }
    >
      {state === "polling" ? (
        <ModalBody className="flex flex-col items-center gap-4 py-8 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
          <div>
            <p className="text-base font-semibold">Confirmando tu pago…</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Completa el pago en la pasarela. La abrimos en otra pestaña; en
              cuanto se confirme, te mostramos tu código de acceso.
            </p>
          </div>
          {paymentUrl && (
            <Button
              variant="outline"
              onClick={() =>
                window.open(paymentUrl, "_blank", "noopener,noreferrer")
              }
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Abrir pasarela de pago
            </Button>
          )}
        </ModalBody>
      ) : state === "done" ? (
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

            <div className="hidden" aria-hidden="true">
              <label htmlFor="checkout-website">Sitio web</label>
              <Input
                id="checkout-website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                autoComplete="off"
                tabIndex={-1}
              />
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
