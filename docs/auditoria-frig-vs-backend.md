# Auditoría FRIG vs backend Yggdra — contrato y operatividad

> Fecha: 2026-09-03 · Alcance: `apps/web` (349 llamadas API en 41 archivos) vs contrato OpenAPI (`yggdra.d.ts`, 1.080 paths) + traza de 11 flujos de negocio end-to-end.
> Estado: hallazgos **[CORREGIDO]** aplicados en esta misma fecha; el resto es backlog priorizado o requiere verificación contra el backend en vivo.

## 1. Veredicto

**La app está operativa en lo esencial.** Los flujos críticos (login, apertura/cierre de caja, venta POS, cuentas abiertas, delivery, KDS, mesas, pagos, exportaciones) están cableados de extremo a extremo contra endpoints reales, con manejo de error e invalidaciones. Se encontraron **2 brechas Altas en el flujo de venta** y un grupo de errores silenciosos, todos corregidos (§2–§3). Quedan 2 puntos que **solo se pueden verificar con el backend en vivo** (§5) y backlog de madurez ya documentado en `plan-madurez-api.md` (§6).

## 2. Brechas Altas corregidas (flujo de venta)

| ID | Hallazgo | Fix |
|----|----------|-----|
| F-A | **Venta pagada no invalidaba el catálogo**: la ruta de venta con pagos retornaba antes del refetch de `["products"]` → stock stale en el POS y riesgo de sobreventa | `cart-panel.tsx` — invalidación de `products` (y `dashboard`) también en la ruta pagada |
| F-B | **Fallo de pago post-creación duplicaba ventas**: si `createPayment` fallaba después de `createOrder` exitoso, el carrito quedaba intacto y reintentar "Registrar" creaba una segunda orden | `cart-panel.tsx` — compensación: invalidaciones, carrito vaciado (los ítems ya están en la orden creada) y toast que indica completar el pago desde Cuentas |

## 3. Errores silenciosos corregidos

| ID | Dónde | Antes | Fix |
|----|-------|-------|-----|
| S-A | Pagos: pago rápido (`payments/page.tsx:409`) | `catch {}` vacío: el pago fallaba y el usuario no se enteraba | toast con el error del backend |
| S-B | Ventas: marcar entrega y generar cuotas (`sales/page.tsx`) | mutations sin `onError`; el modal se quedaba abierto sin explicación | `onError` con toast en ambas |
| S-C | Exportaciones (caja, productos, clientes, voucher) | `useDownloadFile` tragaba el error y no relanza → los `try/catch` con toast de los callers nunca se ejecutaban | toast por defecto en el hook cuando el caller no pasa `onError` |
| S-D | KDS → POS (`kds-board.tsx`) | las transiciones de comanda no invalidaban órdenes del POS: con el WS caído, cuentas/pendientes stale hasta 30s | `invalidateTickets` también invalida `["orders"]` |
| S-E | Login de garzón | `WAITER` sin ruta propia → doble redirect en cada login | `getHomeRouteForUser` devuelve `/pos/terminal` |
| S-F | Sesión expirada (401) | se redirigía a `/login` pero el token/sesión stale quedaba en localStorage | `redirectToLogin` limpia `frig.token`, `frig.branch_id` y `frig.session` |
| S-G | Toggle "Cotizaciones" del config POS | opción sin efecto: el terminal nunca consume `quotes` | toggle oculto del modal hasta implementar el flujo (la clave queda en `PosConfig`) |

## 4. Contrato frontend ↔ OpenAPI

Verificación exhaustiva: 349 llamadas vs 1.080 paths del spec.

- **0** métodos HTTP fuera de contrato. ~249 paths verificados por matcher exacto; los bodies de escritura frecuentes (órdenes, pagos, caja, productos, clientes) alineados campo a campo con los request schemas.
- **[VERIFICADO EN VIVO + CORREGIDO] C-1 (Alta)**: `POST /finance/tax-documents/{id}/cancel/` (`tax-documents.ts`) **no existe en el backend** (probe sin auth: 404 en la ruta vs 401 en `create_credit_note/` e `issue/`, que sí existen). Corrección aplicada: "Anular" sobre borrador ahora hace `DELETE /finance/tax-documents/{id}/`; sobre documento emitido crea una nota de crédito con el motivo (única vía real del backend). Hallazgo adicional del mismo archivo: 6 operaciones (documentos tributarios, gastos fijos, bancos) hacían `JSON.stringify` del body pese a que `apiFetch` ya serializa → body doble-encodificado que DRF rechazaba. Corregidas las 6.
- **[VERIFICADO EN VIVO] C-2 (resuelto)**: el canal `/ws/branch/{id}/` **existe** en el backend (handshake con token inválido devuelve 403, no 404) y exige auth. El realtime de Frig es legítimo; `docs/api-map.md` §10 quedó actualizado.
- **Drift del spec (bajo, spec-side)**: drf-spectacular documenta como body el serializer completo del viewset en acciones custom (`pay`, `pay_order`, `occupy`, `mark_received`, …). El frontend y el backend reales usan payloads dedicados; el contrato tipado miente en esos endpoints. No afecta operación; regenerar schema con `@extend_schema` en el backend.
- **Baja**: ~12 GETs construyen la URL sin barra final cuando el query-string queda vacío y dependen del 301 de `APPEND_SLASH` (funciona; fricción evitable).

## 5. Features importantes ausentes (no rotas — no existen)

| ID | Feature | Detalle |
|----|---------|---------|
| A-1 | Cotizaciones gestionables | `/quotations` es solo lectura (lista + export). La API tiene `convert_to_order` y `stats` sin UI. El POS tampoco crea cotizaciones (por eso se ocultó el toggle, S-G) |
| A-2 | Devoluciones | `POST /sales/orders/{id}/return_products/` existe en backend, sin flujo UI |
| A-3 | Juntar/separar mesas | Sin endpoint ni UI |
| A-4 | Anular movimiento de caja | Endpoint backend `cancel-movement/` sin UI |
| A-5 | Reportes de rentabilidad | Endpoints `financial-metrics` sin UI (API cliente exportada pero sin imports) |
| A-6 | Menú público "agregar al pedido" | Tooltip "Próximamente" visible para los clientes del restaurante |

## 6. Backlog conocido (ya documentado en plan-madurez-api.md, no repetido como hallazgo)

Token en localStorage → cookie HttpOnly · query keys fragmentadas · optimistic updates · polling duplicado con WS · N+1 de estaciones POS · bootstrap del terminal (12 requests al montar) · warehouses descarga 40k productos · WS con token en URL y sin re-auth en reconnect.

Además de esta auditoría: tras una venta, el dashboard depende del evento WS scope `dashboard` (o queda stale hasta navegar); confirmar que el backend lo emite.

## 7. Recomendaciones priorizadas

1. ~~Verificar en vivo C-1 y C-2~~ — **hecho 2026-09-03**: C-1 era real (roto) y quedó corregido en frontend; C-2 verificado (el canal WS existe).
2. Si el canal WS existe, mantener; si no, desactivar el intento de conexión y documentar polling-only.
3. Decidir si Cotizaciones (A-1) entra al roadmap: es la funcionalidad de mayor valor de las ausentes y su API ya existe.
4. Regenerar el schema OpenAPI en el backend corrigiendo el drift de acciones custom (mejora los tipos de Frig).
