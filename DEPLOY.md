# Despliegue — PropertyMatch

## Infraestructura actual
| Pieza | Dónde | Detalle |
|---|---|---|
| App | Vercel, proyecto `sistema-realtor-mach` (equipo "Michael's projects") | Deploy automático desde `main` |
| Dominio | `https://sistema-realtor-mach-michael-proyectos.vercel.app` | Protegido por Vercel Authentication |
| Base de datos | Supabase, proyecto `property-matcher-mach` (`lleotnonyipedqmyxbmm`, us-east-1) | Esquema de `supabase/schema.sql`, RLS cerrada |
| Puente WhatsApp | Easypanel, proyecto `personaldev`, servicio `evolution-api` (v2.3.7) + `evolution-manager` | Instancia `propertymatch` (canal Baileys) |
| IA | OpenAI | `gpt-4o-mini` (clasificación) y `text-embedding-3-small` (embeddings) |

## 1. Supabase
1. Crea el proyecto y ejecuta `supabase/schema.sql` en el SQL Editor (habilita `vector`).
2. Verifica que existan `properties` y `matches` con RLS activa y **sin** políticas para anon:
   todo el acceso va por las rutas API con la service role.
3. Copia URL, anon key y service role key (Project Settings → API).

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
| `/api/ingest` responde 503 | Supabase u OpenAI no disponibles tras los reintentos; Evolution debería reintentar (ver `CHECKLIST.md`) |
| La sesión de WhatsApp se cae | Vuelve a escanear el QR en Evolution Manager |
