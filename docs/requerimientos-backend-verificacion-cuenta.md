# Requerimientos backend — Verificación de cuenta de usuario

> Fecha: 2026-09-06 · Solicitado desde FRIG (página de perfil) · Estado: **pendiente en Yggdra**

## Contexto

El modelo `User` ya tiene el campo `is_verified` (visible en el schema OpenAPI, `UserModel`), pero hoy es **inutilizable desde el frontend**:

1. **No se expone**: `GET /api/accounts/users/my-profile/` devuelve solo `{dni, email, first_name, last_name, username}` y `GET /api/accounts/users/me/` solo 7 campos básicos. Ninguno incluye `is_verified`. (Verificado con probe autenticado en vivo, 2026-09-06.)
2. **No hay flujo**: no existe endpoint para iniciar verificación (enviar correo), confirmar ni reenviar.

## Requerimientos

### R1 (mínimo) — Exponer el estado

Agregar `is_verified` al serializer de `my-profile/` (es el que consume el perfil de FRIG).

```
GET /api/accounts/users/my-profile/
→ { ..., "is_verified": true }
```

Con solo esto FRIG puede mostrar el badge "Cuenta verificada / No verificada" en el perfil.

### R2 — Flujo de verificación por correo

```
POST /api/accounts/users/send_verification/
  → envía correo con token/enlace al email del usuario autenticado
  → respuesta: { "detail": "Correo de verificación enviado." }
  → throttle: 1 por minuto (evitar abuso)

POST /api/accounts/users/confirm_verification/
  body: { "token": "<uidb64>:<token>" }   (mismo patrón que reset_password_confirm)
  → marca is_verified=True
  → errores: token inválido/expirado con mensaje claro
```

### R3 — Reenvío y estado en login (nice-to-have)

- Permitir reenviar desde el perfil (mismo endpoint R2, con cooldown).
- Incluir `is_verified` en la respuesta de `login_complete/` para que el front pueda sugerir verificación al entrar.

## Criterios de aceptación

- [ ] `my-profile/` incluye `is_verified`
- [ ] `send_verification/` envía correo real (configurar SMTP/base de correo de Yggdra) y acepta reenvío con throttle
- [ ] `confirm_verification/` valida token y persiste el cambio (idempotente: verificar 2 veces no falla)
- [ ] Schema OpenAPI regenerado con las 2 operaciones nuevas
- [ ] FRIG verifica con `scripts/api-audit/` que las nuevas rutas aparecen en cobertura

## Notas

- El patrón ya existe en el backend: `forgot_password/` + `reset_password_confirm/` usan tokens DRF. Reutilizar esa infraestructura (django.core.signing / PasswordResetTokenGenerator) minimiza el trabajo.
- El frontend FRIG queda listo para consumir R1 apenas esté (el bloque "Cuenta" en `src/app/(app)/profile/page.tsx` es el lugar natural del badge).
