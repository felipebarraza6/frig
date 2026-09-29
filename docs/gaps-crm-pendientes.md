# Gaps CRM — estado tras la reparación completa (2026-09-29)

Auditoría del ecosistema CRM en `dev`. La reparación de P0+P1 y el cierre de
los gaps de frontend/backend ya está aplicado y verificado; esto es el estado.

## Resueltos en esta pasada

1. **OpenAPI regenerado** — freeze del backend (`schema/openapi.yaml`, sha
   `59644d2f`) y `yggdra.d.ts` regenerado vía `bun run sync-contract`. Los
   contratos de encuestas públicas, client-link, adjuntos, plantillas y
   filtros de segmento viven ahora en el schema generado.
2. **Adjuntos de encuesta** — `POST /surveys/attachments/` (autenticado) y
   `POST /surveys/public/<slug>/attach/` (anónimo, allowlist + tope 5 MB).
   El tipo de pregunta "archivo" vuelve a ofrecerse; el valor de la respuesta
   es la URL del adjunto.
3. **Plantillas de encuesta en servidor** — CRUD `/surveys/templates/` por
   sucursal; el hub las usa con react-query y migra una sola vez las viejas
   de `localStorage` (`frig_custom_survey_templates`).
4. **Segmentos de clientes server-side** — filtros `receiver_type`,
   `has_pending` y `tags` en `/customers/clients/`; el hub dejó de filtrar
   en memoria.
5. **Agregados del informe CRM** — `GET /crm/dashboard/summary/?start=&end=`
   devuelve KPIs + ventana previa; el informe los usa con fallback al
   sampleo de 200 filas.
6. **Realtime CRM** — scope `crm` en el websocket: leads/oportunidades/
   actividades emiten eventos al escribir y el frontend invalida `["crm"]`
   y `["surveys"]` (nav, hub, pipeline e informes entre dispositivos).
   Persistencia offline: prefijos `crm` y `surveys` en `query-persist.ts`.
7. **Guías de ayuda** — pipeline comercial e informe CRM en `help/guides.ts`.
8. **Equipment/IoT con role gating** — `useCanManageInventory` en equipos,
   telemetría y su informe.
9. **Código muerto eliminado** — `customer-fields-tab.tsx`,
   `LevantamientoSendActions`, `/reports/ventas` (duplicado de sales),
   `/kds/station` (mapping + botón roto; el monitor cubre el flujo).
10. **Rol MANAGER asignable** — "Gerente comercial" en el catálogo de roles.
11. **Landing + PWA** — feature CRM en la landing, `/customers` y
    `/survey/view` en el app shell del service worker, manifest actualizado.

## Pendientes menores (aceptados)

- **CES sin flujo de creación** y **`respondent_email`** aceptado por la API
  pero no recolectado en formularios.
- **dash-fast sin KPIs CRM** (el dashboard principal ya tiene card CRM).
- Las **tablas de detalle** del informe (estados/fuentes/tipos) siguen
  armadas en cliente sobre el sampleo; los KPIs ya son server-side.
- **173 warnings de lint** (preexistentes, no bloquean el gate): mayormente
  `exhaustive-deps` y variables sin usar heredadas del WIP.
- Los seeds `ensure*` de soporte (categorías/SLA) siguen corriendo desde el
  cliente; los de CRM ya corren una vez por sesión vía `useCrm`.

## Referencias

- `docs/plan-madurez-api.md` — la fábrica de keys (`src/lib/api/keys.ts`) y
  los hooks (`src/lib/hooks/useCrm.ts`) son el inicio de su Fase 1; falta
  extender el patrón al resto de los módulos.
- `docs/api-map.md` y `FRIG_API_APPS` (consola API) siguen sin incluir
  `crm`/`surveys`/`support`.
