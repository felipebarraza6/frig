# Plan: token fuera de localStorage + WebSocket sin `?token=` (P0-08)

**Estado:** diferido — riesgo alto / requiere backend Yggdra + cambio de hosting auth.  
**Fecha:** 2026-10-16

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
