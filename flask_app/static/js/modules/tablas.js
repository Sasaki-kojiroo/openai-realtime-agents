/**
 * Tablas Module
 * Maneja CRUD de Personas y Gastos con actualizaciones en tiempo real
 */

// Estado del módulo
let editingItem = null;
let editingType = null;

export async function init() {
  console.log('[Tablas Module] Inicializando...');
  
  // Cargar datos iniciales
  await loadPersonas();
  await loadGastos();
  
  console.log('[Tablas Module] Inicializado correctamente');
}

// ============================================================================
// PERSONAS - CRUD
// ============================================================================

async function loadPersonas() {
  try {
    const response = await fetch('/api/personas', { cache: 'no-store' });
    const data = await response.json();
    renderPersonas(data.items || []);
  } catch (error) {
    console.error('[Tablas] Error cargando personas:', error);
    document.getElementById('personasTableBody').innerHTML = `
      <tr>
        <td colspan="5" style="padding: 24px; text-align: center; color: #ef4444;">
          Error al cargar personas
        </td>
      </tr>
    `;
  }
}

function renderPersonas(personas) {
  const tbody = document.getElementById('personasTableBody');
  
  if (personas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 24px; text-align: center; color: #64748b;">
          No hay personas registradas
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = personas.map(persona => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px;"><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${persona.id}</code></td>
      <td style="padding: 12px;">${persona.nombre}</td>
      <td style="padding: 12px;">${persona.apellido}</td>
      <td style="padding: 12px;">${persona.telefono}</td>
      <td style="padding: 12px; text-align: center;">
        <button class="btn btn-sm btn-edit" onclick="tablasModule.editPersona('${persona.id}')">✏️ Editar</button>
        <button class="btn btn-sm btn-delete" onclick="tablasModule.deletePersona('${persona.id}')">🗑️ Borrar</button>
      </td>
    </tr>
  `).join('');
}

function showCreatePersonaForm() {
  document.getElementById('createPersonaForm').style.display = 'block';
  document.getElementById('personaForm').reset();
}

function hideCreatePersonaForm() {
  document.getElementById('createPersonaForm').style.display = 'none';
  document.getElementById('personaForm').reset();
}

async function createPersona(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  const data = {
    nombre: formData.get('nombre'),
    apellido: formData.get('apellido'),
    telefono: formData.get('telefono')
  };
  
  try {
    const response = await fetch('/api/personas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      hideCreatePersonaForm();
      // Recargar inmediatamente sin esperar
      loadPersonas();
      showNotification('✅ Persona creada exitosamente');
    } else {
      const error = await response.json();
      showNotification('❌ Error: ' + (error.error || 'Error desconocido'), 'error');
    }
  } catch (error) {
    console.error('[Tablas] Error creando persona:', error);
    showNotification('❌ Error al crear persona', 'error');
  }
}

async function editPersona(id) {
  try {
    const response = await fetch('/api/personas');
    const data = await response.json();
    const persona = data.items.find(p => p.id === id);
    
    if (!persona) {
      showNotification('❌ Persona no encontrada', 'error');
      return;
    }
    
    editingItem = persona;
    editingType = 'persona';
    
    document.getElementById('editModalTitle').textContent = 'Editar Persona';
    document.getElementById('editModalContent').innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="display: block; margin-bottom: 4px; font-weight: 600;">Nombre</label>
          <input type="text" id="editNombre" value="${persona.nombre}" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 4px; font-weight: 600;">Apellido</label>
          <input type="text" id="editApellido" value="${persona.apellido}" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 4px; font-weight: 600;">Teléfono</label>
          <input type="text" id="editTelefono" value="${persona.telefono}" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px;">
        </div>
      </div>
    `;
    
    document.getElementById('editModal').style.display = 'flex';
  } catch (error) {
    console.error('[Tablas] Error cargando persona:', error);
    showNotification('❌ Error al cargar persona', 'error');
  }
}

async function deletePersona(id) {
  if (!confirm('¿Estás seguro de que quieres borrar esta persona?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/personas/${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // Recargar inmediatamente sin esperar
      loadPersonas();
      showNotification('✅ Persona eliminada exitosamente');
    } else {
      const error = await response.json();
      showNotification('❌ Error: ' + (error.error || 'Error desconocido'), 'error');
    }
  } catch (error) {
    console.error('[Tablas] Error eliminando persona:', error);
    showNotification('❌ Error al eliminar persona', 'error');
  }
}

// ============================================================================
// GASTOS - CRUD
// ============================================================================

async function loadGastos() {
  try {
    const response = await fetch('/api/gastos', { cache: 'no-store' });
    const data = await response.json();
    renderGastos(data.items || []);
  } catch (error) {
    console.error('[Tablas] Error cargando gastos:', error);
    document.getElementById('gastosTableBody').innerHTML = `
      <tr>
        <td colspan="4" style="padding: 24px; text-align: center; color: #ef4444;">
          Error al cargar gastos
        </td>
      </tr>
    `;
  }
}

function renderGastos(gastos) {
  const tbody = document.getElementById('gastosTableBody');
  
  if (gastos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="padding: 24px; text-align: center; color: #64748b;">
          No hay gastos registrados
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = gastos.map(gasto => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px;"><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 12px;">${gasto.id}</code></td>
      <td style="padding: 12px;">${gasto.descripcion}</td>
      <td style="padding: 12px; text-align: right; font-weight: 600;">$${parseFloat(gasto.gasto).toFixed(2)}</td>
      <td style="padding: 12px; text-align: center;">
        <button class="btn btn-sm btn-edit" onclick="tablasModule.editGasto('${gasto.id}')">✏️ Editar</button>
        <button class="btn btn-sm btn-delete" onclick="tablasModule.deleteGasto('${gasto.id}')">🗑️ Borrar</button>
      </td>
    </tr>
  `).join('');
}

function showCreateGastoForm() {
  document.getElementById('createGastoForm').style.display = 'block';
  document.getElementById('gastoForm').reset();
}

function hideCreateGastoForm() {
  document.getElementById('createGastoForm').style.display = 'none';
  document.getElementById('gastoForm').reset();
}

async function createGasto(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  
  const data = {
    descripcion: formData.get('descripcion'),
    gasto: parseFloat(formData.get('gasto'))
  };
  
  try {
    const response = await fetch('/api/gastos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      hideCreateGastoForm();
      // Recargar inmediatamente sin esperar
      loadGastos();
      showNotification('✅ Gasto creado exitosamente');
    } else {
      const error = await response.json();
      showNotification('❌ Error: ' + (error.error || 'Error desconocido'), 'error');
    }
  } catch (error) {
    console.error('[Tablas] Error creando gasto:', error);
    showNotification('❌ Error al crear gasto', 'error');
  }
}

async function editGasto(id) {
  try {
    const response = await fetch('/api/gastos');
    const data = await response.json();
    const gasto = data.items.find(g => g.id === id);
    
    if (!gasto) {
      showNotification('❌ Gasto no encontrado', 'error');
      return;
    }
    
    editingItem = gasto;
    editingType = 'gasto';
    
    document.getElementById('editModalTitle').textContent = 'Editar Gasto';
    document.getElementById('editModalContent').innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        <div>
          <label style="display: block; margin-bottom: 4px; font-weight: 600;">Descripción</label>
          <input type="text" id="editDescripcion" value="${gasto.descripcion}" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 4px; font-weight: 600;">Gasto ($)</label>
          <input type="number" id="editGasto" value="${gasto.gasto}" step="0.01" style="width: 100%; padding: 8px; border: 1px solid #e2e8f0; border-radius: 4px;">
        </div>
      </div>
    `;
    
    document.getElementById('editModal').style.display = 'flex';
  } catch (error) {
    console.error('[Tablas] Error cargando gasto:', error);
    showNotification('❌ Error al cargar gasto', 'error');
  }
}

async function deleteGasto(id) {
  if (!confirm('¿Estás seguro de que quieres borrar este gasto?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/gastos/${id}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      // Recargar inmediatamente sin esperar
      loadGastos();
      showNotification('✅ Gasto eliminado exitosamente');
    } else {
      const error = await response.json();
      showNotification('❌ Error: ' + (error.error || 'Error desconocido'), 'error');
    }
  } catch (error) {
    console.error('[Tablas] Error eliminando gasto:', error);
    showNotification('❌ Error al eliminar gasto', 'error');
  }
}

// ============================================================================
// MODAL DE EDICIÓN
// ============================================================================

function closeEditModal() {
  document.getElementById('editModal').style.display = 'none';
  editingItem = null;
  editingType = null;
}

async function saveEdit() {
  if (!editingItem || !editingType) {
    return;
  }
  
  try {
    let data = {};
    let url = '';
    
    if (editingType === 'persona') {
      data = {
        nombre: document.getElementById('editNombre').value,
        apellido: document.getElementById('editApellido').value,
        telefono: document.getElementById('editTelefono').value
      };
      url = `/api/personas/${editingItem.id}`;
    } else if (editingType === 'gasto') {
      data = {
        descripcion: document.getElementById('editDescripcion').value,
        gasto: parseFloat(document.getElementById('editGasto').value)
      };
      url = `/api/gastos/${editingItem.id}`;
    }
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      // Guardar el tipo antes de cerrar el modal
      const type = editingType;
      closeEditModal();
      // Recargar inmediatamente sin esperar
      if (type === 'persona') {
        loadPersonas();
      } else {
        loadGastos();
      }
      showNotification('✅ Actualizado exitosamente');
    } else {
      const error = await response.json();
      showNotification('❌ Error: ' + (error.error || 'Error desconocido'), 'error');
    }
  } catch (error) {
    console.error('[Tablas] Error guardando cambios:', error);
    showNotification('❌ Error al guardar cambios', 'error');
  }
}

// ============================================================================
// UTILIDADES
// ============================================================================

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'error' ? '#fee2e2' : '#d1fae5'};
    color: ${type === 'error' ? '#991b1b' : '#065f46'};
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    z-index: 2000;
    font-weight: 600;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Agregar animaciones CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(400px);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(400px);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Función pública para refrescar datos desde eventos externos
function refresh(collection) {
  if (collection === 'personas') {
    loadPersonas();
  } else if (collection === 'gastos') {
    loadGastos();
  } else {
    // Si no se especifica, recargar ambas
    loadPersonas();
    loadGastos();
  }
}

// Exponer funciones globalmente para uso desde HTML
window.tablasModule = {
  showCreatePersonaForm,
  hideCreatePersonaForm,
  createPersona,
  editPersona,
  deletePersona,
  showCreateGastoForm,
  hideCreateGastoForm,
  createGasto,
  editGasto,
  deleteGasto,
  closeEditModal,
  saveEdit,
  refresh
};
