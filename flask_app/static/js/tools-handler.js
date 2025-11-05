/**
 * Tools Handler - Intercepta y ejecuta las herramientas configuradas
 * Este módulo se encarga de:
 * 1. Interceptar cuando el AI quiere usar una herramienta
 * 2. Ejecutar la herramienta haciendo una llamada HTTP
 * 3. Devolver el resultado al AI
 */

class ToolsHandler {
  constructor() {
    this.tools = [];
    this.pendingCalls = new Map();
  }

  /**
   * Inicializa el handler cargando las herramientas disponibles
   */
  async initialize() {
    try {
      const response = await fetch('/api/tools');
      const data = await response.json();
      this.tools = data.tools || [];
      console.log('✅ Herramientas cargadas:', this.tools.length);
      return this.tools;
    } catch (error) {
      console.error('❌ Error cargando herramientas:', error);
      return [];
    }
  }

  /**
   * Verifica si una herramienta está disponible
   */
  hasTools() {
    return this.tools.length > 0;
  }

  /**
   * Obtiene la lista de herramientas en formato OpenAI
   */
  getTools() {
    return this.tools;
  }

  /**
   * Ejecuta una herramienta
   * @param {string} toolName - Nombre de la herramienta
   * @param {object} toolArgs - Argumentos para la herramienta
   * @returns {Promise<object>} - Resultado de la ejecución
   */
  async executeTool(toolName, toolArgs) {
    console.log(`🔧 Ejecutando herramienta: ${toolName}`, toolArgs);
    
    try {
      const response = await fetch('/api/execute_tool', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tool_name: toolName,
          arguments: toolArgs
        })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log(`✅ Herramienta ejecutada exitosamente:`, data.result);
        return {
          success: true,
          result: data.result
        };
      } else {
        console.error(`❌ Error ejecutando herramienta:`, data.error);
        return {
          success: false,
          error: data.error
        };
      }
    } catch (error) {
      console.error(`❌ Error en la llamada HTTP:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Maneja un function call del Realtime API
   * @param {object} functionCall - El objeto function_call del evento
   * @param {object} client - El cliente de Realtime API
   */
  async handleFunctionCall(functionCall, client) {
    const { call_id, name, arguments: argsString } = functionCall;
    
    console.log(`📞 Function call recibido:`, { call_id, name });
    
    // Parsear los argumentos
    let args = {};
    try {
      args = JSON.parse(argsString || '{}');
    } catch (error) {
      console.error('❌ Error parseando argumentos:', error);
    }

    // Ejecutar la herramienta
    const result = await this.executeTool(name, args);

    // Preparar la respuesta
    const output = result.success 
      ? JSON.stringify(result.result)
      : JSON.stringify({ error: result.error });

    // Enviar la respuesta al AI
    if (client && client.sendFunctionCallOutput) {
      client.sendFunctionCallOutput({
        call_id: call_id,
        output: output
      });
      console.log(`✅ Respuesta enviada al AI para call_id: ${call_id}`);
    } else {
      console.warn('⚠️ Cliente no disponible para enviar respuesta');
    }

    return result;
  }

  /**
   * Configura los event listeners para el Realtime API client
   * @param {object} client - El cliente de Realtime API
   */
  setupEventListeners(client) {
    if (!client) {
      console.warn('⚠️ Cliente no proporcionado para setupEventListeners');
      return;
    }

    // Escuchar eventos de function call
    client.on('conversation.item.created', (event) => {
      const item = event.item;
      
      // Si es un function call, manejarlo
      if (item.type === 'function_call') {
        this.handleFunctionCall(item, client);
      }
    });

    console.log('✅ Event listeners configurados para herramientas');
  }
}

/* Crear instancia global (evitar ReferenceError si no existe aún) */
window.toolsHandler = window.toolsHandler || new ToolsHandler();

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ToolsHandler;
}
