# Gaps CRM pendientes (fuera del alcance de la reparación 2026-09-29)

Auditoría del ecosistema CRM en `dev` (commit `bc15f6f`). Lo roto y lo de mayor
impacto ya se reparó; esto es lo que queda, ordenado por dependencia.

## Backend (bloquea tipado y features)

1. **Regenerar OpenAPI en deploy** — ítem de aceptación aún abierto en
   `docs/requerimientos-backend-survey-client-token.md`. Mientras no se regenere,
   estos contratos viven como tipos manuales en el frontend:
   - `POST /surveys/surveys/{id}/client-link/` (`surveys.ts`)
   - `GET/POST /surveys/public/{slug}/[/respond/]` (`PublicSurvey`, `surveys.ts`)
   - `Survey.slug`, `SurveyList.slug/description/is_anonymous/…` (parches manuales)
   - `SurveyResponse.workflow` (extensión cliente)
   - `FollowUpCategory` (`crm.ts`), `OpportunityRow.lead/lead_name/description`
   - `DELETE /support/ticket-attachments/{id}/` definido en
     `docs/backend-cierre-produccion.md` §4 pero sin wrapper cliente.
2. **Endpoint de uploads genérico** — sin él, el tipo de pregunta "archivo" quedó
   deshabilitado en los creadores (el renderer sigue para respuestas existentes,
   que solo guardan el nombre del archivo). Requiere decisión de diseño backend.
3. **Plantillas de encuestas en servidor** — hoy `frig_custom_survey_templates`
   en localStorage (rotulado en la UI como "este dispositivo"). Sincronizar
   entre usuarios/dispositivos requiere endpoint nuevo.
4. **Filtros server-side para segmentos de clientes** — deuda/empresas/personas
   se filtran en memoria sobre la página actual (rotulado en la UI). Idealmente
   query params en `/customers/clients/`.
5. **Agregados para el informe CRM** — hoy samplea 200 filas por colección y
   agrega en cliente. Con volumen, conviene un endpoint de resumen.

## Frontend (postergado a propósito)

6. **Realtime/persistencia sin CRM** — `BranchEventScope` no tiene scope `crm`
   (`useBranchWebSocket.ts`); `PERSIST_KEY_PREFIXES` no incluye `"crm"` ni
   `"surveys"` (`query-persist.ts`), así que las listas CRM no se hidratan
   offline en la PWA.
7. **Guías de ayuda faltantes** — no hay guía para `/customers/pipeline` ni
   para el Informe CRM (`src/lib/help/guides.ts`).
8. **Equipment/IoT sin role gating** — cualquier rol puede crear equipos y
   dispositivos por URL; además `equipment` es submodule de inventory pero su
   ruta mapea a `null` (siempre visible).
9. **Limpieza de código muerto mayor**:
   - ~~`customer-fields-tab.tsx`~~ (eliminado en la reparación 2026-09-29)
   - `LevantamientoSendActions` en `customer-levantamientos-block.tsx`
   - `/reports/ventas` duplica `/reports/sales`; `/reports/finanzas` hace doble
     redirect; `/kds/station` en `ROUTE_MODULE_MAP` y `COOK_ALLOWED_PATHS`
     sin página real
10. **Rol MANAGER inasignable** — los hooks de permiso lo autorizan
    (`session.ts`) pero el catálogo de roles no lo ofrece (`roles.ts`).
11. **Landing sin CRM** — `src/content/landing.ts` no menciona el ecosistema
    CRM/encuestas/pipeline.
12. **PWA offline** — el SW no precachea `/customers` ni `/survey/view`; un QR
    escaneado offline cae en `/login`.
13. **CES sin flujo de creación** y **`respondent_email`** aceptado por la API
    pero no se recolecta en ningún formulario.
14. **dash-fast sin KPIs CRM** — el dashboard principal ya tiene card CRM; el
    cubo rápido no.

## Referencias de la auditoría

- `docs/plan-madurez-api.md` — la fábrica de keys (`src/lib/api/keys.ts`) y los
  hooks (`src/lib/hooks/useCrm.ts`) son el inicio de su Fase 1; falta extender
  el patrón al resto de los módulos.
- `docs/api-map.md` — no incluye `/api/crm/*`, `/api/surveys/*` ni
  `/api/support/*`; `FRIG_API_APPS` (consola API) tampoco.
