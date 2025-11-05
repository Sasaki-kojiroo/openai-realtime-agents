/**
 * System Module
 * Maneja la configuración del sistema
 */

export async function init() {
  console.log('[System Module] Inicializando...');

  // Cargar configuración actual
  try {
    const response = await fetch('/api/settings');
    const settings = await response.json();

    // Llenar formulario con datos actuales
    document.getElementById('system_prompt').value = settings.system_prompt || '';
    document.getElementById('model').value = settings.model || '';
    document.getElementById('temperature').value = settings.temperature || 0.6;
    document.getElementById('realtime_model').value = settings.realtime_model || '';
    document.getElementById('voice').value = settings.voice || '';

    // Actualizar vista previa inicial
    updatePreview();
  } catch (error) {
    console.error('[System Module] Error cargando configuración:', error);
  }

  // Configurar vista previa del prompt
  const textarea = document.getElementById('system_prompt');
  const preview = document.getElementById('preview');
  const previewText = document.getElementById('preview-text');

  function getCurrentDate() {
    const now = new Date();
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
      "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

    const diaSemana = dias[now.getDay()];
    const dia = now.getDate();
    const mes = meses[now.getMonth()];
    const año = now.getFullYear();

    const horaFormateada = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    return `${diaSemana}, ${dia} de ${mes} del ${año} ${horaFormateada}`;
  }

  function updatePreview() {
    const text = textarea.value;

    if (text.includes('{{now}}')) {
      const currentDate = getCurrentDate();
      const previewContent = text.replace(/\{\{now\}\}/g,
        `<span style="background: #e6f3ff; padding: 2px 4px; border-radius: 3px; color: #0066cc; font-weight: bold;">${currentDate}</span>`
      );

      previewText.innerHTML = previewContent;
      preview.style.display = 'block';
    } else {
      preview.style.display = 'none';
    }
  }

  textarea.addEventListener('input', updatePreview);

  // Manejar envío del formulario
  const form = document.getElementById('systemForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);

    try {
      const response = await fetch('/system', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        // Mostrar mensaje de éxito
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = '✓ Guardado';
        submitBtn.style.background = '#10b981';

        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.style.background = '';
        }, 2000);
      } else {
        alert('Error al guardar la configuración');
      }
    } catch (error) {
      console.error('[System Module] Error guardando:', error);
      alert('Error al guardar la configuración');
    }
  });

  console.log('[System Module] Inicializado correctamente');
}
