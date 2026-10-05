# Checklist de confirmación de estado

Leyenda: ✅ verificado · ⬜ pendiente / por confirmar · ⚠ riesgo conocido.
Última revisión: 2026-10-05, commit `0861354`.

## 1. Código
- ✅ `npx tsc --noEmit` y `npx eslint` sin errores.
- ✅ `npm run build` correcto con solo las variables de Supabase (sin claves de IA).
- ✅ `POST /api/ingest`: 401 sin secreto o con secreto malo; ignora chats directos, mensajes propios y eventos
  que no son `upsert`; encola mensajes de grupo con texto o imagen (probado en local).
- ✅ `POST /api/webhook` (Meta): firma `X-Hub-Signature-256` válida/ inválida/ ausente (200/401/401) con `WHATSAPP_APP_SECRET`.
- ✅ Dedupe por `messageId` en el pipeline.
- ⬜ Clasificación contra OpenAI con mensajes reales (no se pudo probar sin clave en el entorno de desarrollo).

## 2. Base de datos (Supabase `property-matcher-mach`)
- ✅ Tablas `properties` y `matches` creadas, RLS activa, sin políticas para anon.
- ✅ `match_properties` ejecutable por `service_role`, no por `anon`.
- ✅ Aviso de seguridad restante: solo "RLS sin políticas" (informativo y deseado).
- ⬜ Tras la primera prueba: la fila aparece en `properties` (verificación en el Table Editor).

## 3. Vercel (`sistema-realtor-mach`)
- ✅ Último despliegue de producción `READY`, rama `main`, commit `0861354`.
- ✅ Variables en Production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `OPENAI_API_KEY`, `INGEST_SECRET`.
- ✅ Vercel Authentication activa (protege dashboard y APIs).
- ⬜ Existe un *Protection Bypass for Automation* y su secreto está en la URL del webhook de Evolution.
- ⬜ Si se cambia alguna variable: redesplegar.

## 4. Evolution API (Easypanel `personaldev`)
- ✅ Servicios `evolution-api` (v2.3.7) y `evolution-manager` activos.
- ⬜ Instancia `propertymatch` (canal **Baileys**) creada, con *Ignore groups* apagado.
- ⬜ Webhook habilitado: URL de `/api/ingest` con `?secret=…` (y bypass), *by Events* apagado, Base64 encendido,
  solo evento `MESSAGES_UPSERT`.
- ⬜ Número dedicado vinculado (QR escaneado) y estado de la instancia *open/connected*.

## 5. Prueba de extremo a extremo
1. ⬜ Número dentro de un grupo de prueba.
2. ⬜ Mensaje de oferta: `Vendo casa en Escazú, 3 hab, 2 baños, $180,000` → fila `type=offer` en `properties`.
3. ⬜ Mensaje de demanda compatible: `Busco casa en Escazú hasta $200,000, 3 hab` → fila `type=demand` y un match en `/dashboard`.
4. ⬜ Flyer (imagen) con y sin caption → se clasifica y extrae datos.
5. ⬜ Repetir el envío/reintento → no se duplica (dedupe).
6. ⬜ Logs de Vercel sin errores (`[ingest]`, `[parser]`, `[matcher]`).

## 6. Seguridad y riesgos conocidos
- ✅ Políticas RLS abiertas eliminadas; secretos fuera del repo.
- ⚠ El dashboard y `/api/matches`, `/api/properties` no tienen login propio (solo la protección de Vercel).
- ⚠ `/api/webhook` (Meta) acepta mensajes sin firma si falta `WHATSAPP_APP_SECRET`; hoy no se usa y está tras la
  protección de Vercel.
- ⚠ El secreto de `/api/ingest` viaja en la URL: puede quedar en logs. Rotar `INGEST_SECRET` si se expone.
- ⚠ Evolution/Baileys es no oficial: riesgo de bloqueo del número; usar número dedicado, sin enviar mensajes.
- ⬜ Rotar las claves que quedaron visibles al listar variables de Easypanel (otros servicios del proyecto).

## 7. Mejoras pendientes (no bloquean la puesta en marcha)
- Autenticación del dashboard y de las rutas API.
- Filtrar el matching por operación (venta/alquiler) y rango de precio, además de embeddings.
- Nombre del grupo (Evolution no lo envía en `MESSAGES_UPSERT`; se guarda el ID).
- Validar con un esquema (zod) el JSON devuelto por el modelo.
