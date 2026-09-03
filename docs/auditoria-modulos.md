# Auditoría: círculo completo de módulos — FRIG

> Fecha: 2026-09-03 · Alcance: `apps/web` — ocultamiento de UI por módulo desactivado y completud del catálogo de módulos activables.
> Método: 3 frentes en paralelo — (1) cobertura de rutas/guards, (2) gates de features en UI, (3) catálogo de módulos vs uso real.
> Estado: hallazgos marcados **[CORREGIDO]** aplicados en esta misma fecha; el resto queda como backlog priorizado.

## 1. Resumen ejecutivo

El sistema de módulos (backend Yggdra + guards frontend) estaba sano en su mecanismo, pero había **3 módulos usados por la app sin forma de activarlos/desactivarlos desde la UI** (hueco en el círculo) y varias features que ignoraban el estado del módulo. Con los correjos de esta fecha, **todo módulo que la app consume está en `FRIG_ALWAYS_ON_MODULES` o `FRIG_SETTINGS_MODULES`**, y las features auditadas respetan el estado efectivo.

## 2. Hallazgos de activación (gaps del catálogo)

| ID | Severidad | Módulo | Uso en la app | Problema | Estado |
|----|-----------|--------|---------------|----------|--------|
| M-A | **Alta** | `deliveries` | Paneles delivery/retiro del POS (`pos-config.ts`), config de estación | Ni always-on ni activable: si el backend no entrega fila propia habilitada, delivery/pickup quedaban **siempre ocultos** en la config del POS. Además es submódulo de `logistics`, módulo inexistente en Frig | **[CORREGIDO]** — agregado a `FRIG_SETTINGS_MODULES` + card en `/settings/modules` |
| M-B | **Alta** | `cash_register` | Rutas `/cash-register/*`, menú, guard POS-dependiente, config POS | Ni always-on ni activable; doble identidad (también submódulo de `finance`). Sin fila habilitada, Caja desaparecía sin forma de reactivarla | **[CORREGIDO]** — agregado a `FRIG_SETTINGS_MODULES` + card (la descripción advierte que requiere POS) |
| M-C | Media | `promotions` | Ruta `/promotions/discounts`, menú Clientes | Ni always-on ni activable; si el plan no creaba la fila, la ruta quedaba bloqueada permanentemente | **[CORREGIDO]** — agregado a `FRIG_SETTINGS_MODULES` + card en categoría Clientes |
| M-D | Media | Submódulos (recipes/ingredients de nutrition, promotions/scheduling de customers, etc.) | `useIsSubmoduleEnabled`, `useIsNutritionEnabled` | `/settings/modules` no tiene UI para submódulos; ningún consumidor de `updateSubmoduleConfig`. `nutrition` puede quedar semi-habilitado sin forma de arreglarlo desde la UI | Backlog — UI de submódulos en la card de compuestos |
| M-E | Baja | Doble identidad plano/compuesto | `cash_register`/`tables`/`promotions`/`deliveries` aparecen en `COMPOSITE_SUBMODULES` | Los guards leen solo filas planas; el mapa compuesto queda como declaración sin consumidores. Riesgo de doble fuente de verdad si mañana se usa `submodule_config` | Backlog — decidir: o se limpia `COMPOSITE_SUBMODULES` o se alinean los guards |

## 3. Hallazgos de ocultamiento de UI

| ID | Severidad | Hallazgo | Archivo | Estado |
|----|-----------|----------|---------|--------|
| U-A | Media | PosQuickActions (Cuentas/Órdenes/Cobrar) se renderizaban siempre, ignorando la config efectiva del terminal (`order_history`/`customer_search`) y los módulos | `components/pos/pos-quick-actions.tsx` | **[CORREGIDO]** — props `showAccounts`/`showCollect` conectadas a `effectiveConfig`; queries de conteo gateadas |
| U-B | Baja | HELP_TOPICS de la command palette navegan a rutas de módulos desactivables sin chequeo (ej. "Hacer una venta en el POS" con `pos` off) | `components/command-palette/command-palette.tsx` | **[CORREGIDO]** — topics filtrados por `isPathModuleEnabled`; se oculta la sección si queda vacía |
| U-C | Media | `/quotations` y `/finance` huérfanas de `ROUTE_MODULE_MAP` (accesibles por URL sin gate; inconsistente con el resto) | `lib/modules.ts` | **[CORREGIDO]** — `"/quotations": "sales"`, `"/finance": "finance"` |
| U-D | Baja | Dashboard usaba chequeo laxo de nutrition (`useIsModuleEnabledFromConfig`) en vez del estricto (`useIsNutritionEnabled`, que exige recipes+ingredients) usado en `/products/nutrition` | `app/(app)/dashboard/page.tsx:139` | **[CORREGIDO]** |
| U-E | Media | Guard de rutas es redirect-after-render: la página prohibida renderiza y dispara sus queries antes de la redirección; si el refresh de frontend-config falló (se reintenta una sola vez por sucursal), el bloqueo puede no ocurrir nunca | `app/(app)/layout.tsx:127-129` | Backlog — bloquear render de `children` mientras la ruta no esté permitida |
| U-F | Baja | Queries de cuentas/pendientes del terminal corren aunque el panel esté deshabilitado (solo perf) | `pos/terminal/page.tsx:395-418` | Backlog — agregar `enabled` condicionado a la config |
| U-G | Baja | `/banks` mapeada pero huérfana de menú y sin links entrantes | `lib/modules.ts:34` | Backlog — ítem en menú Billeteras o eliminar página |
| U-H | Baja | Badges `ordersPending`/`cashOpen` declarados en el tipo nunca se calculan (solo `kitchenReady` existe) | `lib/modules.ts:189`, `app-sidebar.tsx:183-186` | Backlog — implementar o remover del tipo |

## 4. Estado final del círculo

Clasificación tras los correjos (todo módulo usado por la app tiene exactly una fuente de activación):

- **Always-on (11)**: dashboard, config, sales, product_catalog, customers, finance, payment_methods, bank_accounts, suppliers, recipes (+ implícitos null de rutas libres como `/profile`).
- **Activables en /settings/modules (10)**: pos, cash_register, tables, deliveries, production, inventory, nutrition, public_catalog, invoices, promotions.
- **Gaps**: 0 conocidos. Módulos del enum de Yggdra no usados por Frig (employees, logistics, water_management, waste_*, iot_telemetry, ai_agents, etc.) quedan fuera por diseño.

Regla para no romper el círculo: **todo módulo nuevo que consuma la app debe agregarse a `FRIG_SETTINGS_MODULES` (con su card) o a `FRIG_ALWAYS_ON_MODULES`**. Un módulo en ninguna lista queda fail-closed (rutas/menú bloqueados, sin forma de activarlo).

## 5. Backlog priorizado

1. **U-E** — Guard sin flash: no renderizar `children` en `(app)/layout.tsx` mientras `useIsRouteModuleEnabled` sea false (revisar roles operativos primero para no regresiones de cajero/garzón).
2. **M-D** — UI de submódulos en `/settings/modules` (mini-switches por compuesto vía `updateSubmoduleConfig`; consumir `activated_submodules` de la respuesta del toggle).
3. **M-E** — Limpiar o hacer consistente `COMPOSITE_SUBMODULES` con la lectura plana de los guards.
4. **U-F/U-G/U-H** — perfeccionos menores (queries gateadas, `/banks`, badges muertos).
5. Verificar en vivo (requiere sesión) que `by_branch`/`frontend-config` devuelven filas planas para `cash_register`, `promotions` y `deliveries` al activarlos con el toggle; si solo vienen dentro de `submodule_config` del compuesto, los guards planos no los verán y habr que adaptar la lectura.
