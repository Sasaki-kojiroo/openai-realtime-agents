# 🛠️ Sistema de Herramientas para Realtime AI

Este sistema te permite configurar herramientas que el AI puede usar automáticamente durante las conversaciones en Energy Ring y otras interfaces.

## 🚀 Características

- ✅ **Importar desde cURL**: Pega un comando cURL y automáticamente extrae la configuración
- ✅ **Configuración simple**: Solo necesitas URL, método HTTP y descripción
- ✅ **Ejecución automática**: Las herramientas están disponibles inmediatamente
- ✅ **Soporte completo**: GET, POST, PUT, DELETE con headers personalizados
- ✅ **Ejemplos incluidos**: Plantillas predefinidas para casos comunes

## 📋 Cómo Usar

### 1. Acceder al Módulo de Herramientas

1. Abre la aplicación Flask
2. Ve al menú lateral y haz clic en **"Herramientas"**

### 2. Agregar una Herramienta

#### Opción A: Importar desde cURL (Recomendado)

1. Copia un comando cURL de tu API (por ejemplo, de Postman o documentación)
2. Pégalo en el campo **"Importar desde cURL"**
3. Haz clic en **"Importar cURL"**
4. Completa el nombre y descripción
5. Haz clic en **"Agregar herramienta"**

**Ejemplo de cURL:**
```bash
curl -X POST https://api.ejemplo.com/clientes \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer tu_token' \
  -d '{"nombre": "Juan", "email": "juan@ejemplo.com"}'
```

#### Opción B: Crear Manualmente

1. Completa el formulario:
   - **Nombre**: En camelCase (ej: `crearCliente`, `obtenerDatos`)
   - **Descripción**: Cuándo el AI debe usar esta herramienta
   - **URL**: Endpoint completo de tu API
   - **Método**: GET, POST, PUT o DELETE
   - **Headers**: JSON con headers necesarios (autenticación, etc.)
   - **Parámetros**: JSON Schema de los parámetros que el AI debe pedir

2. Haz clic en **"Agregar herramienta"**

#### Opción C: Usar Ejemplos Rápidos

1. Haz clic en uno de los ejemplos predefinidos
2. Modifica según tus necesidades
3. Haz clic en **"Agregar herramienta"**

### 3. Usar las Herramientas

Una vez configuradas, las herramientas están **automáticamente disponibles** en:
- 🎯 Energy Ring
- 💬 UI de voz
- 🤖 Chatbot

El AI las usará cuando sea apropiado según la descripción que proporcionaste.

## 📝 Ejemplos de Configuración

### Ejemplo 1: GET Simple (Obtener Información)

```json
{
  "name": "obtenerEstado",
  "description": "Obtiene el estado actual del sistema. Usar cuando el usuario pregunte por el estado.",
  "endpoint": {
    "url": "https://api.ejemplo.com/estado",
    "method": "GET",
    "headers": {}
  },
  "parameters": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

### Ejemplo 2: GET con Parámetros (Buscar)

```json
{
  "name": "buscarClientes",
  "description": "Busca clientes por nombre o email. Usar cuando el usuario quiera buscar clientes.",
  "endpoint": {
    "url": "https://api.ejemplo.com/clientes/buscar",
    "method": "GET",
    "headers": {}
  },
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Término de búsqueda"
      }
    },
    "required": ["query"]
  }
}
```

### Ejemplo 3: POST (Crear Registro)

```json
{
  "name": "crearCliente",
  "description": "Crea un nuevo cliente. Usar cuando el usuario quiera registrar un cliente.",
  "endpoint": {
    "url": "https://api.ejemplo.com/clientes",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer TU_TOKEN"
    }
  },
  "parameters": {
    "type": "object",
    "properties": {
      "nombre": {
        "type": "string",
        "description": "Nombre completo del cliente"
      },
      "email": {
        "type": "string",
        "description": "Email del cliente"
      }
    },
    "required": ["nombre", "email"]
  }
}
```

## 🔧 Gestión de Herramientas

### Activar/Desactivar

- Haz clic en el botón **"Activar"** o **"Desactivar"** en cada herramienta
- Las herramientas desactivadas no estarán disponibles para el AI

### Editar

1. Haz clic en **"Editar"** en la herramienta
2. Modifica los campos necesarios
3. Haz clic en **"Guardar cambios"**

### Eliminar

1. Haz clic en **"Eliminar"** en la herramienta
2. Confirma la eliminación

## 💡 Mejores Prácticas

### 1. Descripción Clara

✅ **Bueno**: "Crea un nuevo cliente en el sistema. Usar cuando el usuario quiera registrar o dar de alta un cliente."

❌ **Malo**: "Crea cliente"

### 2. Nombres Descriptivos

✅ **Bueno**: `crearCliente`, `buscarProductos`, `obtenerEstadistica`

❌ **Malo**: `crear`, `buscar`, `get`

### 3. Parámetros Bien Documentados

```json
{
  "nombre": {
    "type": "string",
    "description": "Nombre completo del cliente (requerido)"
  }
}
```

### 4. Seguridad

- ⚠️ **Nunca** expongas tokens o claves sensibles en el código
- ✅ Usa variables de entorno para tokens
- ✅ Implementa autenticación en tu API

## 🐛 Solución de Problemas

### La herramienta no se ejecuta

1. Verifica que esté **activada** (botón verde)
2. Revisa que la URL sea correcta y accesible
3. Verifica los headers de autenticación
4. Revisa la consola del navegador (F12) para ver errores

### El AI no usa la herramienta

1. Mejora la **descripción** para ser más específica
2. Asegúrate de que los **parámetros** estén bien definidos
3. Prueba con frases más directas al AI

### Error de CORS

Si ves errores de CORS, tu API necesita permitir requests desde el dominio de Flask:

```python
# En tu API
from flask_cors import CORS
CORS(app, origins=["http://localhost:5050"])
```

## 📚 Estructura de Archivos

```
flask_app/
├── data/
│   └── tools.json          # Herramientas configuradas
├── static/
│   └── js/
│       └── tools-handler.js # Manejador de herramientas
├── templates/
│   └── tools.html          # Interfaz de configuración
└── app.py                  # Backend con endpoints
```

## 🔗 Endpoints API

### GET `/api/tools`
Obtiene las herramientas activas en formato OpenAI

### POST `/api/execute_tool`
Ejecuta una herramienta configurada

**Body:**
```json
{
  "tool_name": "crearCliente",
  "arguments": {
    "nombre": "Juan",
    "email": "juan@ejemplo.com"
  }
}
```

### POST `/tools/parse_curl`
Parsea un comando cURL y extrae la configuración

**Body:**
```json
{
  "curl_command": "curl -X POST https://api.ejemplo.com/endpoint ..."
}
```

## 🎯 Casos de Uso

### 1. CRM - Gestión de Clientes

- `crearCliente`: Registrar nuevos clientes
- `buscarCliente`: Buscar clientes existentes
- `actualizarCliente`: Modificar información
- `obtenerEstadisticas`: Ver métricas

### 2. E-commerce

- `buscarProductos`: Buscar en catálogo
- `agregarAlCarrito`: Añadir productos
- `procesarPago`: Completar compra
- `rastrearPedido`: Ver estado del envío

### 3. Soporte Técnico

- `crearTicket`: Abrir nuevo ticket
- `consultarEstado`: Ver estado del ticket
- `agregarComentario`: Añadir información
- `cerrarTicket`: Resolver y cerrar

## 📞 Soporte

Si tienes problemas o preguntas:

1. Revisa la consola del navegador (F12)
2. Verifica los logs del servidor Flask
3. Consulta la documentación de tu API

---

**¡Listo!** Ahora puedes configurar herramientas y el AI las usará automáticamente. 🎉
