# Plan de madurez — capa de datos y consumo de API

> Fecha: 2026-08-28. Complementa `docs/api-map.md` (mapa del backend) y `docs/auditoria-frontend.md` (hallazgos).
> Diagnóstico: la capa de datos está en etapa **"funcional pero sin convenciones" (2/5)**. Este plan la lleva a 4/5 sin reescribir páginas.

## 1. Estado actual

**Fortalezas**
- Tipos TypeScript generados desde OpenAPI (`src/lib/api/types/yggdra.d.ts`, ~75k líneas).
- `apiFetch` centraliza auth, `X-Branch-ID` y formateo de errores DRF.
- TanStack Query en todas partes; `RealtimeProvider` por WebSocket invalida por scope; defaults razonables (`staleTime 30s`, `retry 1`, sin refetch-on-focus).
- El backend ya tiene buenos agregados: `/analytics/dashboard/summary/`, `/finance/cash-registers/daily_summary/`, `/shared/frontend-config/`.

**Debilidades**
- Sin convención de query keys: el mismo recurso vive bajo 3-4 claves distintas según la página (caja actual tiene ≥4 variantes) → refetches duplicados y datos con distinta frescura.
- Cliente HTTP sin timeout ni cancelación (`fetch` sin `AbortSignal`; los `queryFn` ignoran `signal`).
- Cero optimistic updates (`onMutate`: 0 usos) → KDS, mesas y POS esperan servidor + refetch en cada acción.
- Manejo de error inconsistente en mutations (KDS falla en silencio; otras hacen toast).
- N+1 y waterfalls: el terminal POS dispara ~12 requests al montar; el hub de estaciones hace 2N queries; warehouses detalle descarga hasta 40.000 productos para usar 2 campos.
- Boilerplate `URLSearchParams` + paginación repetido en ~35 módulos.

## 2. Fase 1 — Quick wins solo frontend (1-2 días, sin backend)

1. **Módulo central de query keys** (`src/lib/api/keys.ts`): `cashRegisterKeys.current(stationId)`, `orderKeys.list(filter)`, `tableKeys.all`, etc. Es el cambio de mayor retorno: habilita `setQueryData` confiable y elimina el cache fragmentado. Incluye unificar las variantes de `["cash-register", ...]`, `["tables", ...]`, `["kitchen-tickets", ...]`.
2. **Timeout + abort en `apiFetch`**: aceptar `signal` en `ApiOptions`, `AbortSignal.timeout(20_000)` por defecto, y propagar `({ signal })` desde cada `queryFn`.
3. **Una sola query de kitchen-tickets** sin `status` + `select` para derivar por estado: baja de 3 pollings de 10s a 1 en KDS, y el badge del sidebar consume la misma query (mismo fetch).
4. **Polling solo como fallback de WS**: donde `RealtimeProvider` ya invalida (`orders`, `kitchen-tickets`, `cash-register`), quitar o subir el `refetchInterval` a 60-120s condicionado al estado del socket. Agregar debounce de 300-500ms en `invalidateQueriesForEvent`.
5. **Invalidaciones post-venta completas**: al cobrar/crear orden invalidar también `["cash-register"]` y `["dashboard"]` (hoy quedan stale hasta 30s).
6. **`MutationCache` global con toast de error por defecto** en `providers.tsx`: arregla los errores silenciosos del KDS sin tocar cada mutation. Para 5xx mostrar mensaje genérico (seguridad, ver auditoría).
7. **Optimistic updates en KDS y mesas** (`onMutate` + rollback en `onError`): las transiciones de estado son triviales de revertir y es donde más se siente la latencia.
8. **Mapear `primary_image` en `toPosProduct`**: el serializer ya la envía y `BranchPOSConfig.show_product_images` existe — habilita fotos en el POS sin backend.
9. **Helper `buildQuery()` + `fetchPaginated()`** en `client.ts`: elimina el boilerplate de los ~35 módulos y unifica `getToken` con `session-storage.ts`.
10. **Eliminar doble filtrado cliente+servidor en `sales/page.tsx`** (~1185-1214): los chips rápidos filtran solo la página cargada → resultados incorrectos con paginación. Los filtros deben ser query params del backend.
11. **Revalidar `frontend-config` al volver a la app** (no solo en login): hoy un cambio de módulos no se refleja hasta re-login.

## 3. Fase 2 — Endpoints nuevos para Yggdra (2-4 días backend)

Ordenados por impacto medido en requests reales del frontend:

| # | Endpoint | Resuelve |
|---|----------|----------|
| 1 | `GET /api/pos/bootstrap/?station_id=` | El terminal hoy hace **12 requests + 1 waterfall** al montar (productos, categorías, modificadores, combos, cuentas abiertas, entregas, métodos de pago, caja, resumen del día, movimientos, mesas, catálogos públicos → menú). Una sola llamada con todo lo que el terminal necesita, con serializer ligero de producto (id, name, price, category, stock, primary_image). Es la pantalla más usada del negocio. |
| 2 | `GET /api/finance/cash-registers/fleet_status/` | Estado de caja + `daily_summary` por cada estación de la sucursal en 1 llamada. Elimina el N+1 del hub POS (2N queries por N estaciones) y parte del polling del terminal. |
| 3 | `GET /api/sales/kitchen-tickets/board/?station_id=` | Tickets agrupados por estado (PENDING/PREPARING/READY) con counts. Hoy son 3 queries × polling 10s en KDS + 1 polling de 15s en el sidebar por el badge. |
| 4 | `GET /api/sales/orders/open_summary/` | Cuentas abiertas + entregas pendientes con agregados (count, total) en vez de dos listados paginados completos. |
| 5 | `GET /api/inventory/products/price_map/` (o `fields=id,sale_price` en el listado) | warehouses detalle hoy descarga hasta 40.000 productos (bucle de 20 páginas × 2000) para construir un `Map<id, sale_price>`. |
| 6 | Anidar `modifier_groups` y `primary_image` en `ProductList` cuando `is_for_sale=true` | Elimina la query separada de `product-modifier-groups` y las fotos del POS. |
| 7 | `POST /api/sales/orders/export-excel/` con los mismos filtros del listado | Reemplaza la generación client-side de Excel (`orders.ts`) y el `page_size=10000`. Consistente con `products` y `customers`, que ya exportan desde el backend. |

**Formalizaciones de modelo** (cierran los gaps #1 y #3 de `api-map.md`):
- Campo `pickup_name` en `Order` (hoy se simula con `Client` genérico u `observation`).
- `service_mode` tipado en `BranchPOSConfig` (hoy JSON libre en `configuration_data`).

**Auth estructural** (seguridad): migrar el frontend a la cookie `auth_token` HttpOnly que el backend ya setea en `login_complete`, eliminando `frig.token` de JS. Requiere que Yggdra acepte la cookie como credencial primaria y CORS con credentials. Es la medida que de verdad cierra el riesgo de robo de token por XSS.

## 4. Fase 3 — Madurez (siguientes pasos)

- **Regenerar tipos OpenAPI en CI** (`openapi-typescript` contra `/api/schema/`) para detectar drift de contrato automáticamente.
- **CSP estricta con nonce** una vez auditados los scripts inline (el anti-FOUC ya es inline controlado).
- **WebSocket: token fuera de la URL** (subprotocolo o primer mensaje) y eventos de dominio más finos para reemplazar el polling restante.
- **MSW/contract tests** para la capa `lib/api` — hoy no hay tests del frontend.
- **Métricas de rendimiento percibido** (Web Vitals) en el terminal POS como pantalla crítica.
- Definir `gcTime` y políticas de caché por dominio (catálogo: largo; caja/KDS: corto + WS).

## 5. Roadmap sugerido

| Semana | Trabajo |
|--------|---------|
| 1 | Fase 1 ítems 1-6 (query keys, timeout/abort, KDS única query, WS-fallback, invalidaciones, MutationCache) |
| 2 | Fase 1 ítems 7-11 + coordinar con backend endpoints #1 y #2 |
| 3-4 | Endpoints #1-#4 en Yggdra + migración del terminal a `bootstrap/` |
| 5+ | Endpoints #5-#7, formalizaciones de modelo, migración a cookie HttpOnly, Fase 3 |
