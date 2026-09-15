# Requisitos — Endpoint `GET /public/landing-config/` (landing 100% dinámica)

> Objetivo: que ningún texto, lista o demo del landing viva en el código del
> front. Este repo (Frig) pasa a ser una **plantilla** reutilizable para otros
> productos: cambia el grupo/config del backend y el mismo front muestra otra
> marca, otros módulos, otras demos y otros precios.

## 1. Estado actual (línea base)

Hoy `GET /public/landing-config/` devuelve:

```json
{ "group": PlanGroupLanding, "brand": PublicLandingBrand | null, "plans": GroupPlanPublic[] }
```

Eso cubre checkout y precios. Todo lo demás está hardcodeado en el front:

| Contenido | Ubicación actual (front) |
|---|---|
| Hero (headline / subhead) | `src/content/landing.ts` → `LANDING_VALUE_PROP` |
| Módulos / features (12 ítems con ícono) | `LANDING_FEATURES` |
| Demos / casos de uso (9, con credenciales) | `LANDING_USE_CASES` |
| Planes (copy de respaldo) | `LANDING_PLANS` |
| Nota de precios, UF integración | `LANDING_PRICING_NOTE`, `LANDING_INTEGRATION_UF` |
| Contacto demo (email + asunto) | `DEMO_CONTACTS` |
| Links de nav y GitHub | `landing-site.tsx` → `NAV_LINKS`, `GITHUB_URL` |

## 2. Contraste general

- **Ruta:** se mantiene `GET /public/landing-config/` (extender el serializador,
  no crear endpoint nuevo).
- **Resolución:** igual que hoy: `?group=` > `?slug=` > `Host` header. Sin
  resolución → `404` y el front usa sus fallbacks locales.
- **Auth:** pública, sin token. **Branch:** ninguna.
- **Versionado:** incluir `schema_version: int` en la respuesta. El front ignora
  claves desconocidas (forward-compatible).
- **Caché:** respuesta cacheable (CDN/browser, `Cache-Control: max-age=300`
  sugerido). Cambios de contenido tardan ≤5 min en reflejarse.

## 3. Shape de respuesta propuesto

```jsonc
{
  "schema_version": 2,
  "group": { /* igual que hoy */ },
  "brand": { /* igual que hoy: app_name, logo_url, colors, tagline */ },
  "plans": [ /* igual que hoy */ ],

  "content": {
    "hero": {
      "headline": "Tu negocio completo, en una sola pantalla",
      "subhead": "Caja, mesas, cocina…",
      "cta_primary":   { "label": "Ver demos",   "href": "#demos" },
      "cta_secondary": { "label": "Ver precios", "href": "#precios" }
    },

    "nav": [
      { "href": "#demos",    "label": "Casos de uso" },
      { "href": "#producto", "label": "Módulos" }
    ],

    "features": [
      {
        "icon": "zap",              // token de ícono (ver §5)
        "title": "Punto de venta táctil",
        "description": "Cobra en segundos…",
        "scope": "Frig"             // opcional: etiqueta del módulo
      }
    ],

    "use_cases": [
      {
        "slug": "pos",
        "name": "Kiosco Express San Miguel",
        "rubro": "Punto de venta",
        "brand_color": "#f97316",
        "highlight": "Cobro táctil en segundos",
        "description": "Texto largo opcional para la tarjeta/expandida.",
        "demo_user": "pos@demo.yggdra.cl",
        "demo_password": "Demo2026!",
        "order": 1,
        "active": true
      }
    ],

    "pricing_note": "Precios en UF. Plan demo sin costo.",
    "integration_uf": 0,

    "contact": {
      "email": "frig@yggdra.cl",
      "demo_subject": "Solicito una demo de FRIG"
    },

    "footer": {
      "links": [ { "label": "Políticas", "href": "/politicas" } ],
      "social": [ { "network": "github", "href": "https://github.com/…" } ]
    }
  }
}
```

### Reglas del shape

1. **Todo el bloque `content` es opcional.** Si falta una clave, el front usa
   su fallback local (los actuales `LANDING_*`). Esto permite migrar por partes
   y evita romper landings con config parcial.
2. `use_cases[].demo_password` es sensible-pero-público por diseño (son demos
   abiertas). Requisito: el endpoint es HTTPS-only y no expone nada que no sea
   credential de demo. Si algún día hay demos privadas → flag `public: false`
   y el front no la lista.
3. `order` + `active` controlan visibilidad/orden sin redeploy.
4. IDs de planes del front (`demo|local|pro`) dejan de ser código: el front
   pinta lo que venga en `plans`, destacado vía `highlighted`/badge que ya
   maneja el grupo.

## 4. Requisitos del backend (para implementar "del otro lado")

1. Modelo de contenido por grupo: `LandingContent` (JSON field o tablas) con
   las claves de §3. Editable desde admin (Django admin basta para v1).
2. Validación de entrada: `icon` ∈ catálogo de tokens permitidos; colores HEX
   válidos; URLs absolutas; strings con límite de largo (headline ≤ 120, subhead
   ≤ 280, descripción ≤ 200).
3. Serializador público = solo claves de §3. Nada de datos internos del grupo
   (dueños, facturación, flags de pago).
4. Multi-tenant: cada grupo puede tener su propio `content` completo. Un grupo
   sin `content` → front con defaults de la plantilla (comportamiento actual).
5. `Cache-Control: public, max-age=300` + invalidación al guardar desde admin.
6. CORS abierto para los dominios de las landings.

## 5. Catálogo de íconos (tokens)

El front mapea tokens → componentes Lucide. V1 mínimo requerido por el front:

`zap, banknote, bike, chef-hat, credit-card, file-text, layout-grid, qr-code,
shield-check, store, truck, warehouse`

Reglas:
- Token desconocido → el front muestra un ícono neutro (`LayoutGrid`), nunca
  crash.
- El catálogo vive en el front (plantilla); el backend solo valida contra la
  lista que el front le declara (o acepta cualquier `kebab-case` y el front
  aplica fallback).

## 6. Requisitos del front (este repo, para aprovecharlo)

1. `fetchLandingConfig` ya existe; tipar la respuesta extendida y exponer
   `content` vía `useApp()` (o un hook `useLandingContent()`).
2. Reemplazar los imports directos de `LANDING_*` en `landing-site.tsx` por
   `content?.x ?? LANDING_X` (fallback local como single source of truth de
   defaults).
3. `/login/[slug]` sigue necesitando `generateStaticParams` (deploy FTP estático):
   manter `LANDING_USE_CASES` local como **lista de slugs para el export**, y en
   runtime validar contra `use_cases` del endpoint (slug desconocido → redirect
   a `/login?branch=<slug>`, que ya existe).
4. Deadline de fetch: si el endpoint no responde en ~3s, renderizar con
   defaults (no bloquear el render estático).

## 7. Criterios de aceptación

- [ ] Cambiar `content.hero.headline` en el backend cambia el hero sin redeploy (≤5 min).
- [ ] Agregar una demo en el backend la muestra en `#demos` con su login funcionando.
- [ ] Desactivar (`active: false`) una demo la oculta del landing.
- [ ] Grupo sin `content` → landing idéntica a la actual (defaults).
- [ ] Ícono con token desconocido → fallback visual, sin error.
- [ ] `schema_version` desconocida para el front → render con lo que entienda, sin crash.
