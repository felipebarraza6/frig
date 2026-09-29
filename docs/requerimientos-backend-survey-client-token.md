# Backend: asociar cliente en levantamiento público

Fecha: 2026-09-27  
App: `surveys` (Yggdra) · Consumidor: FRIG CRM  
Estado: **IMPLEMENTADO** (yggdra_infra light)

## Endpoints

1. **Auth** `POST /api/surveys/surveys/{id}/client-link/`  
   Body: `{ "client": <id>, "ttl_seconds"?: number }`  
   → `{ slug, client, client_token, client_token_exp, query }`

2. **Público** `POST /api/surveys/public/{slug}/respond/`  
   Campos opcionales: `client`, `client_token`, `client_token_exp`  
   - Con token válido → `SurveyResponse.client` seteado  
   - Sin token → anónimo (como antes)  
   - `client` sin token → 400 (anti-spoof)

HMAC: `SURVEY_CLIENT_LINK_SECRET` o fallback `SECRET_KEY`.  
Mensaje: `{branch_id}:{survey_id}:{client_id}:{exp}`.

## FRIG

- WhatsApp desde ficha 360 pide `client-link` y arma `/survey/...?c=&t=&e=`
- `SurveyFillForm` (mode public) reenvía esos campos al respond
- Después: Aplicar a ficha / Cotizar en 360

## Criterio de aceptación

- [x] Link WhatsApp personalizado asocia la respuesta al cliente
- [x] Token inválido/expirado → 400
- [x] Respond sin token sigue anónimo
- [ ] OpenAPI regenerado en deploy (drf-spectacular en vivo)
