import os
import json
from pathlib import Path
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for, send_from_directory, make_response
from functools import wraps
from dotenv import load_dotenv
import requests

# Load environment variables from .env if present
load_dotenv()

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
TEMPLATES_DIR = BASE_DIR / "templates"
STATIC_DIR = BASE_DIR / "static"
SETTINGS_PATH = DATA_DIR / "settings.json"
TOOLS_PATH = DATA_DIR / "tools.json"
PERSONAS_PATH = DATA_DIR / "personas.json"
GASTOS_PATH = DATA_DIR / "gastos.json"

app = Flask(__name__, template_folder=str(TEMPLATES_DIR), static_folder=str(STATIC_DIR))

# Custom CORS decorator to allow cross-origin widget embedding
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

@app.after_request
def after_request(response):
    return add_cors_headers(response)

@app.route('/api/<path:path>', methods=['OPTIONS'])
@app.route('/data/<path:path>', methods=['OPTIONS'])
@app.route('/ring', methods=['OPTIONS'])
def handle_options(path=None):
    response = make_response('', 204)
    return add_cors_headers(response)

DEFAULT_SETTINGS = {
    "system_prompt": "Eres un asistente útil. Responde en español con claridad y precisión.",
    "model": "gpt-4o-mini",
    "temperature": 0.6,
    "realtime_model": "gpt-realtime-mini",
    "voice": "verse",
}


def ensure_dirs():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)
    (STATIC_DIR / "css").mkdir(parents=True, exist_ok=True)
    (STATIC_DIR / "js").mkdir(parents=True, exist_ok=True)


def read_settings():
    ensure_dirs()
    if not SETTINGS_PATH.exists():
        write_settings(DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS
    try:
        with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        # If the file is corrupted, reset to defaults
        write_settings(DEFAULT_SETTINGS)
        return DEFAULT_SETTINGS


def write_settings(settings: dict):
    ensure_dirs()
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)


def read_tools():
    ensure_dirs()
    if not TOOLS_PATH.exists():
        default_tools = {"tools": []}
        write_tools(default_tools)
        return default_tools
    try:
        with open(TOOLS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        default_tools = {"tools": []}
        write_tools(default_tools)
        return default_tools


def write_tools(tools_data: dict):
    ensure_dirs()
    with open(TOOLS_PATH, "w", encoding="utf-8") as f:
        json.dump(tools_data, f, ensure_ascii=False, indent=2)


def read_collection(filepath):
    """Lee una colección JSON (personas o gastos)"""
    ensure_dirs()
    if not filepath.exists():
        default_data = {"items": []}
        write_collection(filepath, default_data)
        return default_data
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        default_data = {"items": []}
        write_collection(filepath, default_data)
        return default_data


def write_collection(filepath, data: dict):
    """Escribe una colección JSON"""
    ensure_dirs()
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def gen_id():
    """Genera un ID único corto"""
    import uuid
    return str(uuid.uuid4())[:8]


@app.route("/")
def index():
    # Redirigir a la SPA
    return render_template("spa.html")


@app.get("/system")
def system_get():
    # Redirigir a la SPA con el módulo system
    return redirect("/#system")


@app.post("/system")
def system_post():
    form = request.form
    system_prompt = form.get("system_prompt", DEFAULT_SETTINGS["system_prompt"])
    model = form.get("model", DEFAULT_SETTINGS["model"]).strip()
    try:
        temperature = float(form.get("temperature", DEFAULT_SETTINGS["temperature"]))
    except Exception:
        temperature = DEFAULT_SETTINGS["temperature"]

    settings = {
        "system_prompt": system_prompt,
        "model": model or DEFAULT_SETTINGS["model"],
        "temperature": temperature,
        "realtime_model": (form.get("realtime_model", DEFAULT_SETTINGS["realtime_model"]).strip() or DEFAULT_SETTINGS["realtime_model"]),
        "voice": (form.get("voice", DEFAULT_SETTINGS["voice"]).strip() or DEFAULT_SETTINGS["voice"]),
    }
    write_settings(settings)
    return redirect(url_for("system_get"))


def replace_date_placeholders(text):
    """
    Reemplaza marcadores de fecha con la fecha y hora actual en español
    Soporta tanto {{FECHA_HOY}} como {{now}}
    """
    # Obtener fecha actual
    now = datetime.now()
    
    # Nombres de días y meses en español
    dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]
    meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", 
             "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
    
    # Formatear fecha: "Lunes, 3 de noviembre del 2025 02:25 PM"
    dia_semana = dias[now.weekday()]
    dia = now.day
    mes = meses[now.month - 1]
    año = now.year
    
    # Formatear hora con AM/PM
    hora_formateada = now.strftime("%I:%M %p")
    
    fecha_formateada = f"{dia_semana}, {dia} de {mes} del {año} {hora_formateada}"
    
    # Reemplazar ambos marcadores
    text = text.replace("{{FECHA_HOY}}", fecha_formateada)
    text = text.replace("{{now}}", fecha_formateada)
    
    return text


@app.get("/chatbot")
def chatbot():
    return render_template("chatbot.html")


@app.get("/ui")
def ui():
    return render_template("ui.html")

@app.get("/modules/<module_name>")
def get_module(module_name):
    """
    Devuelve el HTML parcial de un módulo para la SPA
    """
    # Lista blanca de módulos permitidos
    allowed_modules = ['system', 'tools', 'demo', 'tablas']
    
    if module_name not in allowed_modules:
        return jsonify({"error": "Module not found"}), 404
    
    try:
        return render_template(f"modules/{module_name}.html")
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.get("/demo")
def demo():
    # Redirigir a la SPA con el módulo demo
    return redirect("/#demo")

@app.get("/demo-all-in-one")
def demo_all_in_one():
    # Demo page for the all-in-one widget
    server_url = request.host_url.rstrip("/")
    return render_template("demo-all-in-one.html", server_url=server_url)


@app.route('/data/<path:filename>')
def serve_data_file(filename):
    return send_from_directory(DATA_DIR, filename)


@app.get("/tools")
def tools_get():
    tools_data = read_tools()
    return render_template(
        "tools.html", 
        tools=tools_data.get("tools", []),
        system_tools=tools_data.get("system_tools", [])
    )


@app.get("/tools/get/<tool_id>")
def tools_get_one(tool_id):
    tools_data = read_tools()
    tool = next((t for t in tools_data.get("tools", []) if t.get("id") == tool_id), None)
    if tool:
        return jsonify(tool)
    return jsonify({"error": "Tool not found"}), 404


@app.post("/tools/add")
def tools_add():
    form = request.form
    tools_data = read_tools()
    
    # Generate unique ID
    import uuid
    tool_id = str(uuid.uuid4())[:8]
    
    # Parse endpoint JSON
    try:
        endpoint = json.loads(form.get("endpoint", "{}"))
    except Exception:
        endpoint = {
            "url": "",
            "method": "GET",
            "headers": {}
        }
    
    # Parse parameters JSON
    try:
        parameters = json.loads(form.get("parameters", "{}"))
    except Exception:
        parameters = {"type": "object", "properties": {}, "required": [], "additionalProperties": False}
    
    new_tool = {
        "id": tool_id,
        "name": form.get("name", "").strip(),
        "description": form.get("description", "").strip(),
        "enabled": form.get("enabled") == "on",
        "endpoint": endpoint,
        "parameters": parameters
    }
    
    tools_data["tools"].append(new_tool)
    write_tools(tools_data)
    
    return redirect(url_for("tools_get"))


@app.post("/tools/edit/<tool_id>")
def tools_edit(tool_id):
    try:
        updated_tool_data = request.get_json()
        if not updated_tool_data:
            return jsonify({"error": "Invalid JSON"}), 400

        tools_data = read_tools()
        
        # Find and update the tool
        tool_found = False
        for i, tool in enumerate(tools_data.get("tools", [])):
            if tool.get("id") == tool_id:
                tools_data["tools"][i] = updated_tool_data
                tool_found = True
                break
        
        if not tool_found:
            return jsonify({"error": "Tool not found"}), 404
            
        write_tools(tools_data)
        return jsonify({"success": True, "message": "Tool updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/tools/delete/<tool_id>")
def tools_delete(tool_id):
    tools_data = read_tools()
    tools_data["tools"] = [t for t in tools_data["tools"] if t["id"] != tool_id]
    write_tools(tools_data)
    return redirect(url_for("tools_get"))


@app.post("/tools/toggle/<tool_id>")
def tools_toggle(tool_id):
    tools_data = read_tools()
    
    for tool in tools_data["tools"]:
        if tool["id"] == tool_id:
            tool["enabled"] = not tool.get("enabled", False)
            break
    
    write_tools(tools_data)
    return redirect(url_for("tools_get"))


@app.post("/tools/edit_system/<tool_id>")
def tools_edit_system(tool_id):
    """
    Edita una herramienta del sistema (solo nombre y descripción)
    """
    form = request.form
    tools_data = read_tools()
    
    # Buscar y actualizar la herramienta del sistema
    system_tools = tools_data.get("system_tools", [])
    for tool in system_tools:
        if tool["id"] == tool_id:
            # Solo permitir editar nombre y descripción
            tool["name"] = form.get("name", tool["name"]).strip()
            tool["description"] = form.get("description", tool["description"]).strip()
            break
    
    write_tools(tools_data)
    return redirect(url_for("tools_get"))


@app.post("/tools/parse_curl")
def tools_parse_curl():
    """
    Parsea un comando cURL y devuelve los datos estructurados
    """
    try:
        curl_command = request.get_json().get("curl_command", "")
        
        # Parsear el comando cURL
        parsed = parse_curl_command(curl_command)
        
        return jsonify(parsed)
    except Exception as e:
        return jsonify({"error": str(e)}), 400


def parse_curl_command(curl_command):
    """
    Parsea un comando cURL y extrae URL, método, headers y body
    """
    import re
    import shlex
    
    # Limpiar el comando
    curl_command = curl_command.strip()
    if curl_command.startswith("curl"):
        curl_command = curl_command[4:].strip()
    
    # Usar shlex para parsear correctamente los argumentos
    try:
        parts = shlex.split(curl_command)
    except:
        parts = curl_command.split()
    
    url = ""
    method = "GET"
    headers = {}
    body = ""
    
    i = 0
    while i < len(parts):
        part = parts[i]
        
        # URL (primer argumento sin flag o después de --url)
        if not part.startswith("-") and not url:
            url = part.strip("'\"")
        elif part in ["--url"]:
            i += 1
            if i < len(parts):
                url = parts[i].strip("'\"")
        
        # Método
        elif part in ["-X", "--request"]:
            i += 1
            if i < len(parts):
                method = parts[i].upper()
        
        # Headers
        elif part in ["-H", "--header"]:
            i += 1
            if i < len(parts):
                header = parts[i].strip("'\"")
                if ":" in header:
                    key, value = header.split(":", 1)
                    headers[key.strip()] = value.strip()
        
        # Body/Data
        elif part in ["-d", "--data", "--data-raw", "--data-binary"]:
            i += 1
            if i < len(parts):
                body = parts[i].strip("'\"")
        
        i += 1
    
    # Intentar parsear el body como JSON para extraer parámetros
    parameters = {
        "type": "object",
        "properties": {},
        "required": [],
        "additionalProperties": False
    }
    
    if body:
        try:
            import json as json_module
            body_json = json_module.loads(body)
            for key, value in body_json.items():
                param_type = "string"
                if isinstance(value, bool):
                    param_type = "boolean"
                elif isinstance(value, int):
                    param_type = "integer"
                elif isinstance(value, float):
                    param_type = "number"
                
                parameters["properties"][key] = {
                    "type": param_type,
                    "description": f"Parámetro {key}"
                }
                parameters["required"].append(key)
        except:
            pass
    
    return {
        "url": url,
        "method": method,
        "headers": headers,
        "parameters": parameters
    }


@app.post("/api/execute_tool")
def api_execute_tool():
    """
    Ejecuta una herramienta configurada
    Body JSON:
    {
      "tool_name": "nombreHerramienta",
      "arguments": {"param1": "value1", ...}
    }
    """
    try:
        data = request.get_json(silent=True) or {}
        tool_name = data.get("tool_name")
        arguments = data.get("arguments", {})
        
        if not tool_name:
            return jsonify({"error": "tool_name is required"}), 400
        
        # Buscar la herramienta (primero en system_tools, luego en tools)
        tools_data = read_tools()
        tool = None
        is_system_tool = False
        
        # Buscar en herramientas del sistema
        for t in tools_data.get("system_tools", []):
            if t["name"] == tool_name and t.get("enabled", False):
                tool = t
                is_system_tool = True
                break
        
        # Si no se encontró, buscar en herramientas personalizadas
        if not tool:
            for t in tools_data.get("tools", []):
                if t["name"] == tool_name and t.get("enabled", False):
                    tool = t
                    break
        
        if not tool:
            return jsonify({"error": f"Tool '{tool_name}' not found or disabled"}), 404
        
        # Manejar herramientas del sistema
        if is_system_tool:
            tool_type = tool.get("type")
            
            if tool_type == "disconnect":
                # La desconexión se maneja en el cliente
                return jsonify({
                    "success": True,
                    "system_action": "disconnect",
                    "result": {"message": "Desconectando llamada..."}
                })
            
            elif tool_type == "open_url":
                url = arguments.get("url", "").strip()
                if not url:
                    return jsonify({"error": "URL is required"}), 400
                
                # Validar que la URL tenga protocolo
                if not url.startswith(("http://", "https://")):
                    url = "https://" + url
                
                # La apertura de URL se maneja en el cliente
                return jsonify({
                    "success": True,
                    "system_action": "open_url",
                    "url": url,
                    "result": {"message": f"Abriendo {url}..."}
                })
            
            elif tool_type == "open_module":
                module = arguments.get("module", "").strip().lower()
                allowed_modules = ['system', 'tools', 'demo', 'tablas']
                
                if not module:
                    return jsonify({"error": "module is required"}), 400
                
                if module not in allowed_modules:
                    return jsonify({"error": f"Module '{module}' not found. Available: {', '.join(allowed_modules)}"}), 400
                
                # La navegación interna se maneja en el cliente
                return jsonify({
                    "success": True,
                    "system_action": "open_module",
                    "module": module,
                    "result": {"message": f"Abriendo módulo {module}..."}
                })
            
            else:
                return jsonify({"error": f"Unknown system tool type: {tool_type}"}), 400
        
        # Ejecutar herramienta personalizada
        endpoint = tool.get("endpoint", {})
        url = endpoint.get("url")
        method = endpoint.get("method", "GET").upper()
        headers = endpoint.get("headers", {})
        
        # Preparar la request
        if method == "GET":
            # Para GET, los argumentos van en query params
            response = requests.get(url, params=arguments, headers=headers, timeout=30)
        elif method == "POST":
            # Para POST, los argumentos van en el body
            response = requests.post(url, json=arguments, headers=headers, timeout=30)
        elif method == "PUT":
            response = requests.put(url, json=arguments, headers=headers, timeout=30)
        elif method == "DELETE":
            response = requests.delete(url, params=arguments, headers=headers, timeout=30)
        else:
            return jsonify({"error": f"Unsupported method: {method}"}), 400
        
        # Devolver la respuesta
        try:
            result = response.json()
        except:
            result = {"text": response.text}
        
        return jsonify({
            "success": True,
            "status_code": response.status_code,
            "result": result
        })
        
    except requests.RequestException as e:
        return jsonify({
            "success": False,
            "error": f"Request failed: {str(e)}"
        }), 500
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.get("/api/settings")
def api_settings():
    settings = read_settings()
    # Reemplazar marcadores de fecha en el system_prompt
    settings["system_prompt"] = replace_date_placeholders(settings["system_prompt"])
    return jsonify(settings)


@app.get("/api/tools")
def api_tools():
    """
    Devuelve las herramientas activas en el formato esperado por OpenAI Realtime API
    """
    tools_data = read_tools()
    active_tools = [
        {
            "type": "function",
            "name": tool["name"],
            "description": tool["description"],
            "parameters": tool["parameters"]
        }
        for tool in tools_data.get("tools", [])
        if tool.get("enabled", False)
    ]
    return jsonify({"tools": active_tools})


# ============================================================================
# API CRUD: Personas
# ============================================================================

@app.get("/api/personas")
def api_personas_list():
    """Lista todas las personas"""
    data = read_collection(PERSONAS_PATH)
    return jsonify(data)


@app.post("/api/personas")
def api_personas_create():
    """Crea una nueva persona"""
    try:
        body = request.get_json() or {}
        nombre = body.get("nombre", "").strip()
        apellido = body.get("apellido", "").strip()
        telefono = body.get("telefono", "").strip()
        
        if not nombre or not apellido or not telefono:
            return jsonify({"error": "nombre, apellido y telefono son requeridos"}), 400
        
        data = read_collection(PERSONAS_PATH)
        new_item = {
            "id": gen_id(),
            "nombre": nombre,
            "apellido": apellido,
            "telefono": telefono
        }
        data["items"].append(new_item)
        write_collection(PERSONAS_PATH, data)
        
        return jsonify({"created": new_item}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/personas/<item_id>", methods=["PUT"])
@app.route("/api/personas", methods=["PUT"])
def api_personas_update(item_id=None):
    """Actualiza una persona existente"""
    try:
        body = request.get_json() or {}
        # Obtener ID desde URL o desde body
        if not item_id:
            item_id = body.get("id")
        
        if not item_id:
            return jsonify({"error": "ID es requerido"}), 400
        
        data = read_collection(PERSONAS_PATH)
        
        item = next((p for p in data["items"] if p["id"] == item_id), None)
        if not item:
            return jsonify({"error": "Persona no encontrada"}), 404
        
        # Actualizar campos si se proporcionan
        if "nombre" in body:
            item["nombre"] = body["nombre"].strip()
        if "apellido" in body:
            item["apellido"] = body["apellido"].strip()
        if "telefono" in body:
            item["telefono"] = body["telefono"].strip()
        
        write_collection(PERSONAS_PATH, data)
        return jsonify({"updated": item})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/personas/<item_id>", methods=["DELETE"])
@app.route("/api/personas", methods=["DELETE"])
def api_personas_delete(item_id=None):
    """Elimina una persona"""
    try:
        # Obtener ID desde URL o desde query params o body
        if not item_id:
            item_id = request.args.get("id") or (request.get_json() or {}).get("id")
        
        if not item_id:
            return jsonify({"error": "ID es requerido"}), 400
        
        data = read_collection(PERSONAS_PATH)
        original_count = len(data["items"])
        data["items"] = [p for p in data["items"] if p["id"] != item_id]
        
        if len(data["items"]) == original_count:
            return jsonify({"error": "Persona no encontrada"}), 404
        
        write_collection(PERSONAS_PATH, data)
        return jsonify({"deleted": item_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================================
# API CRUD: Gastos
# ============================================================================

@app.get("/api/gastos")
def api_gastos_list():
    """Lista todos los gastos"""
    data = read_collection(GASTOS_PATH)
    return jsonify(data)


@app.post("/api/gastos")
def api_gastos_create():
    """Crea un nuevo gasto"""
    try:
        body = request.get_json() or {}
        descripcion = body.get("descripcion", "").strip()
        gasto = body.get("gasto")
        
        if not descripcion:
            return jsonify({"error": "descripcion es requerida"}), 400
        
        try:
            gasto = float(gasto)
        except (TypeError, ValueError):
            return jsonify({"error": "gasto debe ser un número válido"}), 400
        
        data = read_collection(GASTOS_PATH)
        new_item = {
            "id": gen_id(),
            "descripcion": descripcion,
            "gasto": gasto
        }
        data["items"].append(new_item)
        write_collection(GASTOS_PATH, data)
        
        return jsonify({"created": new_item}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/gastos/<item_id>", methods=["PUT"])
@app.route("/api/gastos", methods=["PUT"])
def api_gastos_update(item_id=None):
    """Actualiza un gasto existente"""
    try:
        body = request.get_json() or {}
        # Obtener ID desde URL o desde body
        if not item_id:
            item_id = body.get("id")
        
        if not item_id:
            return jsonify({"error": "ID es requerido"}), 400
        
        data = read_collection(GASTOS_PATH)
        
        item = next((g for g in data["items"] if g["id"] == item_id), None)
        if not item:
            return jsonify({"error": "Gasto no encontrado"}), 404
        
        # Actualizar campos si se proporcionan
        if "descripcion" in body:
            item["descripcion"] = body["descripcion"].strip()
        if "gasto" in body:
            try:
                item["gasto"] = float(body["gasto"])
            except (TypeError, ValueError):
                return jsonify({"error": "gasto debe ser un número válido"}), 400
        
        write_collection(GASTOS_PATH, data)
        return jsonify({"updated": item})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/gastos/<item_id>", methods=["DELETE"])
@app.route("/api/gastos", methods=["DELETE"])
def api_gastos_delete(item_id=None):
    """Elimina un gasto"""
    try:
        # Obtener ID desde URL o desde query params o body
        if not item_id:
            item_id = request.args.get("id") or (request.get_json() or {}).get("id")
        
        if not item_id:
            return jsonify({"error": "ID es requerido"}), 400
        
        data = read_collection(GASTOS_PATH)
        original_count = len(data["items"])
        data["items"] = [g for g in data["items"] if g["id"] != item_id]
        
        if len(data["items"]) == original_count:
            return jsonify({"error": "Gasto no encontrado"}), 404
        
        write_collection(GASTOS_PATH, data)
        return jsonify({"deleted": item_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.get("/api/session")
def api_session():
    """
    Crea una sesión efímera para conectar al Realtime API por WebRTC.
    Devuelve JSON con client_secret.value (token de corta duración).
    """
    settings = read_settings()
    tools_data = read_tools()
    
    model = settings.get("realtime_model", DEFAULT_SETTINGS["realtime_model"])
    voice = settings.get("voice", DEFAULT_SETTINGS["voice"])
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return jsonify({"error": "OPENAI_API_KEY is not set on the server"}), 500

    # Obtener herramientas del sistema activas
    system_tools = [
        {
            "type": "function",
            "name": tool["name"],
            "description": tool["description"],
            "parameters": tool["parameters"]
        }
        for tool in tools_data.get("system_tools", [])
        if tool.get("enabled", False)
    ]
    
    # Obtener herramientas personalizadas activas
    custom_tools = [
        {
            "type": "function",
            "name": tool["name"],
            "description": tool["description"],
            "parameters": tool["parameters"]
        }
        for tool in tools_data.get("tools", [])
        if tool.get("enabled", False)
    ]
    
    # Combinar todas las herramientas
    active_tools = system_tools + custom_tools

    # Reemplazar marcadores de fecha en el system_prompt
    system_prompt = replace_date_placeholders(settings.get("system_prompt", DEFAULT_SETTINGS["system_prompt"]))
    
    session_config = {
        "model": model,
        "voice": voice,
        "instructions": system_prompt,
        "turn_detection": {"type": "server_vad"},
        "modalities": ["audio", "text"],
        "input_audio_transcription": {"model": "gpt-4o-mini-transcribe"}
    }
    
    # Agregar herramientas solo si hay alguna activa
    if active_tools:
        session_config["tools"] = active_tools

    try:
        r = requests.post(
            "https://api.openai.com/v1/realtime/sessions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "OpenAI-Beta": "realtime=v1",
            },
            json=session_config,
            timeout=15,
        )
        r.raise_for_status()
        return jsonify(r.json())
    except requests.HTTPError as e:
        return jsonify({
            "error": f"OpenAI error: {e}",
            "details": getattr(e.response, "text", "")
        }), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.post("/api/chat")
def api_chat():
    """
    Body JSON:
    {
      "message": "texto del usuario",
      "history": [{"role": "user"|"assistant", "content": "..."}, ...]  // opcional
    }
    """
    try:
        data = request.get_json(silent=True) or {}
        message = (data.get("message") or "").strip()
        history = data.get("history") or []
        if not message:
            return jsonify({"error": "message is required"}), 400

        settings = read_settings()
        system_prompt = replace_date_placeholders(settings.get("system_prompt", DEFAULT_SETTINGS["system_prompt"]))
        model = settings.get("model", DEFAULT_SETTINGS["model"])
        temperature = settings.get("temperature", DEFAULT_SETTINGS["temperature"])

        # Compose messages for the Chat Completions API
        messages = [{"role": "system", "content": system_prompt}]
        # Only keep valid roles from history
        for m in history:
            role = m.get("role")
            content = m.get("content")
            if role in ("user", "assistant") and isinstance(content, str):
                messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": message})

        # Call OpenAI Chat Completions
        # SDK v1.x
        from openai import OpenAI

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
        )
        reply = resp.choices[0].message.content
        ts = datetime.utcnow().isoformat() + "Z"
        return jsonify({"reply": reply, "timestamp": ts})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Run on a non-default port to avoid clashes with other dev servers
    port = int(os.getenv("PORT", "5050"))
    ensure_dirs()
    app.run(host="0.0.0.0", port=port, debug=True)
