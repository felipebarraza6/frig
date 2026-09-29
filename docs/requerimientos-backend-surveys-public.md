# Backend: encuestas / levantamientos con link público

Fecha: 2026-09-27  
App: `surveys` (Yggdra) · Consumidor: FRIG CRM

## Estado: IMPLEMENTADO (yggdra_infra light)

### Modelo
- `Survey.slug` único por `branch` (migración `0002_survey_slug`), auto desde título.

### Endpoints públicos (AllowAny, sin auth)
- `GET /api/surveys/public/{slug}/`
- `POST /api/surveys/public/{slug}/respond/`

### FRIG
- Hub: botones **Público** / **Copiar público**
- Página: `/survey/view?slug=…` (dev) · `/survey/<slug>` (prod placeholder)
- Link personalizado por cliente: `POST /surveys/surveys/{id}/client-link/` + query `c/t/e` (ver `requerimientos-backend-survey-client-token.md`)
