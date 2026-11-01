# Despliegue — PropertyMatch

## Infraestructura actual
| Pieza | Dónde | Detalle |
|---|---|---|
| App | Vercel, proyecto `sistema-realtor-mach` (equipo "Michael's projects") | Deploy automático desde `main` |
| Dominio | `https://sistema-realtor-mach-michael-proyectos.vercel.app` | Protegido por Vercel Authentication |
| Base de datos | VPS (Easypanel), proyecto `supabase`: `pm-db` (Postgres 17 + pgvector), `pm-rest` (PostgREST) y `pm-gateway` (nginx) | API compatible con supabase-js en `https://supabase-pm-gateway.aaqnec.easypanel.host`. Esquema de `supabase/schema.sql`, RLS cerrada |
| Respaldo temporal | Supabase Cloud `property-matcher-mach` (`lleotnonyipedqmyxbmm`) | Congelado desde el 2026-11-01 (1116 propiedades, 674 matches); pausar/eliminar tras unos días |
| Puente WhatsApp | Easypanel, proyecto `personaldev`, servicio `evolution-api` (v2.3.7) + `evolution-manager` | Instancia `propertymatch` (canal Baileys) |
| IA | OpenAI | `gpt-4o-mini` (clasificación) y `text-embedding-3-small` (embeddings) |

## 1. Base de datos (VPS, Easypanel)
Solo las piezas de Supabase que la app usa (REST y RPC). No hay Studio, Auth, Storage ni Realtime.

| Servicio | Imagen | Configuración clave |
|---|---|---|
| `pm-db` | `pgvector/pgvector:pg17` | Base `property`, pgWeb activo para SQL |
| `pm-rest` | `postgrest/postgrest:v14.8` | `PGRST_DB_URI` (rol `authenticator`, host `supabase_pm-db`), `PGRST_DB_SCHEMAS=public`, `PGRST_DB_EXTRA_SEARCH_PATH=public,extensions`, `PGRST_DB_ANON_ROLE=anon`, `PGRST_JWT_SECRET` |
| `pm-gateway` | `nginx:1.27-alpine` | Reescribe `/rest/v1/*` → `pm-rest:3000`; dominio https |

Montarlo desde cero:
1. Crea `pm-db` y ejecuta `supabase/vps-bootstrap.sql` (con la clave real de `authenticator`) y luego `supabase/schema.sql`.
2. Crea `pm-rest` y `pm-gateway`; termina con `NOTIFY pgrst, 'reload schema';`.
3. Las claves anon y service role son JWT HS256 (`{"role": "anon" | "service_role", "iss": "supabase"}`)
   firmados con `PGRST_JWT_SECRET`. Sus valores solo viven en Vercel y en Easypanel.

No usar la plantilla compose oficial de Supabase en este VPS: los contenedores no resuelven entre sí el
nombre `db` (`nxdomain`) y analytics, Kong y auth quedan en bucle. Los servicios nativos de Easypanel sí.

Backups: programar en Easypanel → `pm-db` → Backups (requiere un destino S3 configurado en Settings).

## 2. Vercel
1. Importa el repo `3social/Sistema-Realtor-MACH` (rama `main`).
2. Variables (Production), ver tabla de `README.md`. `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` e
   `INGEST_SECRET` como *sensitive*.
3. Tras cambiar variables hay que **redesplegar** (se aplican solo a despliegues nuevos).
4. Deployment Protection: la Vercel Authentication sigue activa. Para que Evolution pueda llamar a
   `/api/ingest`, crea un *Protection Bypass for Automation* y úsalo como `x-vercel-protection-bypass`
   (header o parámetro de URL). No desactives la protección mientras el dashboard no tenga login.

## 3. Evolution API (grupos)
Sigue [`EVOLUTION_SETUP.md`](EVOLUTION_SETUP.md): instancia Baileys `propertymatch`, webhook a
`/api/ingest` con `MESSAGES_UPSERT` y Base64 activos, y escaneo del QR con el número dedicado.

## 4. API oficial de Meta (opcional, solo chats directos)
Requiere `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN` (token permanente de un System User) y
`WHATSAPP_APP_SECRET`. En Meta → WhatsApp → Configuration: callback `…/api/webhook`, mismo verify
token, suscripción al campo `messages`. La Cloud API **no entrega mensajes de grupos**.

## Troubleshooting
| Problema | Solución |
|---|---|
| Build falla por credenciales | Los clientes de OpenAI se crean al usarse; revisa las variables de Supabase |
| `/api/ingest` responde 401 (HTML de Vercel) | Falta o es incorrecto el bypass de protección |
| `/api/ingest` responde 401 (texto "Unauthorized") | `INGEST_SECRET` distinto al de la URL/header |
| Llega el webhook pero no hay propiedades | Revisa Logs de Vercel: clasificación `ignore`, `OPENAI_API_KEY` o Supabase |
| Sin matches | Comprueba que existan oferta y demanda compatibles y que `match_properties` exista |
| `/api/ingest` responde 503 | Base de datos u OpenAI no disponibles tras los reintentos; Evolution debería reintentar (ver `CHECKLIST.md`) |
| API responde 502/504 o "connection refused" | Revisa en Easypanel que `pm-db`, `pm-rest` y `pm-gateway` estén corriendo |
| Función o tabla nueva da 404 (`PGRST202`/`PGRST205`) | Ejecuta `NOTIFY pgrst, 'reload schema';` en pgWeb |
| La sesión de WhatsApp se cae | Vuelve a escanear el QR en Evolution Manager |
