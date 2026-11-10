# Plan: token fuera de localStorage + WebSocket sin `?token=` (P0-08)

**Estado:** implementado en `frig.yggdra.cl` (2026-11-10, #62). En hosts de otro sitio sigue el token.  
**Fecha:** 2026-10-16

## Estado actual

- `src/lib/api/auth-mode.ts` decide por host: misma web que la API (`*.yggdra.cl`, https) → cookie HttpOnly `auth_token` + `X-CSRFToken` (de `GET /accounts/csrf/`); el WebSocket conecta sin `?token=`.
- `intranet.macanuobowl.cl`, `mani.agenciapatagoniachile.com` y el staging en github.io son otro sitio: el backend emite las cookies con `SameSite=Lax` y el navegador no las envía, así que ahí se mantiene `Authorization: Token`. Para sacarlos del token hay que servirlos bajo `*.yggdra.cl` o darles una API en su propio dominio.
- Validado en vivo desde `frig.yggdra.cl` con la demo `pos`: login deja la cookie, `/me` y `/sales/orders/` responden 200 sin header, WS abre sin token, POST sin CSRF → 403, con CSRF → 200, logout → 401.

## Problema

- El token DRF vive en `localStorage` (`frig.token` vía `session-storage.ts`). Cualquier XSS en el origen estático puede robar la sesión.
- El WebSocket de sucursal autentica con `?token=` en la URL (`useBranchWebSocket.ts`), lo que filtra el secreto a logs de proxy, analytics y historial de red.

## Objetivo

1. Autenticación de API solo con cookie **HttpOnly** (+ `Secure` / `SameSite`) emitida por Yggdra.
2. El front deja de leer/escribir el token en JS (o solo mantiene un flag de “sesión activa”).
3. El WS autentica por cookie de sesión o por subprotocolo/header post-handshake, nunca por query string.

## Pasos (Yggdra + Frig)

1. **Backend (`yggdra_infra`)**  
   - Confirmar/extender login para setear cookie HttpOnly con el token (o sessionid equivalente).  
   - CORS + `credentials: include` ya usados en Frig (`client.ts`).  
   - Endpoint logout que limpie cookie.  
   - WS: aceptar cookie o ticket de un solo uso en lugar de `?token=`.
2. **Frig**  
   - Dejar de llamar `setToken` / `getToken` para Authorization header si la cookie basta; o dual-run (cookie + header) una release.  
   - Migrar `logout-local` a no depender de borrar `frig.token` como única fuente.  
   - Actualizar `useBranchWebSocket` a URL sin query secret.  
   - CSP / sanitización para reducir XSS residual.
3. **Rollout**  
   - Feature flag / periodo dual.  
   - Probar white-label multi-host (cookies por dominio).  
   - Actualizar contract tests y docs de sesión.

## No hacer en este PR

Cambiar storage o el WS ahora rompería login en hosts FTP estáticos sin cookie domain alineado.
