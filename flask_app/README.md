# Flask Realtime Chat (System + Chatbot)

Aplicación mínima en Python/Flask con un sidebar y dos módulos:
- System: configurar el prompt del sistema, modelo y temperatura.
- Chatbot: interfaz tipo “Transcript” para conversar con el modelo (texto), con botones Copy y Download.

La configuración se guarda en `data/settings.json` y el backend llama a la API de OpenAI (Chat Completions) usando el SDK oficial.


## Requisitos

- Python 3.9+ (recomendado 3.10+)
- Una clave válida de OpenAI en `OPENAI_API_KEY`


## Instalación

```bash
cd flask_app
python3 -m venv .venv
source .venv/bin/activate   # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edita .env y coloca tu clave en OPENAI_API_KEY
```

Modelos habituales:
- gpt-4o-mini (por defecto en esta app)
- gpt-4o
- o1-mini, etc.

Nota: Asegúrate de que tu cuenta/plan tiene acceso al modelo elegido.


## Ejecución

```bash
python app.py
```

- Servidor en: http://localhost:5050
- Páginas:
  - http://localhost:5050/chatbot
  - http://localhost:5050/system


## Uso

1. En “System” define:
   - System Prompt: personalidad e instrucciones del asistente.
   - Modelo: por ejemplo `gpt-4o-mini`.
   - Temperature: creatividad.
   Guardar actualiza `data/settings.json`.

2. En “Chatbot”:
   - Escribe mensajes en el input.
   - El historial aparece tipo “Transcript” con timestamps.
   - Botón “Copy” copia el transcript como texto plano.
   - Botón “Download” descarga el transcript en `.txt`.

El frontend envía:
```json
POST /api/chat
{
  "message": "texto del usuario",
  "history": [{ "role": "user"|"assistant", "content": "..." }]
}
```
El backend agrega el `system` y responde con `{ reply, timestamp }`.


## Voz (Audio Realtime)

Esta app incluye conversación por voz usando OpenAI Realtime vía WebRTC.

Cómo usarlo:
1. Ve a la página System y verifica:
   - Realtime Model (por defecto: gpt-4o-realtime-preview-2025-06-03)
   - Voice (por defecto: verse)
   - Opcional: ajusta el System Prompt; se envía como `instructions` al crear la sesión.
2. Ve a Chatbot y en la sección “Voice” pulsa Connect:
   - El navegador solicitará permiso de micrófono.
   - Se creará una sesión efímera con `/api/session` y se negociará WebRTC con la API de OpenAI.
   - El audio remoto se reproducirá en el elemento `<audio>` automáticamente.
3. Mute Mic activa/desactiva el envío del micrófono sin desconectar.
4. Disconnect cierra la sesión.

Detalles técnicos:
- Endpoint backend `/api/session`:
  - Usa `OPENAI_API_KEY` del servidor para llamar a `POST /v1/realtime/sessions` y devuelve un `client_secret.value` efímero.
  - Configura `model`, `voice`, `instructions`, `turn_detection: server_vad` y `modalities: ["audio","text"]`.
- Cliente `static/js/voice.js`:
  - Captura el micrófono (echoCancellation, noiseSuppression, autoGainControl).
  - Crea un `RTCPeerConnection`, añade la pista local y hace intercambio SDP por REST: `POST /v1/realtime?model=...` con `Content-Type: application/sdp` y el token efímero.
  - Adjunta la pista remota al `<audio id="remoteAudio">`.

Requisitos del navegador:
- Chrome/Edge/Brave recientes recomendados.
- Conexión servida desde http://localhost o HTTPS para acceso a micrófono.
- Es necesario un gesto del usuario (el botón Connect) para reproducción de audio.

Solución de problemas:
- 401/403 al conectar: revisa que `OPENAI_API_KEY` esté en `.env` del servidor y que la cuenta tenga acceso al modelo realtime.
- “No ephemeral client_secret received”: el backend no pudo crear la sesión. Mira el log del servidor.
- No se escucha audio: verifica permisos de micrófono y el estado Mute, y que el dispositivo de salida sea el esperado.

## Arquitectura

Estructura:
```
flask_app/
├─ app.py                     # Flask app y rutas
├─ data/
│  └─ settings.json          # Persistencia del prompt/modelo/temperature
├─ templates/
│  ├─ base.html              # Layout + sidebar (System / Chatbot)
│  ├─ system.html            # Formulario de configuración
│  └─ chatbot.html           # Vista Transcript
├─ static/
│  ├─ css/style.css          # Estilos (sidebar + transcript)
│  └─ js/chat.js             # Lógica del chat (Copy/Download)
├─ requirements.txt
├─ .env.example
└─ README.md
```

Rutas principales:
- GET `/system` y POST `/system` para leer/guardar configuración.
- GET `/chatbot` para la UI de chat.
- GET `/api/settings` devuelve la configuración actual.
- POST `/api/chat` llama a OpenAI con:
  - `system_prompt` desde configuración (rol `system`).
  - Historial `user/assistant` y el último `user`.
  - Modelo y temperatura configurables.


## Código clave

- `app.py` (SDK OpenAI 1.x):
```python
from openai import OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
resp = client.chat.completions.create(
  model=model,
  messages=messages,
  temperature=temperature,
)
reply = resp.choices[0].message.content
```

- `static/js/chat.js`: construye el transcript, gestiona historial en memoria, copia y descarga del transcript.


## Personalización

- Cambiar estilos: `static/css/style.css`
- Modificar layout: `templates/base.html`
- Ajustar persistencia o defaults: `app.py` y `data/settings.json`


## Solución de problemas

- 401/403: revisa `OPENAI_API_KEY` en `.env` y que el modelo esté disponible.
- Timeout o errores de red: vuelve a intentar, y comprueba conectividad saliente.
- Cambios de modelo: si pruebas otro modelo, guárdalo en “System” y vuelve a “Chatbot”.


## Próximos pasos (opcional)

- Agregar soporte de audio/voz y “Download Audio”.
- Streaming de tokens (SSE) para respuestas en tiempo real.
- Guardar/recuperar múltiples conversaciones.
