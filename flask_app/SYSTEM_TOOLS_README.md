# 🔧 Herramientas del Sistema - Documentación

## Descripción General

Las **herramientas del sistema** son herramientas especiales predefinidas que vienen integradas en la aplicación. A diferencia de las herramientas personalizadas que llaman a endpoints externos, estas herramientas ejecutan código directamente en el sistema (backend y frontend).

## Características Especiales

- ✅ **Código integrado**: La lógica está dentro del sistema
- ✅ **Predefinidas**: Vienen configuradas por defecto
- ✅ **Personalizables**: Solo puedes cambiar el nombre y la descripción
- ✅ **Siempre disponibles**: No se pueden eliminar (son parte del sistema)

## Herramientas Disponibles

### 1. 🔴 terminarLlamada

**Propósito**: Permite que el AI finalice la conexión WebRTC cuando detecta que la conversación ha terminado.

**Cuándo se usa**:
- Cuando el usuario se despide ("adiós", "hasta luego", "nos vemos")
- Cuando el usuario confirma que ya tiene toda la información que necesitaba
- Cuando la conversación ha llegado a su conclusión natural

**Cómo funciona**:
1. El AI detecta que la conversación debe terminar
2. Llama a la herramienta `terminarLlamada`
3. El backend responde con una acción del sistema: `disconnect`
4. El frontend (`ring.js`) intercepta esta acción
5. Espera 2 segundos para que el AI pueda despedirse
6. Ejecuta la función `disconnect()` que cierra la conexión WebRTC limpiamente

**Parámetros**: Ninguno

**Ejemplo de uso por el AI**:
```
Usuario: "Bueno, eso es todo. Muchas gracias, adiós."
AI: "¡De nada! Que tengas un excelente día. Hasta pronto."
[AI llama a terminarLlamada]
[Conexión se cierra automáticamente]
```

---

### 2. 🌐 abrirEnlace

**Propósito**: Permite que el AI abra URLs en una nueva ventana del navegador del usuario.

**Cuándo se usa**:
- Cuando el usuario pide abrir una página web específica
- Cuando el usuario solicita ver un enlace
- Cuando el AI necesita mostrar contenido web al usuario

**Cómo funciona**:
1. El AI detecta que el usuario quiere abrir una URL
2. Llama a la herramienta `abrirEnlace` con el parámetro `url`
3. El backend valida y normaliza la URL (agrega https:// si falta)
4. Responde con una acción del sistema: `open_url`
5. El frontend (`ring.js`) intercepta esta acción
6. Ejecuta `window.open(url, '_blank')` para abrir la URL en una nueva pestaña

**Parámetros**:
- `url` (string, requerido): La URL completa a abrir

**Ejemplo de uso por el AI**:
```
Usuario: "¿Me puedes abrir la página de CANACO?"
AI: "¡Claro! Te abro la página de CANACO ahora mismo."
[AI llama a abrirEnlace con url: "https://canaco.com"]
[Se abre nueva ventana con la página]
AI: "Listo, ya abrí la página en una nueva ventana."
```

---

## Estructura de Datos

Las herramientas del sistema se almacenan en `data/tools.json` bajo la clave `system_tools`:

```json
{
  "system_tools": [
    {
      "id": "system_disconnect",
      "name": "terminarLlamada",
      "description": "Usa esta herramienta cuando...",
      "enabled": true,
      "system": true,
      "type": "disconnect",
      "parameters": {...}
    },
    {
      "id": "system_open_url",
      "name": "abrirEnlace",
      "description": "Usa esta herramienta cuando...",
      "enabled": true,
      "system": true,
      "type": "open_url",
      "parameters": {...}
    }
  ],
  "tools": [
    // ... herramientas personalizadas
  ]
}
```

## Flujo de Ejecución

### Para terminarLlamada:

```
1. Usuario se despide
   ↓
2. AI detecta despedida → Llama a terminarLlamada
   ↓
3. Backend (/api/execute_tool) detecta herramienta del sistema
   ↓
4. Retorna: { success: true, system_action: "disconnect", result: {...} }
   ↓
5. ring.js intercepta la respuesta
   ↓
6. Envía confirmación al AI
   ↓
7. Espera 2 segundos
   ↓
8. Ejecuta disconnect() → Cierra conexión WebRTC
```

### Para abrirEnlace:

```
1. Usuario pide abrir URL
   ↓
2. AI extrae URL → Llama a abrirEnlace con parámetro url
   ↓
3. Backend valida y normaliza la URL
   ↓
4. Retorna: { success: true, system_action: "open_url", url: "...", result: {...} }
   ↓
5. ring.js intercepta la respuesta
   ↓
6. Ejecuta window.open(url, '_blank')
   ↓
7. Envía confirmación al AI
   ↓
8. AI confirma al usuario que se abrió la página
```

## Personalización

Puedes personalizar estas herramientas editando el archivo `data/tools.json`:

### Cambiar el nombre:
```json
{
  "name": "finalizarConversacion",  // Nuevo nombre
  "description": "...",
  ...
}
```

### Cambiar cuándo se usa (descripción):
```json
{
  "name": "terminarLlamada",
  "description": "Usa esta herramienta SOLO cuando el usuario diga explícitamente 'terminar' o 'colgar'",
  ...
}
```

### Deshabilitar temporalmente:
```json
{
  "enabled": false,  // La herramienta no estará disponible
  ...
}
```

⚠️ **IMPORTANTE**: No cambies los campos `id`, `system`, `type` o `parameters` ya que son necesarios para el funcionamiento interno.

## Agregar Nuevas Herramientas del Sistema

Si deseas agregar más herramientas del sistema en el futuro:

1. **Agrega la definición en `tools.json`**:
```json
{
  "id": "system_nueva_accion",
  "name": "nombreHerramienta",
  "description": "Descripción de cuándo usarla",
  "enabled": true,
  "system": true,
  "type": "nueva_accion",
  "parameters": {...}
}
```

2. **Agrega el manejo en `app.py`** (función `api_execute_tool`):
```python
elif tool_type == "nueva_accion":
    # Tu lógica aquí
    return jsonify({
        "success": True,
        "system_action": "nueva_accion",
        "result": {...}
    })
```

3. **Agrega el manejo en `ring.js`** (función `wireDataChannel`):
```javascript
if (result.system_action === "nueva_accion") {
  // Tu lógica aquí
  console.log("[ring] Nueva acción ejecutada");
  // ...
}
```

## Logs y Debugging

Para ver los logs de las herramientas del sistema:

1. **En el navegador** (Consola de desarrollador):
```
[ring] 🔧 Function call detectado: {...}
[ring] 🔧 Acción del sistema detectada: disconnect
[ring] 👋 Desconectando por solicitud del AI...
```

2. **En el servidor Flask**:
```
POST /api/execute_tool
Tool: terminarLlamada
System action: disconnect
```

## Seguridad

- ✅ Las URLs se validan y normalizan antes de abrirse
- ✅ Se usa `noopener,noreferrer` para prevenir ataques de tabnabbing
- ✅ Las herramientas del sistema no pueden ser eliminadas accidentalmente
- ✅ El código se ejecuta en un contexto controlado

## Soporte

Si tienes problemas con las herramientas del sistema:

1. Verifica que `enabled: true` en `tools.json`
2. Revisa los logs en la consola del navegador
3. Verifica que el servidor Flask esté corriendo
4. Asegúrate de que la descripción sea clara para que el AI sepa cuándo usarlas

---

**Última actualización**: Enero 2025
