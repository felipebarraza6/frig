# Auditoría — Módulo Compras (`/purchase-orders`): gestionar todo menos los pagos

**Fecha:** 2026-09-03
**Alcance:** frontend `apps/web` — `src/app/(app)/purchase-orders/page.tsx`, `src/components/pos/pay-pending-item-modal.tsx`, `src/components/pos/pos-quick-actions.tsx`, `src/components/pos/pos-quick-actions-settings.tsx`, `src/lib/api/branches.ts`, `src/lib/api/suppliers.ts`, `src/app/(app)/payments/page.tsx`.

## Regla auditada

- El proceso de compras (órdenes de compra, recepción, proveedores, anulación) gestiona **todo menos los pagos**.
- **Pagar una OC ocurre exclusivamente en el módulo Pagos (`/payments`).** Centralizado y ordenado: un solo lugar registra salidas de dinero.

## Hallazgos (estado previo al cambio)

### 1. ❌ "Registrar pago" dentro del módulo Compras

- Mutación `pay` + modal de pago en `apps/web/src/app/(app)/purchase-orders/page.tsx:447-469` (mutación), `:923-924` y `:1336` (botones), `:1354-1416` (modal).
- Llamaba `payPurchaseOrder` → `POST /suppliers/purchase-orders/{id}/pay_order/` (`suppliers.ts:277-284`). El backend crea un gasto ligado (`expense_payment`) y recalcula `payment_status`.
- Comentario conocido en `:1290`: "se pagan desde el módulo Pagos **o con 'Registrar pago' aquí**" — la dualidad era explícita.
- **Violación:** pagar OC fuera del módulo Pagos.

### 2. ❌ Acción rápida del POS "Órdenes de compra" (`pay_purchase_order`)

- `pay-pending-item-modal.tsx:568-608` pagaba OC pendientes (`payPurchaseOrder`) desde la caja.
- Configurada en `DEFAULT_POS_QUICK_ACTIONS` (`branches.ts:278`) y en los mapas de labels del POS.
- **Violación:** idem, pago de OC fuera de Pagos.

### 3. ✅ Módulo Pagos ya centralizaba el pago de OC

- `payments/page.tsx:317-347`: el dispatcher `createMutation` maneja `purchase_order` → `payPurchaseOrder` con el picker de entidades pendientes (`PendingEntityKind`: order, installment, revenue, expense, purchase_order).
- Al éxito invalida `["payments"]`, `["purchase-orders"]`, `["revenues"]`, `["expenses"]`, `["orders"]`.

### 4. ✅ Lo demás del proceso de compras no tocaba pagos

- Crear/anular/completar OC, recepción de ítems (`updatePurchaseOrderReceivedQuantities`), comprobantes y exportación: ninguno registra pagos.
- El resumen/historial de pagos (`fetchPurchaseOrderPaymentSummary`, `PurchaseOrderPaymentEntry`) es **solo lectura**: se conserva.
- Gastos (`/expenses`) solo muestra `payment_status` derivado e historial de la OC ligada — no paga.
- Código muerto relacionado (sin usos en frontend): `payExpense` (`lib/api/expenses.ts:88-99`), `markRevenueAsReceived` (`lib/api/revenues.ts:74`).

## Cambios aplicados (2026-09-03)

1. **`purchase-orders/page.tsx`**: eliminados mutación `pay`, modal de pago, botones "Registrar pago"/"Pagar", estado `payTarget`, `PayTarget`, `canPay`, `openPayModal`/`closePayModal` y el useQuery de métodos de pago (solo servía al modal). El módulo queda: crear, recibir, completar, anular, ver historial de pagos (solo lectura) y exportar. Mensaje vacío del historial: "Sin pagos registrados — se pagan desde el módulo Pagos."
2. **POS**: eliminada la acción rápida `pay_purchase_order` de `POSQuickActionType` y `DEFAULT_POS_QUICK_ACTIONS` (`branches.ts`), de los labels/short-labels/conteos (`pos-quick-actions.tsx`), de la configuración (`pos-quick-actions-settings.tsx`) y toda la rama OC de `pay-pending-item-modal.tsx` (1803 → 1430 líneas; se eliminó además `payMutation` no-OC, que era código muerto — su único caller era la rama OC). Las acciones de ventas del POS (cuentas, órdenes, cobrar por cliente) no se tocaron.
3. **Sin migración necesaria**: las configs de acciones rápidas persistidas en backend con tipo `pay_purchase_order` quedan filtradas automáticamente por `knownTypes` en `pos-quick-actions.tsx`.
4. Verificación: `tsc --noEmit` y `eslint` pasan sin errores nuevos; `payPurchaseOrder` solo queda en `lib/api/suppliers.ts` (definición) y `payments/page.tsx` (uso).

## Brechas restantes (fuera del alcance frontend de hoy)

1. **Contrato backend disperso**: el pago unificado `PaymentCreateRequest` (`yggdra.d.ts:46205`) no acepta `purchase_order_id`, por lo que el dispatcher de Pagos sigue ramificando a endpoints propios de cada dominio (`/suppliers/.../pay_order/`, `/sales/orders/{id}/pay/`, cuotas, `/finance/payments/`). Centralizar de verdad requeriría que el backend acepte cualquier entidad en `/finance/payments/`.
2. **Pago de OC crea un FixedExpense ligado** en backend (`expense_payment`): correcto para trazabilidad, pero el egreso resultante no pasa por `/finance/payments/` como los demás.
3. El cobro de **ventas** desde el POS (`cart-panel.tsx`, `order-collect-modal.tsx`) sigue abierto — ver `docs/auditoria-ventas.md`.

## Conclusión

El proceso de compras ya gestiona todo excepto los pagos, y toda OC se paga exclusivamente desde `/payments`. Queda como deuda de backend unificar el contrato de pagos para que el módulo Pagos deje de ramificar a endpoints por dominio.
