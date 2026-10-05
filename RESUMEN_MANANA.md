# Resumen para retomar (2026-10-05)

## Hecho esta noche (sin cambiar el comportamiento existente)
- **Lint**: `eslint` y `tsc` limpios; `next build` OK (`app/dashboard/page.tsx`).
- **Webhook firmado** (`app/api/webhook/route.ts`): valida `X-Hub-Signature-256` si existe
  `WHATSAPP_APP_SECRET`. Si la variable no está, funciona igual que antes y avisa en logs.
  Probado en local: sin firma 401, firma falsa 401, firma válida 200.
- **`after()`** en el webhook: Vercel ya no corta el procesamiento tras responder a Meta.
- **RLS** (`supabase/schema.sql`): eliminadas las políticas abiertas (`true`) para anon.
  El dashboard solo usa API routes con service role, así que nada se rompe.
  Incluye `DROP POLICY IF EXISTS` por si ya corriste el schema anterior.
- `DEPLOY.md`: agregado `WHATSAPP_APP_SECRET`, quitado `cd property-matcher`.

## Estado de la infraestructura (revisado por MCP)
- **Vercel** (equipo "Michael's projects"): NO hay proyecto de este repo
  (solo barber-book, lalogiabarberia, portafolio-michael, juntiva-nextjs). Falta importarlo.
- **Supabase**: proyecto `property-matcher-mach` creado (ref `lleotnonyipedqmyxbmm`, us-east-1,
  `3social's Org`) con el schema aplicado. URL: https://lleotnonyipedqmyxbmm.supabase.co
  La service role key se copia a mano desde Project Settings → API (nunca al repo/chat).
- **Meta**: existe la app **"Property Matcher MACH"** (id 2056667298268873, eres admin).
  No pude inspeccionar webhook/permisos con las herramientas disponibles: revísalo a mano.

## Para salir a producción (orden)
1. ~~Supabase~~ ya creado y con schema (ver arriba).
2. Importar el repo en Vercel; variables: ver `DEPLOY.md` (incluye `WHATSAPP_APP_SECRET`;
   `SUPABASE_SERVICE_ROLE_KEY` server-only).
3. Meta → WhatsApp → Configuration: callback `https://<dominio>/api/webhook`, mismo
   `WHATSAPP_VERIFY_TOKEN`, suscribir `messages`. Vincular el número nuevo.
4. Probar con el mensaje de ejemplo de `DEPLOY.md`.

## Pendiente (no lo toqué porque cambia comportamiento; decídelo tú)
- **Autenticación del dashboard y de `/api/matches`, `/api/properties`**: hoy son públicas
  (exponen teléfonos). Opciones: Basic Auth con middleware/proxy, o Supabase Auth.
- **Matching**: filtrar por `operation` (venta/alquiler) y precio además del embedding.
- Validar con un schema (zod) el JSON que devuelve Claude.
- README genérico: reescribir.
- Aviso de Next 16: `middleware` ahora se llama `proxy` (ver docs en `node_modules/next/dist/docs/`).

## Actualización: solo OpenAI
- La clasificación (texto/flyers) ahora usa OpenAI (`gpt-4o-mini` con visión) en vez de Claude.
  Ya NO se necesita `ANTHROPIC_API_KEY`; solo `OPENAI_API_KEY` (clasificación + embeddings).
- Pendiente: probar con mensajes reales y ajustar el modelo (`CLASSIFY_MODEL` en `lib/parser.ts`) si la extracción no es buena.
