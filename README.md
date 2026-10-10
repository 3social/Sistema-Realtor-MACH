# PropertyMatch — Sistema Realtor MACH

Lee los mensajes y flyers de **grupos de WhatsApp de realtors**, los clasifica como
**oferta** o **demanda** con IA y detecta automáticamente los pares compatibles
(matches) para mostrarlos en un dashboard.

## Cómo funciona

```
Grupos de WhatsApp
      │
      ▼
Número dedicado vinculado a Evolution API (Baileys, Easypanel)
      │  webhook MESSAGES_UPSERT
      ▼
POST /api/ingest  (Vercel) ──►  lib/parser.ts
                                 1. OpenAI (gpt-4o-mini, visión): oferta / demanda / ignorar + campos
                                 2. OpenAI embeddings (text-embedding-3-small)
                                 3. Supabase `properties` (pgvector)
                                 4. lib/matcher.ts → función SQL `match_properties` → `matches`
                                        │
                                        ▼
                           /dashboard  (GET/PATCH /api/matches)
```

También existe `POST /api/webhook`, el webhook de la **API oficial de Meta** (solo chats
directos; la Cloud API no entrega mensajes de grupos). Comparte el mismo pipeline.

## Reglas de matching
`match_properties` (SQL) empareja una propiedad con sus contrapartes (oferta ↔ demanda). Si un dato falta en
cualquiera de los dos lados, ese criterio no descarta. Deben cumplirse todos:
- **Tipo de propiedad** igual: `casa`, `apartamento`, `lote`, `finca`, `local` u `oficina`.
- **Operación** igual: venta o alquiler.
- **Zona** compatible: una contiene a la otra (`Escazú` ⊂ `San Rafael de Escazú`), sin acentos/mayúsculas;
  una demanda puede listar varias zonas (`Escazú, Santa Ana`).
- **Precio**: el precio más bajo de la oferta ≤ presupuesto máximo de la demanda **+ 10 %**.
- **Habitaciones** dentro de lo que pide la demanda; **remitentes distintos**; propiedades activas.
- Después, similitud de embeddings (características y resumen) > 0.6 (`MATCH_THRESHOLD` en `lib/matcher.ts`).

## Stack
Next.js 16 (App Router, Turbopack) · React 19 · Tailwind 4 · Supabase (Postgres + pgvector) ·
OpenAI · Evolution API v2 · Vercel.

> Este Next.js tiene cambios incompatibles con versiones anteriores. Lee `AGENTS.md` y la
> documentación en `node_modules/next/dist/docs/` antes de modificar rutas o convenciones.

## Estructura
| Ruta | Función |
|---|---|
| `app/api/ingest/route.ts` | Entrada de grupos desde Evolution API (auth: `INGEST_SECRET`) |
| `app/api/webhook/route.ts` | Webhook de Meta (verificación + mensajes; firma si hay `WHATSAPP_APP_SECRET`) |
| `app/api/matches/route.ts` | Lista y actualiza el estado de los matches |
| `app/api/properties/route.ts` | Consulta del pool de propiedades |
| `app/dashboard/page.tsx` | Dashboard de matches |
| `lib/parser.ts` | Clasificación y extracción con OpenAI, guardado y dedupe por `messageId` |
| `lib/embeddings.ts`, `lib/openai.ts` | Embeddings y cliente OpenAI (creación perezosa) |
| `lib/matcher.ts` | Búsqueda vectorial de contrapartes |
| `lib/supabase.ts`, `lib/whatsapp.ts` | Clientes Supabase y descarga de media de Meta |
| `supabase/schema.sql` | Esquema, función `match_properties` y RLS cerrada |

## Variables de entorno
| Variable | Uso | Requerida |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anon | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role (solo servidor) | Sí |
| `OPENAI_API_KEY` | Clasificación y embeddings | Sí |
| `INGEST_SECRET` | Secreto de `/api/ingest` (header `x-ingest-secret` o `?secret=`) | Sí (para grupos) |
| `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET` | API oficial de Meta | Solo si usas `/api/webhook` |

Nunca se suben al repositorio (`.env*` está en `.gitignore`).

## Desarrollo local
```bash
npm install
# crea .env.local con las variables de arriba
npm run dev        # http://localhost:3000 → /dashboard
npm run lint
npx tsc --noEmit
npm run build
```

## Documentación
- [`DEPLOY.md`](DEPLOY.md): infraestructura y despliegue.
- [`EVOLUTION_SETUP.md`](EVOLUTION_SETUP.md): conectar el número con Evolution API.
- [`CHECKLIST.md`](CHECKLIST.md): confirmación de estado del sistema.
- [`graphify-out/GRAPH_REPORT.md`](graphify-out/GRAPH_REPORT.md): mapa del código (`graphify update .` lo regenera).

## Costos (orientativo; confirmar tarifas en OpenAI)
- Mensaje de texto ≈ $0.0002 (clasificación `gpt-4o-mini` + embedding); imagen/flyer ≈ $0.001–0.003.
- ≈ $0.20 por cada 1,000 mensajes de texto. Todo mensaje de grupo pasa por OpenAI, salvo el texto de menos de 15 caracteres
  ("ok", "gracias"), que se descarta antes; las imágenes siempre se procesan.
- Control: límite mensual y alertas en platform.openai.com → Billing → Limits; consumo real en Usage.

## Avisos
- Evolution/Baileys es un cliente **no oficial** de WhatsApp: usa un número dedicado, no envíes mensajes
  desde él y entra a los grupos gradualmente. Hay riesgo de bloqueo del número.
- El dashboard y `/api/matches`/`/api/properties` **no tienen login propio**; hoy los protege la
  Vercel Authentication del proyecto. No la desactives sin agregar autenticación.
