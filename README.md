# Bot de WhatsApp usando el Universal API Gateway

Este bot usa un gateway de terceros (`meta-gateway.clickarg.com`) que actúa
de intermediario con Meta: te resuelve el OAuth y te da endpoints simples
autenticados con tu propia API key (`mgk_...`). Es mucho más simple que ir
directo contra la API de Meta, porque no necesitás crear una app en
Meta for Developers.

## 1. Registrate y conseguí tu API key

```bash
curl -X POST https://meta-gateway.clickarg.com/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Mi Bot WhatsApp", "email": "tu-email@ejemplo.com"}'
```

Guardá el `apiKey` de la respuesta — no se vuelve a mostrar.

## 2. Instalar dependencias

```bash
npm install
```

## 3. Configurar `.env`

```bash
cp .env.example .env
```

Completá `GATEWAY_API_KEY` con el que te dio el registro.

## 4. Exponer tu servidor a internet (para desarrollo)

```bash
npx ngrok http 3000
```

Copiá la URL que te da (ej. `https://algo.ngrok-free.app`).

## 5. Conectar tu número de WhatsApp

Ejecutá el siguiente comando para obtener tu link de conexión (reemplazá `mgk_tu_api_key` por tu API key):

```bash
curl -X GET https://meta-gateway.clickarg.com/meta-auth/whatsapp/connect \
  -H "X-Api-Key: mgk_tu_api_key"
```

El comando te va a devolver una URL de Embedded Signup. **Copiá esa URL y abrila en tu navegador** para seguir el flujo con tu cuenta de WhatsApp Business.

Esto te da una URL de Embedded Signup — seguí el flujo con tu cuenta de
WhatsApp Business. El gateway guarda las credenciales de tu WABA
internamente; vos no manejás tokens de Meta en ningún momento.

## 6. Decirle al gateway dónde reenviar los mensajes entrantes

```bash
curl -X PATCH https://meta-gateway.clickarg.com/tenants/me \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: mgk_tu_api_key" \
  -d '{"webhookUrl": "https://tu-url-de-ngrok.app/webhooks/meta"}'
```

## 7. Correr el bot

```bash
npm start
```

Mandale un WhatsApp a tu número conectado y escribí "hola".

## ⚠️ Cosas que no pude confirmar del spec que me pasaste

El documento OpenAPI que subiste tiene algunos endpoints con el
`requestBody` vacío o sin especificar del todo:

- **`POST /whatsapp/messages/interactive/list`** (el menú): no especifica
  los nombres exactos de los campos. Le mandé la estructura que armé en
  `enviarMenu()` basada en cómo funciona la API de Meta — puede que el
  gateway espere nombres de campo distintos. **Corré el bot, probá el
  menú, y si tira un error 400, va a decirte qué campo espera** — ajustá
  esa función con el nombre correcto.
- **La forma exacta del payload que reenvía `/webhooks/meta` a tu
  `webhookUrl`**: el doc dice que reenvía eventos con headers
  `X-Meta-Gateway-Event` y `X-Meta-Gateway-Product`, pero no muestra el
  body completo para WhatsApp (sí lo muestra para leads de Ads). Dejé un
  `console.log` en el webhook — mandate un mensaje de prueba, mirá la
  consola, y si la estructura no es `entry[0].changes[0].value.messages[0]`
  (el formato nativo de Meta), ajustá el parseo en `manejarMensaje()`.

Si querés, pegame el output de esa consola la primera vez que te llegue un
mensaje y te ajusto el código exacto.

## Cómo funciona

- El bot mantiene un estado en memoria por número (`modo: 'menu'` o
  `'humano'`), igual que en las versiones anteriores.
- Al pedir "hablar con una persona", el bot dejar de responder
  automáticamente y te avisa (si configuraste `NUMERO_AGENTE`).
- Podés volver al bot en cualquier momento escribiendo "menu".

## Para producción

- Desplegá el servidor en algo persistente (Railway, Render, un VPS) en vez
  de ngrok, y actualizá el `webhookUrl` a esa URL final.
- Migrá el objeto `estados` a una base de datos — se pierde si reiniciás.
- Revisá los límites de tu plan con `GET /tenants/me/usage` — el plan FREE
  tiene 30 req/min y 5.000 req/mes.
