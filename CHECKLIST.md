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
- ✅ `match_properties(uuid, …)` y `zones_compatible` ejecutables por `service_role`, no por `anon`.
- ✅ Matching por tipo (casa/apartamento/lote/finca), operación, zona, precio (+10 %), habitaciones y remitente:
  probado en la base con 13 casos (transacción revertida, sin filas residuales).
- ⬜ Limpieza: la función vieja `match_properties(vector, text, float, int)` sigue en la base (sin acceso para anon, sin uso);
  eliminarla en el SQL Editor con `DROP FUNCTION match_properties(extensions.vector, text, double precision, integer);`.
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

## 6b. Incidentes vistos en producción (2026-10-10)
- ⚠ Supabase estuvo inaccesible ~9 min (DNS `ENOTFOUND` y luego 521); los mensajes de ese lapso se perdieron (sin reintento).
- ✅ Corregido: `lib/retry.ts` reintenta fallos transitorios de Supabase (1 s, 3 s, 8 s, 20 s). Si sigue caído, `/api/ingest`
  responde **503** (sin guardar) para que el emisor reintente; los reintentos se descartan por `messageId`. Probado con un
  servidor simulado (2 fallos y éxito → 200; caída total → 503; recuperación → 200).
- ✅ Evolution reintenta el webhook ante 5xx: variables `WEBHOOK_RETRY_*` (10 intentos, 5 s → 300 s, ~25 min) configuradas en Easypanel
  (confirmado por el usuario; existen en el `.env.example` oficial de la 2.3.7). Verificar que la instancia siga *Connected*.

## 7. Cierre: pendientes del propietario
- ⬜ Rotar `INGEST_SECRET` (se expuso en el chat y viaja en la URL del webhook) y actualizarlo en Vercel y en Evolution.
- ⬜ Rotar las claves visibles en Easypanel (clave global de Evolution, `OPENAI_KEY` y VAPI en n8n, contraseñas de BD).
- ⬜ Límite mensual y alerta de gasto en OpenAI (Billing → Limits).
- ⬜ Decidir caducidad de publicaciones (ver abajo).

## 8. Mejoras pendientes (no bloquean la puesta en marcha)
- Descartar sin llamar a OpenAI los mensajes de texto muy cortos (< ~15 caracteres) para reducir gasto.
- Caducidad de publicaciones: hoy una oferta/demanda sigue activa para siempre (cruza con todo lo nuevo); desactivar tras N días.
- Cargar histórico: solo se procesa lo que llega desde que se activó el webhook (no el historial de los grupos).
- Autenticación del dashboard y de las rutas API.
- Calibrar el umbral de similitud (0.6) y el margen de precio (10 %) con mensajes reales; considerar área (m²) para lotes y fincas.
- Nombre del grupo (Evolution no lo envía en `MESSAGES_UPSERT`; se guarda el ID).
- Validar con un esquema (zod) el JSON devuelto por el modelo.
