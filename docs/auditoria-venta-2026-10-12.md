# Auditoría venta — Frig ↔ Yggdra (2026-10-12)

> Alcance: operación end-to-end de Frig contra `https://api.yggdra.cl` (contrato `src/lib/api/types/yggdra.d.ts` + `contract-sha.ts`).  
> Repo backend (solo referencia, **no tocado**): `felipebarraza6/yggdra_infra`.  
> Método: cross-ref 424 llamadas front ↔ 1158 paths tipados + probes HTTP sin auth (401/400/200 = existe; HTML 404 = no existe) + revisión de gaps UI/roles/módulos.

## Veredicto

**Frig está lista para vender fuerte en lo crítico** (login, POS, cobro, caja, mesas, cocina, productos/recetas, checkout Flow, soporte). El contrato local quedó alineado al SHA vivo de producción. Quedan gaps de producto/UX y drift OpenAPI que necesitan backend o decisión, documentados abajo.

**Contrato:** `YGGDRA_SCHEMA_SHA = b833f62debe47f996791800ad8fefb7eb00c1b9d1057e64e516989d7fd160a20` (sync sha-only; prod no expone `/schema/?format=json`).

## Matriz operación × estado

Leyenda: **OK** · **arreglado** (este PR) · **necesita backend** · **necesita decisión**

| Operación | Estado | Severidad | Notas |
|-----------|--------|-----------|-------|
| Login por slug (`/accounts/users/login_complete/`, tema público) | OK | — | 400 sin body; branding `by-host` 200 |
| Logout / forgot / reset / set-initial-password | OK | — | Rutas existen (probes) |
| Crear venta POS (`POST /sales/orders/`) | OK | — | Body con `order_type`+`date`+`items` |
| Cobrar vía `createPayment` (POS) | OK | — | Inyecta `skip_cash_register_validation` |
| Cobrar vía `payOrder` (Ventas/cuentas) | OK | media | Drift OpenAPI: action tipada como `OrderRequest` → **necesita backend** (`@extend_schema`) |
| Dos caminos de cobro (POS vs Ventas) | necesita decisión | media | Unificar o documentar divergencias de caja/descuentos |
| Abrir caja | OK | — | `POST …/open/` |
| Cerrar caja | OK | — | `POST …/{id}/close/` |
| Resumen diario caja | OK | — | `GET …/daily_summary/` (no nested en `{id}`) |
| Ingresos/retiros caja | OK / necesita decisión | media | Frontend solo OWNER (`useCanManageCashMovements`); ADMIN_LOCAL no puede |
| Anular movimiento caja | OK / necesita backend | media | UI OWNER OK; schema marca `movement_id` uuid vs id numérico |
| Mesa ocupar / liberar / reservar / limpiar | OK / arreglado | media | Via `occupy/` + `action`; toast si libera/ocupa falla post-venta |
| Mesero `MESERO` ve mesas en POS | arreglado | alta | Alias faltaba en `useCanViewTables` |
| Comandas KDS start/ready/deliver/cancel | OK | — | 401 en prod |
| Inventario movimientos / low-stock | OK | — | Workaround LOSS→OUT documentado en cliente |
| Alta producto | OK | — | `POST /inventory/products/` |
| Alta receta | OK | — | Front inyecta `branch`+`code` |
| PDF etiqueta nutricional | necesita backend | baja | Backend ignora params; PDF cliente como mitigación |
| Clientes CRUD | OK | — | |
| CRM stages / opportunities / follow-ups | OK | — | Path correcto: `/crm/opportunity-stages/` |
| Reportes ventas / analytics / dashboard | OK | — | Paths tipados existen (401) |
| Informes rentabilidad (profitability-reports UI) | necesita decisión | media | API client parcial; sin pantalla de comparación/generate |
| Cotizaciones list/create/convert | OK | — | UI existe |
| Config módulos / POS / finanzas | OK | — | |
| Usuarios y roles | OK | — | |
| Checkout suscripción Flow (`/public/frig-checkout/`) | arreglado | baja | Front ahora envía `checkout_type` + `installments_count` (defaults del schema) |
| Catálogo planes públicos | OK | — | `GET /public/frig-plans/` 200 |
| Landing config | OK | — | `GET /public/landing-config/?group=frig` 200 |
| Magic login post-pago | OK | — | 400 sin body |
| Soporte crear ticket (`/support/tickets/submit/`) | OK | — | Fallbacks + mensajes 401/403/5xx |
| Crear cuenta abierta en Ventas (error UI) | arreglado | alta | Toast + `setAccountError` |
| Pagar todas las pendientes (fallos parciales) | arreglado | media | Toast si success+failed |
| 401 sesión | OK | — | Limpia token/branch/session y redirect slug |
| 403 módulo / permiso | OK | — | `ForbiddenListener`; silencia módulos secundarios en POS |
| Roles: CAJERO path lock | OK / necesita decisión | baja | Sin cotizaciones/reportes por diseño |
| Roles: WAITER/MESERO | OK / arreglado | — | Paths + mesas |
| Roles: COOK | OK | — | Solo KDS |
| Módulos apagados | OK | — | Fail-closed + redirect; `cash_register` exige `pos` |
| Móvil POS/caja/mesas | OK / necesita decisión | baja | Carrito pagos `max-h-[42vh]` puede apretar con teclado |
| Export Excel ventas (fallback local) | OK | baja | Catch silencioso del export server → fallback cliente |
| Schema OpenAPI público en prod | necesita backend | media | Solo `/schema/contract/`; no se puede regenerar `yggdra.d.ts` desde prod |
| Gate CI contrato SHA | arreglado | alta | SHA sincronizado con prod |

## Desajustes contrato (detalle)

| ID | Hallazgo | Severidad | Acción |
|----|----------|-----------|--------|
| C1 | SHA front (`811f645…`) ≠ prod (`b833f62…`) | alta | **arreglado** — `npm run sync-contract` (sha-only) |
| C2 | `POST …/pay/` tipado como `OrderRequest` en OpenAPI | media | **necesita backend** — `@extend_schema` con payload de pago |
| C3 | `PlanCheckoutCreateRequest` required `checkout_type` / `installments_count` con defaults | baja | **arreglado** — front los envía explícitos |
| C4 | `cancel-movement.movement_id` uuid en schema vs id numérico real | media | **necesita backend** — alinear schema al modelo |
| C5 | Acciones custom (occupy, pay, deliver…) documentan serializer completo | baja | **necesita backend** — regenerar schema |
| C6 | Prod no publica `/schema/?format=json` | media | **necesita backend** — exponer freeze o artifact CI para regenerar tipos |
| C7 | Cross-ref front↔tipos: 420/424 match; 4 “gaps” son falsos positivos de `export-${format}` | — | OK |

## Gaps funcionales (UI)

| ID | Hallazgo | Severidad | Estado |
|----|----------|-----------|--------|
| F1 | `MESERO` fuera de `useCanViewTables` | alta | **arreglado** |
| F2 | Solo OWNER hace cash in/out | media | **necesita decisión** (+ posible cambio back/front) |
| F3 | Crear cuenta en Ventas sin feedback de error | alta | **arreglado** |
| F4 | `freeTable` / `occupyTable` silenciosos post-venta | media | **arreglado** (toast) |
| F5 | Pagar todas: fallos parciales mudos | media | **arreglado** |
| F6 | CAJERO sin cotizaciones | baja | **necesita decisión** |
| F7 | UI rentabilidad incompleta | media | **necesita decisión** |
| F8 | “Juntar mesas” físico inexistente (sí hay merge de órdenes) | baja | **necesita decisión** |
| F9 | ForbiddenListener silencia módulos en POS | baja | **necesita decisión** |
| F10–F12 | Ver C2–C4 | — | backend |
| F13 | Viewport pagos móvil | baja | backlog UX |
| F14 | MANAGER no anula ventas | baja | **necesita decisión** |
| F15 | Dos caminos de cobro | media | **necesita decisión** |

## Cambios pedidos a `yggdra_infra` (sin tocar ese repo)

1. **Exponer contrato regenerable en prod** (o publicar artifact del freeze `api/schema/openapi.yaml` + `meta.json` en CI) para que Frig pueda correr `sync-contract` completo, no solo SHA.
2. **`@extend_schema` en acciones** `pay`, `occupy`, `deliver`, `add_items`, `return_products`, `cancel-movement`, etc., con request body real (no el serializer del viewset).
3. **`CancelMovementRequest.movement_id`**: tipar como entero (o UUID real si el modelo migró) y documentar.
4. **PDF nutricional**: respetar query params de tamaño/modo/logo o documentar que son no-op.
5. (Opcional producto) Permitir cash in/out a `ADMIN_LOCAL` / `MANAGER` si la política comercial lo pide.

## Tests añadidos

`src/lib/api/sale-flows.contract.test.ts` (vitest + mocks):

- crear venta · cobrar (`createPayment` + `payOrder`) · abrir/cerrar caja · mesa occupy/free · alta producto/receta · checkout Flow · crear ticket soporte.

## Verificación local (antes del push)

- `npm run sync-contract` (SHA = prod)
- Comparación SHA `schema/contract/` vs `contract-sha.ts`
- `npm run lint` · `npx next typegen` · `npm run type-check` · `npm test` · `npm run build`
