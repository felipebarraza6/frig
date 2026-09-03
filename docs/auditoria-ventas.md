# Auditoría — Módulo Ventas (`/sales`): registro vs. pago

**Fecha:** 2026-09-03
**Alcance:** frontend `apps/web` — `src/app/(app)/sales/page.tsx`, `src/lib/api/orders.ts`, `src/lib/api/payments.ts`, `src/components/pos/cart-panel.tsx`, `src/app/(app)/payments/page.tsx`.

## Regla auditada

- `/sales` debe ser un **registro de ventas**: no pagar ni cambiar estados de pago; a lo más **anular**.
- Crear una nueva venta crea una **orden** (nace sin pagar, PENDING), **no una nueva cuenta**.
- **Pagar ocurre exclusivamente en el módulo Pagos (`/payments`).**

## Hallazgos

### 1. ❌ "Cobrar" desde Ventas paga la orden

- Botón "Cobrar": `apps/web/src/app/(app)/sales/page.tsx:385-389` (fila), `:635-643` (tarjeta), `:2332-2342` (detalle).
- Modal de cobro → `handleCollectSubmit` (`:1720-1739`) → mutación `collect` (`:1269-1298`):
  crea uno o más `createPayment({ order_id, amount, status: "COMPLETED", ..., skip_cash_register_validation: true })`.
- El backend recalcula `payment_status` a PAID. Se usa `skip_cash_register_validation: true`, flag pensado para "registro manual desde Ventas" (`payments.ts:11-12`).
- **Violación:** pagar fuera del módulo Pagos.

### 2. ❌ Cobro de cuotas desde Ventas

- `payInstallment` (`sales/page.tsx:1683-1701` → `orders.ts:269-284`): el backend crea un `Payment` asociado a la cuota (`orders.ts:97-98`).
- **Violación:** idem, pago fuera de Pagos.

### 3. ❌ El POS paga al registrar la venta

- `apps/web/src/components/pos/cart-panel.tsx:569-628`: tras `createOrder`, si el carrito tiene líneas de pago, dispara `createPayment` por cada una. Botón "Cobrar $X" vs "Guardar venta" (`:1446-1458`).
- Comentario explícito en `:557`: *"Una venta sin pagos se guarda como SALE pending (nueva cuenta), no ORDER"*.
- **Violación:** crear venta puede pagarla de inmediato.

### 4. ⚠️ "Nueva cuenta" no es un tipo distinto

- `handleCreateAccount` (`sales/page.tsx:1436-1480`): `createOrder({ items: [], order_type: "SALE", client_id, table_id })`.
- Tanto la venta directa como la cuenta son `order_type: "SALE"`; se distinguen solo por `payment_status`. La "cuenta" es una SALE vacía pendiente.
- **Violación parcial:** si la regla es "crear venta = nueva orden pendiente", hoy existe además el concepto de cuenta vacía (aunque no paga ni cambia estados).

### 5. ✅ Otros flujos de Ventas cumplen

- `createOrder` (`orders.ts:186-201`) nunca envía `status`/`payment_status`/pagos: la orden nace PENDING (default del backend).
- `editOrder` (`orders.ts:233-248`): solo `client_id`, `table_id`, `observation`, `delivery_address`, `delivery_date`, `items`. No permite cambiar estado ni pagar.
- `deliverOrder` (`orders.ts:223-231`): solo cambia `delivery_status` (estado logístico, no de pago).
- **Anular** (`cancelOrder`, `sales/page.tsx:2421`, `orders.ts:182-184`): es la única acción destructiva permitida y está presente. ✔

### 6. ✅ Módulo Pagos centraliza el cobro

- `apps/web/src/app/(app)/payments/page.tsx:294-316`: `createPayment` con picker de origen (orden pendiente, ingreso, egreso).
- `:1456`: `payInstallment` también disponible en Pagos.
- Comentario `:959`: el backend rechaza pago directo de orden con cuotas — debe pagarse por cuota.

### 7. Cobro fuera de Pagos en otros puntos del frontend

| Lugar | Líneas | Acción |
|---|---|---|
| `sales/page.tsx` | 1269-1298 | Cobrar venta/orden (modal "Cobrar") |
| `components/pos/cart-panel.tsx` | 506-515, 620-628 | Crear/editar orden y pagarla ("Cobrar $X") |
| `components/orders/order-collect-modal.tsx` | 126-133 | Cobrar cuenta existente (usado en `pos/terminal/page.tsx`) |
| `components/pos/pay-pending-item-modal.tsx` | — | Cobrar cuentas/órdenes pendientes desde POS |
| `app/(app)/payments/page.tsx` | 304 | ✅ Módulo de Pagos |

## Cambios aplicados (2026-09-03)

En `apps/web/src/app/(app)/sales/page.tsx` (3649 → 2843 líneas):

1. Eliminado el cobro: botón "Cobrar" (3 vistas), modal de cobro y mutación `createPayment` con `skip_cash_register_validation`.
2. Eliminado el pago de cuotas (`payInstallment`); se conserva crear/visualizar el plan de cuotas (`createInstallments`/`fetchInstallments`), renombrado a "Gestionar cuotas".
3. Eliminada la edición de órdenes (`editOrder` + modal completo) — decisión de negocio: rompe la persistencia, no es necesaria.
4. Acciones permitidas en Ventas ahora: Ver, ticket, marcar entregada, gestionar cuotas, boletas PDF, Anular, y crear nueva venta/orden/cuenta (nace pendiente).

Pendiente: el POS (`components/pos/cart-panel.tsx`) sigue pudiendo cobrar al registrar una venta ("Cobrar $X") — decisión de negocio abierta.

## Conclusión

`/sales` **no** es hoy un registro puro: permite cobrar (incl. cuotas), y el POS paga al registrar. Cumple en que crear/editar/entregar no toca el estado de pago y la anulación existe. Para hacer cumplir la regla habría que:

1. Eliminar el botón/modal "Cobrar" y el cobro de cuotas de `sales/page.tsx` (redirigir a `/payments`).
2. Decidir el rol del POS: si conserva cobro (es caja) o pasa a crear órdenes PENDING y cobra exclusivamente desde Pagos.
3. Revisar si se mantiene o elimina el concepto de "cuenta" (SALE vacía) según la regla "nueva venta = orden, no cuenta".
