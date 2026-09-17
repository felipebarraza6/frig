# Requisitos backend (Yggdra) — caché, sesión y protocolo

> Peticiones del front FRIG para mejorar rendimiento, consistencia y
> seguridad. Nada de esto bloquea el front actual: son mejoras de protocolo
> que el front ya está preparado para aprovechar.

## 1. Caché HTTP en endpoints públicos

Los públicos se piden en cada visita a login/landing (por cada dominio de
tenant). Hoy vuelven sin cabeceras de caché → el CDN/navegador re-descarga.

| Endpoint | Cabecera sugerida |
|---|---|
| `GET /public/landing-config/` | `Cache-Control: public, max-age=300` |
| `GET /branches/public-login-theme/by-host/` | `Cache-Control: public, max-age=300` |
| `GET /branches/public-login-theme/{slug}/` | `Cache-Control: public, max-age=300` |

- El front ya tiene caché de módulo (promise + TTL 5 min); con estas
  cabeceras el CDN absorbe el resto del tráfico.
- Opcional: `ETag` + `304` si el contenido no cambió (el content de estos
  endpoints cambia pocas veces al día).

## 2. Sesión: cookie httpOnly (reemplazo futuro de localStorage)

Hoy el token vive en `localStorage` (`frig.session`) → vulnerable a XSS.
Propuesta de migración compatible:

1. `login_complete` (y magic-login) setean además:
   `Set-Cookie: frig_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/`
2. El front sigue guardando el token en localStorage como fallback/compat.
3. `apiFetch` intenta `credentials: "include"`; si el backend acepta la
   cookie, el front deja de depender del localStorage gradualmente.
4. Logout: endpoint que expire la cookie + borrado local (ya existe).

Ventaja: el token deja de ser legible por scripts de terceros inyectados.

## 3. ETag en colecciones que cambian poco

`/shared/frontend-config/` se pide en cada arranque de app. Con
`ETag: <hash>` + `If-None-Match` → `304` sin body (el payload es grande).
Ahorra ~50-200 KB por arranque por usuario.

## 4. Consistencia de branding (doble fuente)

Hoy conviven dos fuentes de branding por sucursal:
- `theme_config` de la sucursal (lo que edita el dialog de temas).
- `branding.colors` de la organización (lo que devuelve el by-host).

El front ya prioriza: **sucursal > organización** dentro de la app, y usa
el by-host solo pre-auth. Sugerencia backend: que el by-host devuelva el
branding **efectivo resuelto** (branch gana sobre org, mismo criterio), así
login e app muestran siempre lo mismo sin depender de la prioridad del front.

## 5. Media de branding

- Servir logos/favicons con `Cache-Control: immutable` (los archivos bajo
  `/media/branchs/theme-logos/<uuid>/` son inmutables por nombre).
- Recomendar favicons cuadrados ≥ 64px: el front los usa como favicon del
  tenant con fallback al logo.
