# 🎙️ Ring Widget All-in-One

Widget de voz embebible con anillo de energía animado. Todo en un solo archivo JavaScript con soporte para múltiples dominios, temas claro/oscuro y URLs configurables.

## ✨ Características

- **🎯 Todo en Uno**: Un solo archivo JS con UI, estilos, animación y lógica completa
- **🎨 Temas**: Modo claro y oscuro con toggle dinámico
- **🌐 Multi-dominio**: Funciona en cualquier sitio con CORS habilitado
- **⚙️ Configurable**: URLs personalizables para settings y tools
- **📱 Responsive**: Se adapta a móviles y tablets
- **🎭 Animación del Ring**: Mantiene la animación original del anillo de energía
- **🔊 Voz en Tiempo Real**: Integración con OpenAI Realtime API

## 📦 Instalación

### Opción 1: Instalación Básica

Agrega estos dos bloques de código al final del `<body>` de tu página HTML:

```html
<!-- Configuración -->
<script>
  window.RingWidgetConfig = {
    serverUrl: "https://tu-servidor.com",
    position: "bottom-right",  // bottom-right | bottom-left
    theme: "dark",             // dark | light
    openOnLoad: false
  };
</script>

<!-- Widget -->
<script async src="https://tu-servidor.com/static/js/ring-all-in-one.js"></script>
```

### Opción 2: Instalación Avanzada (con URLs personalizadas)

```html
<script>
  window.RingWidgetConfig = {
    serverUrl: "https://tu-servidor.com",
    settingsUrl: "https://tu-servidor.com/data/settings.json",  // opcional
    toolsUrl: "https://tu-servidor.com/data/tools.json",        // opcional
    position: "bottom-right",
    theme: "dark",
    openOnLoad: false
  };
</script>
<script async src="https://tu-servidor.com/static/js/ring-all-in-one.js"></script>
```

## ⚙️ Configuración

### Parámetros de `RingWidgetConfig`

| Parámetro | Tipo | Requerido | Default | Descripción |
|-----------|------|-----------|---------|-------------|
| `serverUrl` | string | ✅ Sí | - | URL del servidor Flask (sin `/` al final) |
| `settingsUrl` | string | ❌ No | `{serverUrl}/data/settings.json` | URL del archivo de configuración |
| `toolsUrl` | string | ❌ No | `{serverUrl}/data/tools.json` | URL del archivo de herramientas |
| `position` | string | ❌ No | `"bottom-right"` | Posición del botón: `"bottom-right"` o `"bottom-left"` |
| `theme` | string | ❌ No | `"dark"` | Tema visual: `"dark"` o `"light"` |
| `openOnLoad` | boolean | ❌ No | `false` | Abrir automáticamente al cargar la página |

### Ejemplo de Configuración Completa

```javascript
window.RingWidgetConfig = {
  serverUrl: "https://mi-servidor.com",
  settingsUrl: "https://mi-servidor.com/api/config",
  toolsUrl: "https://mi-servidor.com/api/tools",
  position: "bottom-left",
  theme: "light",
  openOnLoad: true
};
```

## 🎨 Temas

El widget soporta dos temas visuales:

### Tema Oscuro (Dark)
- Fondo negro con degradados sutiles
- Colores vibrantes para el anillo (azul/púrpura)
- Ideal para sitios con diseño oscuro

### Tema Claro (Light)
- Fondo blanco con degradados suaves
- Colores más suaves para el anillo
- Ideal para sitios con diseño claro

**Cambiar tema dinámicamente:**
- Usa el botón de sol/luna en la esquina superior del panel
- O recarga la página después de cambiar `window.RingWidgetConfig.theme`

## 🔌 API JavaScript

El widget expone una API global `window.RingWidget` con los siguientes métodos:

```javascript
// Abrir el widget
window.RingWidget.open();

// Cerrar el widget
window.RingWidget.close();

// Toggle (abrir/cerrar)
window.RingWidget.toggle();
```

### Ejemplo de Uso

```html
<button onclick="window.RingWidget.open()">
  Abrir Asistente
</button>

<button onclick="window.RingWidget.close()">
  Cerrar Asistente
</button>
```

## 🚀 Uso en Diferentes Escenarios

### Mismo Dominio

Si el widget está en el mismo dominio que tu sitio:

```html
<script>
  window.RingWidgetConfig = {
    serverUrl: window.location.origin,
    theme: "dark"
  };
</script>
<script async src="/static/js/ring-all-in-one.js"></script>
```

### Dominio Diferente (Cross-Origin)

Si el widget está en un dominio diferente, asegúrate de que el servidor tenga CORS habilitado:

```html
<script>
  window.RingWidgetConfig = {
    serverUrl: "https://widget-server.com",
    theme: "dark"
  };
</script>
<script async src="https://widget-server.com/static/js/ring-all-in-one.js"></script>
```

### Múltiples Páginas con Diferentes Configuraciones

```html
<!-- Página 1: Tema oscuro, esquina derecha -->
<script>
  window.RingWidgetConfig = {
    serverUrl: "https://tu-servidor.com",
    theme: "dark",
    position: "bottom-right"
  };
</script>
<script async src="https://tu-servidor.com/static/js/ring-all-in-one.js"></script>

<!-- Página 2: Tema claro, esquina izquierda -->
<script>
  window.RingWidgetConfig = {
    serverUrl: "https://tu-servidor.com",
    theme: "light",
    position: "bottom-left"
  };
</script>
<script async src="https://tu-servidor.com/static/js/ring-all-in-one.js"></script>
```

## 🔧 Configuración del Servidor

### Requisitos

1. **Flask con CORS habilitado** (ya incluido en `app.py`)
2. **OpenAI API Key** configurada en `.env`
3. **Archivos de configuración**:
   - `data/settings.json` - Configuración del asistente
   - `data/tools.json` - Herramientas disponibles

### Habilitar CORS (ya incluido)

El archivo `app.py` ya incluye CORS para permitir el uso del widget en múltiples dominios:

```python
from flask_cors import CORS

CORS(app, resources={
    r"/api/*": {"origins": "*"},
    r"/data/*": {"origins": "*"},
    r"/ring": {"origins": "*"}
})
```

### Estructura de `settings.json`

```json
{
  "system_prompt": "Eres un asistente útil...",
  "model": "gpt-4o-mini",
  "temperature": 0.6,
  "realtime_model": "gpt-4o-realtime-preview-2024-12-17",
  "voice": "verse"
}
```

### Estructura de `tools.json`

```json
{
  "tools": [
    {
      "id": "tool1",
      "name": "mi_herramienta",
      "description": "Descripción de la herramienta",
      "enabled": true,
      "endpoint": {
        "url": "https://api.example.com/endpoint",
        "method": "POST",
        "headers": {}
      },
      "parameters": {
        "type": "object",
        "properties": {},
        "required": []
      }
    }
  ],
  "system_tools": []
}
```

## 📱 Responsive Design

El widget se adapta automáticamente a diferentes tamaños de pantalla:

- **Desktop**: Panel de 440x640px con botón de 64x64px
- **Mobile**: Panel ocupa 85% del viewport con botón de 58x58px
- **Tablet**: Se adapta según el espacio disponible

## 🎯 Demo

Visita la página de demo para ver el widget en acción:

```
http://localhost:5050/demo-all-in-one
```

O la demo original:

```
http://localhost:5050/demo
```

## 🐛 Solución de Problemas

### El widget no aparece

1. Verifica que `serverUrl` esté correctamente configurado
2. Abre la consola del navegador para ver errores
3. Verifica que el archivo JS se esté cargando correctamente

### Error de CORS

Si ves errores de CORS en la consola:

1. Verifica que Flask-CORS esté instalado: `pip install Flask-CORS`
2. Verifica que CORS esté habilitado en `app.py`
3. Reinicia el servidor Flask

### El micrófono no funciona

1. Verifica que el navegador tenga permisos de micrófono
2. Usa HTTPS en producción (requerido para acceso al micrófono)
3. Verifica que `OPENAI_API_KEY` esté configurada

### El tema no cambia

1. El cambio de tema requiere recargar la página
2. Verifica que `window.RingWidgetConfig.theme` esté correctamente configurado

## 📄 Licencia

Este proyecto es parte de la aplicación Flask Realtime Agents.

## 🤝 Contribuciones

Para contribuir o reportar problemas, contacta al equipo de desarrollo.

## 📞 Soporte

Para soporte técnico o preguntas:
- Revisa la documentación en `/docs`
- Consulta los ejemplos en `/demo` y `/demo-all-in-one`
- Revisa los logs del servidor para errores

---

**Nota**: Este widget requiere una conexión activa al servidor Flask y una API Key válida de OpenAI para funcionar correctamente.
