# Frig

## Qué es

Frig es el punto de venta gastronómico de Ginnung: caja, cocina, mesas, inventario, recetas y finanzas, multi-sucursal y white-label. Corre en el navegador y habla con la API Yggdra. No tiene backend propio.

## A quién sirve

Locales de comida y grupos con varias sucursales que venden en mostrador, mesa o delivery, y el equipo que administra catálogo, caja y compras. Sitios actuales del mismo build: [frig.yggdra.cl](https://frig.yggdra.cl), intranet.macanuobowl.cl y mani.agenciapatagoniachile.com.

## Stack

Next.js 16 (App Router, export estático), React 19, TypeScript, Tailwind CSS 4, TanStack Query, Zustand, Framer Motion. El CI instala con npm y `package-lock.json` (Node 24). También hay `bun.lock` en el repo; el pipeline no lo usa.

## Cómo correr en local

Requisito: Node 20 o superior y la API Ginnung en el puerto 8000 si vas a pegarle en local.

```bash
npm ci
npm run dev
```

La app queda en http://localhost:3000. Sin `NEXT_PUBLIC_YGGDRA_API_BASE`, el cliente de desarrollo apunta a `http://localhost:8000/api`.


## Variables de entorno

Solo nombres. Copia el ejemplo a un archivo local y completa los valores ahí. No los commitees ni los pegues en un issue.

| Nombre | Uso |
|--------|-----|
| `NEXT_PUBLIC_YGGDRA_API_BASE` | Base de la API, con `/api` |
| `NEXT_PUBLIC_APP_BUILD` | Identificador de build que muestra la app |
| `NEXT_PUBLIC_BASE_PATH` | Prefijo del export. Staging lo fija en `/frig` |
| `NEXT_PUBLIC_STAGING_URL` | URL pública del staging, para la landing |
| `YGGDRA_SCHEMA_YML` | Freeze local para `npm run sync-contract` |
| `YGGDRA_SCHEMA_URL` | URL alternativa del schema, solo el script de sync |
| `YGGDRA_INFRA_GITHUB_TOKEN` | Token opcional del script de sync para leer el repo de la API. No lo documentes con valor |
| `YGGDRA_INFRA_REF` | Ref del freeze en GitHub, solo el script de sync |

No hay `.env.example` en la rama por defecto. En CI y en el deploy de producción el workflow inyecta `NEXT_PUBLIC_YGGDRA_API_BASE` apuntando a `https://api.yggdra.cl/api`.


## Scripts

| Comando | Qué hace |
|---------|----------|
| `npm run dev` | Next en desarrollo |
| `npm run build` | Export estático |
| `npm run lint` | ESLint |
| `npm run type-check` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run test:watch` | Vitest en watch |
| `npm run sync-contract` | Regenera `src/lib/api/types/yggdra.d.ts` y `src/lib/api/contract-sha.ts` |
| `npm run audit:api` | Cruza el cliente con el OpenAPI |

`scripts/post-export.mjs` escribe el `.htaccess` del hosting Apache después del export. Lo llama el build de deploy, no hace falta correrlo a mano para desarrollar.


## Deploy (como está hoy)

| Evento | Workflow | Destino |
|--------|----------|---------|
| Push a `dev` | `staging.yml` | GitHub Pages del repo |
| Push a `production`, o dispatch | `deploy.yml` | FTP a frig.yggdra.cl, intranet.macanuobowl.cl y mani.agenciapatagoniachile.com |
| Push a `dev` y PRs | `ci.yml` | Lint, tipos, tests y build. No publica |
| CI o deploy en rojo | `ci-failure-issue.yml` | Abre o comenta un issue |

`docs/CONSUMERS.yaml` en la API registra el deploy como FTP desde la rama `production`. Los secretos y variables de FTP viven en GitHub Actions. Este documento no lista sus valores. El README anterior mencionaba la rama `master`; el workflow que está en el repo escucha `production`.


Este PR de documentación no cambia workflows, secretos ni el destino del deploy.

## Relación con la API Ginnung

Auth con `Authorization: Token` y sucursal en `X-Branch-ID`. El token de sesión del navegador queda en `localStorage`.

Módulos que usa el inventario de consumidores: accounts, branches, recipes, inventory, sales, finance, customers, suppliers, plan-checkout, tables, promotions, shared, public-catalog, public, external-apps, analytics.

`npm run sync-contract` lee el freeze local (`YGGDRA_SCHEMA_YML` o `../yggdra_infra/api/schema/openapi.yaml`) o, si no está, intenta la API. Si el schema no se puede bajar, el script puede actualizar solo el sha.

Id de consumidor y etiqueta de issues de backend: `front:frig`.


El chequeo reutilizable está en [docs/CONTRACT_CHECK.md](https://github.com/felipebarraza6/yggdra_infra/blob/main/docs/CONTRACT_CHECK.md) y en `.github/workflows/contract-check.yml` de `yggdra_infra`. Corre en el runner del VPS, compara el `schema_sha256` de `https://api.yggdra.cl/api/schema/contract/` con el sha commiteado en el front, regenera tipos desde el freeze de `api/schema/openapi.yaml` y exige `tsc --noEmit`.

En la rama por defecto de este repo **no hay** un workflow `contract.yml` que llame ese chequeo. El inventario `docs/CONSUMERS.yaml` del backend describe el estilo de consumo de cada app.

## Enlaces

- Arquitectura: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
- Mapa de API del cliente: [docs/api-map.md](docs/api-map.md)
- API Ginnung: https://github.com/felipebarraza6/yggdra_infra
- Chequeo de contrato: https://github.com/felipebarraza6/yggdra_infra/blob/main/docs/CONTRACT_CHECK.md
- Consumidores: https://github.com/felipebarraza6/yggdra_infra/blob/main/docs/CONSUMERS.md
- Producción: https://frig.yggdra.cl
