<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PropertyMatch — convenciones del proyecto

Sistema que clasifica mensajes de grupos de WhatsApp (oferta/demanda) y detecta matches. Ver `README.md`
para la arquitectura y `DEPLOY.md` para la infraestructura.

## Reglas
- **Solo OpenAI** para IA (clasificación con visión y embeddings). No reintroducir Anthropic.
- Los clientes externos (OpenAI, etc.) se crean **perezosamente** (`lib/openai.ts`): no instanciar al
  importar el módulo, para que `next build` funcione sin claves.
- `SUPABASE_SERVICE_ROLE_KEY` solo en servidor (`lib/supabase.ts`, rutas API). Las tablas tienen RLS
  activa **sin políticas** para anon; no agregar políticas abiertas (`true`).
- Nunca escribir secretos en el repo, docs ni commits (`.env*` está ignorado). Valores solo en Vercel.
- `/api/ingest` exige `INGEST_SECRET` (falla cerrado). `/api/webhook` valida firma si hay `WHATSAPP_APP_SECRET`.
- Todo mensaje entrante pasa por `parseAndStoreMessage` (dedupe por `messageId`). No duplicar el pipeline.
- El dashboard y las rutas `/api/matches`, `/api/properties` no tienen login: no quitar la Vercel
  Authentication sin añadir autenticación antes.

## Flujo de trabajo
- Antes de commit: `npx tsc --noEmit && npx eslint && npm run build` (el build necesita las variables de
  Supabase, aunque sean ficticias).
- Despliegue: push a `main` → Vercel. Los cambios de variables requieren redesplegar.
- Tras cambiar código, `graphify update .` (los git hooks ya lo hacen en cada commit).
