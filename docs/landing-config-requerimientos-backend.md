# Landing config transversal — requerimiento backend

> El requerimiento completo vive en el repo del backend:
> [`yggdra_infra/docs/tasks/2026-09-07-landing-config-white-label.md`](../../yggdra_infra/docs/tasks/2026-09-07-landing-config-white-label.md)
> (documento canónico — editar ahí).

## Resumen

Un único endpoint público y transversal para armar landings white-label desde
la API, sin contenido estático en el front:

- **`GET /api/public/landing-config/`** — resuelve por `?group=<slug>`
  (dominios internos), `?slug=<login_slug>` o header `Host` (misma lógica que
  `public-login-theme/by-host/`).
- Responde `{ group (slug, hero, features, pricing_note, contact_email,
  integration_uf), brand, plans }`; el `group.slug` reemplaza el
  `checkoutGroup` hardcodeado del front (checkout, estado y magic-link se
  derivan de él).
- Cambios: campos de copy en `PlanGroup` (`hero_*`, `landing_features`,
  `pricing_note`, `contact_email`), `highlighted`/`badge` en `GroupPlan`, y
  FK `Organization.plan_group` para ligar org/sucursal con su SaaS.

Estado: **implementado** (2026-09-07). El front consume `GET /public/landing-config/`
en `src/components/landing/landing-site.tsx` (hero, funciones con mapeo de
iconos, pricing note, contacto, UF de integración y planes con `highlighted`/
`badge`); `src/content/landing.ts` queda solo como fallback ante 404/error.
