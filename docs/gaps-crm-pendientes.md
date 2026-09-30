# Gaps CRM/FRIG — estado: 0 gaps pendientes (2026-09-30)

Auditoría completa del sistema (CRM + núcleo operativo + catálogo/inventario +
dinero/organización/seguridad). Todo lo detectado fue corregido y verificado.

## Cerrado en esta última pasada

1. **`/salon-test` → `/salon-demo`** — demo del salón 3D rotulada como
   "datos de ejemplo", mock aislado (token dummy + fetch interceptado).
2. **Pagos** — botón deshabilitado "Cancelar (próximamente)" eliminado; queda
   anotado esperar al backend para anulación y `PURCHASE_ORDER` como fuente.
3. **CES** — plantilla "Esfuerzo (1-5)" en el creador de encuestas.
4. **`respondent_email`** — campo opcional en el formulario público.
5. **dash-fast** — cara Clientes con KPIs CRM (prospectos/pipeline/seguimientos).
6. **Consola API** — `crm`, `surveys` y `support` en `FRIG_API_APPS`;
   `docs/api-map.md` con la sección 17 de endpoints nuevos.
7. **Seeds de soporte** — `bootstrapFrigSupport` con guard por sucursal
   (fuera de queryFn, sin carreras).
8. **Informe CRM** — tablas (embudo/estados/fuentes/tipos/categorías) desde
   el resumen server-side; el sampleo de 200 filas queda solo como fallback.
9. **Lint: 0 errores y 0 warnings** — 174 problemas eliminados: imports y
   vars sin uso, 6 componentes StatCard muertos, función `leadName` muerta,
   `<img>` con disables correctos, `location.assign` absolutos, y todos los
   `exhaustive-deps` (wraps en useMemo, deps correctos, `selectOption` con
   useCallback, `moduleEnabledMap` dentro del memo).

## Únicos pendientes externos (decisión backend, no del repo)

- Anulación de pagos y `PURCHASE_ORDER` como fuente de pago (TODO en
  `payments/page.tsx`).

## Verificación de la auditoría completa (sin hallazgos)

Rutas internas todas resueltas (hrefs + template literals + APIs), landing sin
promesas incumplidas, paginación server-side en todas las listas, SW/PWA
sane (network-first HTML, API nunca cacheada, caches por build), sin secretos
hardcodeados, invalidaciones correctas en el checkout del POS.
