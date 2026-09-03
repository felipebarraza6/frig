# Requerimientos backend — flujo de contratación FRIG (checkout → correo con código)

## Objetivo

Desde la landing pública (`/`), un visitante elige un plan, ingresa los datos de su negocio, paga y recibe un correo con un código para entrar. El frontend ya está integrado y hace POST al endpoint descrito abajo; mientras el endpoint no exista, el modal cae a un `mailto:` con todos los datos (ver `apps/web/src/components/landing/checkout-modal.tsx`).

## Endpoint necesario

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
  "payment_url": "https://…"   // link de pago (Transbank/Webpay o simulado en etapa inicial)
}
```

El frontend redirige al `payment_url` (paso "Ir a pagar").

## Flujo completo que el backend debe cubrir

1. **Checkout** — registrar la intención de compra con el plan elegido (planes por nivel de demanda, definidos en `apps/web/src/content/landing.ts` — espejar esa tabla o servirla por API).
2. **Pago** — integración Webpay Plus (o proveedor definido) con monto = precio del plan + 1 UF de integración (valores UF del día).
3. **Webhook/retorno de pago confirmado** → activar la contratación:
   - Crear organización + sucursal con el plan FRIG ("Gestión gastronómica/comercial").
   - Crear usuario OWNER con un **código de acceso** (clave inicial de un solo uso o magic-link firmado).
   - Generar branding base (logo placeholder + color primario).
4. **Correo de acceso** — email con: código de acceso, URL de login personalizada (`https://frig.yggdra.cl/login/<slug>`), e instrucciones para cambiar la clave.
5. **Estado del checkout** — `GET /api/public/frig-checkout/{checkout_id}/` para que el frontend pueda hacer polling del estado si se decide flujo inline (opcional fase 2).

## Notas

- La UF se convierte a CLP al momento del pago (valor UF del día, e.g. CMF/indicadores económicos).
- Rate-limit obligatorio: endpoint público (ej. 5/min por IP).
- Validar email único por checkout pendiente (evitar duplicados de doble-submit).
- Logs de auditoría: cada checkout con IP, user-agent y resultado del pago.

## Frontend ya integrado

- Parrilla de 5 planes por nivel de demanda en `/` (landing) — `apps/web/src/content/landing.ts`.
- Modal de contratación con formulario y pantalla de confirmación — `apps/web/src/components/landing/checkout-modal.tsx`.
- Correo prometido: "te llegará un correo con tu código para entrar" — es el contrato visible al usuario, cumplirlo al confirmar el pago.
