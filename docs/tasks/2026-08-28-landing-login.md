# Landing de producto dentro de /login — FRIG

> Fecha: 2026-08-28. Estado: plan aprobado por el product owner; implementación aplicada en esta fecha.

## Objetivo

El `/login` deja de ser una pantalla plana y pasa a ser una landing de producto: presenta FRIG, sus características y sus novedades, con un CTA "Solicita una demo" para captar interesados, sin tocar el flujo de autenticación.

## Decisiones aprobadas (product owner)

1. **Ubicación:** landing dentro de `/login` como split de dos columnas (marketing + formulario). Sin cambios de routing.
2. **Novedades:** contenido estático tipado en `src/content/landing.ts`, editable por release.
3. **Marca:** híbrida — el panel de marketing fija la identidad FRIG (verde nórdico) ignorando el tema del tenant; la tarjeta de login conserva el tema white-label del tenant.
4. **CTA:** `mailto:frig@yggdra.cl`.
5. **Dirección de diseño:** FRIG es nombre nórdico; identidad verde con sutileza nórdica — limpio, elegante, sin gimmicks. Alto impacto visual sin romper las convenciones UI/UX existentes.
6. **Mensaje:** "todo incluido desde el día uno"; escala de negocio local a restaurante/pub; los costos suben con más clientes, no por desbloquear módulos. Diferenciación positiva sin atacar a la competencia.

## Alcance

Incluye: contenido tipado, componentes `landing-panel`/`demo-cta`, rediseño de `/login`.  
Excluye: backend, endpoints, routing, cookie/session handling, CI.

## Criterios de aceptación

- Flujo de login comportamentalmente idéntico (token, routing por rol, multi-branch).
- Panel: hero + ≥5 features + ≥2 novedades, CTA visible sobre el fold en desktop.
- Panel no se recolorea por tema de tenant; tarjeta de login sí lo hace (como hoy).
- `tsc`/`eslint`/`next build` (Node 20) en verde; `prefers-reduced-motion` respetado.

## Riesgos

- Romper auth → mitigado: se mueve solo markup, lógica intacta.
- Landing que se recolorea por tema persistido → mitigado: scope de CSS vars propios.
- Copy de novedades desactualizado → editable en un solo archivo.

## Rollback

Frontend-only en ruta pública: `git revert` del cambio restaura el login actual.
