# Integrar el número (grupos) con Evolution API

Flujo: grupos de WhatsApp → número vinculado en Evolution API (Baileys) →
webhook `MESSAGES_UPSERT` → `POST /api/ingest` (Vercel) → clasificar → matching.

> Riesgo: Baileys es un cliente no oficial. Usa un **número dedicado**, no envíes
> mensajes desde él y entra a los grupos poco a poco.

## 0. Una vez (lado Vercel)
1. Variable `INGEST_SECRET` (Production): ya creada. Es el valor del header `x-ingest-secret`.
2. El proyecto tiene Vercel Authentication (SSO), que bloquea a Evolution con 401. Elige una:
   - **A (recomendada)**: Vercel → Project → Settings → Deployment Protection →
     *Protection Bypass for Automation* → Add → copia el secreto. Evolution lo enviará en el
     header `x-vercel-protection-bypass`. (Si tu plan no lo ofrece, usa B.)
   - **B**: desactivar *Vercel Authentication* para Production. ⚠ Deja el dashboard y
     `/api/matches`, `/api/properties` públicos (muestran teléfonos) hasta que tengan login.

## 1. Crear la instancia y el webhook
Evolution: `https://personaldev-evolution-api.aaqnec.easypanel.host` (API key global =
`AUTHENTICATION_API_KEY` del servicio `evolution-api` en Easypanel).
Reemplaza `<APIKEY>`, `<INGEST_SECRET>`, `<BYPASS>` y `<DOMINIO>` (p. ej.
`sistema-realtor-mach-michael-proyectos.vercel.app`; sin la línea del bypass si usaste B):

```bash
curl -X POST https://personaldev-evolution-api.aaqnec.easypanel.host/instance/create \
  -H "apikey: <APIKEY>" -H "Content-Type: application/json" -d '{
  "instanceName": "propertymatch",
  "integration": "WHATSAPP-BAILEYS",
  "qrcode": true,
  "groupsIgnore": false,
  "rejectCall": true,
  "alwaysOnline": false,
  "readMessages": false,
  "readStatus": false,
  "syncFullHistory": false,
  "webhook": {
    "enabled": true,
    "url": "https://<DOMINIO>/api/ingest",
    "byEvents": false,
    "base64": true,
    "headers": {
      "x-ingest-secret": "<INGEST_SECRET>",
      "x-vercel-protection-bypass": "<BYPASS>"
    },
    "events": ["MESSAGES_UPSERT"]
  }
}'
```
(También se puede hacer en Evolution Manager → New Instance → Webhook.)

## 2. Vincular el número
1. Manager → instancia `propertymatch` → QR (o `GET /instance/connect/propertymatch`).
2. En el teléfono del número dedicado: WhatsApp → Dispositivos vinculados → Vincular → escanear.

## 3. Probar
1. Crea un grupo de prueba con el número dentro y escribe: `Vendo casa en Escazú, 3 hab, $180,000`.
2. Vercel → Logs: debe aparecer `[parser] Procesando text ...` y la propiedad en el dashboard.
3. Si responde 401: secreto/bypass incorrecto. Si no llega nada: revisa que el webhook esté
   `enabled` y el evento `MESSAGES_UPSERT`.

## Notas
- Solo se procesan mensajes **entrantes de grupos** (`@g.us`); chats directos y propios se ignoran.
- Evolution no envía el nombre del grupo; se guarda el ID del grupo.
- Los duplicados (reintentos) se descartan por `messageId`.
