# 🚀 Guía de Deploy — WhatsApp Property Matcher

## PASO 1 — Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → **New Project**
2. Anotar la **Project URL** y las **API Keys** (Settings → API):
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon/public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

## PASO 2 — Ejecutar el Schema SQL

1. En tu proyecto Supabase → **SQL Editor** → **New Query**
2. Copiar y pegar el contenido completo de `supabase/schema.sql`
3. Click **Run** → verificar que no hay errores
4. Confirmar en **Table Editor** que existen las tablas `properties` y `matches`

---

## PASO 3 — Completar `.env.local`

Abrir `.env.local` y completar los valores reales:

```env
WHATSAPP_VERIFY_TOKEN=    # un string secreto que tú inventas
WHATSAPP_ACCESS_TOKEN=    # del portal de Meta
WHATSAPP_APP_SECRET=      # Meta → App settings → Basic → App secret (valida la firma del webhook)
WHATSAPP_PHONE_NUMBER_ID= # del portal de Meta
ANTHROPIC_API_KEY=        # de console.anthropic.com
OPENAI_API_KEY=           # de platform.openai.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

---

## PASO 4 — Probar en local

```bash
npm run dev
```

Abrir http://localhost:3000 → debe redirigir al dashboard.

---

## PASO 5 — Deploy en Vercel

```bash
# Opción A: CLI de Vercel
npx vercel --prod

# Opción B: conectar el repo en vercel.com → Import Project
```

En Vercel → **Settings → Environment Variables**, agregar todas las variables del `.env.local`.

> **Importante:** `SUPABASE_SERVICE_ROLE_KEY` debe marcarse como **Server-only**.

---

## PASO 6 — Configurar Webhook en Meta

1. Ir a [developers.facebook.com](https://developers.facebook.com)
2. Tu App → **WhatsApp** → **Configuration** → **Webhook**
3. Completar:
   - **Callback URL:** `https://tu-dominio.vercel.app/api/webhook`
   - **Verify Token:** el mismo valor de `WHATSAPP_VERIFY_TOKEN`
4. Click **Verify and Save** → debe aparecer ✅
5. En **Webhook Fields**, suscribirse a: `messages`

---

## PASO 7 — Verificación final

Enviar un mensaje de prueba al número de WhatsApp Business desde un grupo configurado:

```
Vendo casa en Escazú, 3 habitaciones, 2 baños, jardín, $180,000
```

Verificar en el dashboard que:
- [ ] Aparece clasificado como **oferta**
- [ ] Los campos se extrajeron correctamente
- [ ] Si hay demandas compatibles en la BD, aparece un match

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| Webhook no verifica | Verificar `WHATSAPP_VERIFY_TOKEN` coincide exactamente |
| Error 500 en webhook | Ver logs en Vercel → Functions |
| Sin embeddings | Verificar `OPENAI_API_KEY` válida y con créditos |
| Sin matches | Verificar función SQL `match_properties` ejecutada en Supabase |
| Dashboard vacío | Verificar que `NEXT_PUBLIC_SUPABASE_*` variables están en Vercel |
