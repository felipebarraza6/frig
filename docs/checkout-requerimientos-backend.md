# Flujo de contratación FRIG — estado de implementación

## Estado actual (2026-09-07): backend implementado ✅

El flujo completo ya existe en Yggdra y está verificado end-to-end en dev:

| Pieza | Endpoint | Estado |
|---|---|---|
| Crear checkout | `POST /api/public/frig-checkout/` | ✅ (idempotente, honeypot, throttle 5/min) |
| Estado para polling | `GET /api/public/frig-checkout/{checkout_id}/` | ✅ |
| Pasarela simulada | `GET/POST /api/public/checkout/simulated-gateway/{session_id}/` | ✅ (activa en dev vía `PUBLIC_CHECKOUT_SIMULATED_PAYMENTS_ENABLED`) |
| **Catálogo de planes** | `GET /api/public/frig-plans/` | ✅ (planes mutables desde el admin Django) |
| **Canje magic-link** | `POST /api/public/checkout/magic-login/` | ✅ (token firmado del correo → sesión) |
| Provisioning post-pago | — | ✅ (Organization + Branch + OWNER + `OrganizationPlanSubscription` + magic-link por correo) |

Precios reales en la base de datos (`plan_checkout_groupplan`): kiosco 10 UF,
local 20, restaurante 35, grande 50, cadena a convenir — editables desde el
admin Django (PlanGroup → GroupPlan inline).

## Estado en el frontend (repo frig) — 2026-09-07: implementado ✅

1. **Pricing de la landing con planes vivos** ✅ — `GET /public/{group}-plans/`
   consumido en `src/components/landing/landing-site.tsx` (React Query).
   Del sistema vienen `plan_id`, `display_name`, `price_uf`, `integration_uf`,
   `description` y `features` (cruzados en `resolvePlans`); el copy local
   (`src/content/landing.ts`) queda como fallback y fuente del sello
   "el más elegido". Los CTAs "EMPEZAR POR X UF" interpolan el primer plan
   vivo. Si el grupo no existe o el backend no responde, cae a
   `LANDING_PLANS`.
2. **Modal de checkout con polling en background** ✅ — tras crear la sesión
   el modal queda abierto en estado "polling" (spinner + botón "Abrir
   pasarela de pago"), la pasarela se abre en otra pestaña y el estado se
   consulta cada 3 s (máx. ~4 min). Al `PAID` muestra la confirmación; el
   resume por `?checkout_id=`/sessionStorage sigue funcionando.
3. **Canje del magic-link en `/login`** ✅ — `/login/[slug]` preserva
   `?token=` al redirigir a `/login?branch=<slug>&token=<token>` y la página
   canjea vía `POST /public/checkout/magic-login/` (`fetchMagicLogin` en
   `src/lib/api/checkout.ts`), reutilizando el mismo flujo post-login que
   `login_complete` (`completeLogin` en `src/app/(auth)/login/page.tsx`).
   Si el enlace expiró o es inválido, se muestra el error y queda el login
   normal con clave.

## Contrato original (referencia)

### `POST /api/public/frig-checkout/` (público, sin autenticación, con rate-limit y captcha/anti-spam)

Body:

```json
{
  "plan_id": "kiosco | local | restaurante | grande | cadena",
  "business_name": "Sanguchería El Che",
  "contact_name": "Juan Pérez",
  "email": "juan@negocio.cl"
}
```

Respuesta `201`:

```json
{
  "checkout_id": "uuid",
  "payment_url": "https://…"
}
```

## Flujo completo (cubierto por el backend)

1. **Checkout** — registrar la intención de compra con el plan elegido ✅
2. **Pago** — fase 1: pasarela simulada; monto = precio del plan + UF de integración (UF del día vía mindicador.cl) ✅
3. **Post-pago** — provisioning atómico: Organization + Branch + usuario OWNER + `OrganizationPlanSubscription` + branding base ✅
4. **Correo de acceso** — magic-link firmado a `/login/<slug>?token=…` ✅
5. **Estado del checkout** — polling del front ✅

## Notas

- La UF se convierte a CLP al momento del pago (valor UF del día, vía mindicador.cl cacheado 6h).
- Rate-limit: 5/min por IP en checkout, estado y magic-login; el catálogo de planes usa throttle anónimo estándar.
- Validar email único por checkout pendiente (idempotencia 24h) — implementado.
- Logs de auditoría (`plan_checkout.audit`): cada checkout con IP, user-agent y resultado del pago.

## Frontend (estado)

- Parrilla de 5 planes en `/` — catálogo vivo vía `GET /public/{group}-plans/` (grupo según `checkoutGroup`), fallback a `src/content/landing.ts`.
- Modal de contratación — POST real al backend; polling en background con la pasarela en otra pestaña.
- Correo prometido: "te llegará un correo con tu código para entrar" — cumplido por el backend (magic-link), canjeable en `/login?token=…` sin clave.
