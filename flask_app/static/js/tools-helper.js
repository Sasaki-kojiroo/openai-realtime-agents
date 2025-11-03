/**
 * Helper para mostrar tooltips y ayuda en el formulario de herramientas
 */

// Mostrar ayuda contextual cuando el usuario importa un cURL
function showImportHelp() {
  const helpHTML = `
    <div class="import-help-box">
      <h4>✅ cURL Importado Correctamente</h4>
      <p><strong>Ahora solo necesitas:</strong></p>
      <ol>
        <li><strong>Nombre:</strong> Ej: <code>crearCliente</code> (sin espacios, camelCase)</li>
        <li><strong>Descripción:</strong> Cuándo el AI debe usarla
          <br><em>Ejemplo: "Usar cuando el usuario quiera crear un nuevo cliente"</em>
        </li>
      </ol>
      <p class="help-note">💡 <strong>Todo lo demás ya está configurado:</strong></p>
      <ul>
        <li>✓ URL del endpoint</li>
        <li>✓ Método HTTP (GET/POST/etc)</li>
        <li>✓ Headers (autenticación)</li>
        <li>✓ Parámetros que el AI debe pedir</li>
      </ul>
      <p class="help-action">👉 Solo completa nombre y descripción, luego haz clic en "Guardar"</p>
    </div>
  `;
  
  // Insertar la ayuda antes del formulario
  const step2Content = document.querySelector('#step2 .step-content');
  const existingHelp = step2Content.querySelector('.import-help-box');
  
  if (existingHelp) {
    existingHelp.remove();
  }
  
  const helpDiv = document.createElement('div');
  helpDiv.innerHTML = helpHTML;
  step2Content.insertBefore(helpDiv.firstElementChild, step2Content.firstElementChild);
}

// Validar que el nombre esté en camelCase
function validateToolName(name) {
  // Debe empezar con minúscula y no tener espacios
  const camelCaseRegex = /^[a-z][a-zA-Z0-9]*$/;
  return camelCaseRegex.test(name);
}

// Mostrar feedback visual en el campo de nombre
function setupNameValidation() {
  const nameInput = document.getElementById('toolName');
  if (!nameInput) return;
  
  nameInput.addEventListener('input', function() {
    const isValid = validateToolName(this.value);
    
    if (this.value.length > 0) {
      if (isValid) {
        this.style.borderColor = '#10b981';
        this.style.background = '#f0fdf4';
      } else {
        this.style.borderColor = '#ef4444';
        this.style.background = '#fef2f2';
      }
    } else {
      this.style.borderColor = '';
      this.style.background = '';
    }
  });
}

// Agregar ejemplos de descripción
function addDescriptionExamples() {
  const descInput = document.getElementById('toolDescription');
  if (!descInput) return;
  
  const examples = [
    'Usar cuando el usuario quiera crear un nuevo cliente',
    'Obtener información del sistema cuando se solicite',
    'Buscar clientes por nombre o email',
    'Enviar una notificación al usuario'
  ];
  
  let currentExample = 0;
  
  descInput.addEventListener('focus', function() {
    if (this.value === '') {
      this.placeholder = examples[currentExample];
      currentExample = (currentExample + 1) % examples.length;
    }
  });
}

// Inicializar helpers cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setupNameValidation();
    addDescriptionExamples();
  });
} else {
  setupNameValidation();
  addDescriptionExamples();
}

// Exportar funciones
window.toolsHelper = {
  showImportHelp,
  validateToolName,
  setupNameValidation,
  addDescriptionExamples
};
