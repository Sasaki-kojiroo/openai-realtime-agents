/**
 * Demo Module
 * Maneja la página de demostración del widget
 */

export function init() {
  console.log('[Demo Module] Inicializando...');

  // Obtener URL del servidor
  const serverUrl = window.location.origin;

  // Generar código de integración
  const integrationCode = `<script>
  window.RingWidgetConfig = {
    serverUrl: "${serverUrl}",
    position: "bottom-right",  // o "bottom-left"
    theme: "dark",             // o "light"
    openOnLoad: false
  };
</script>
<script async src="${serverUrl}/static/js/ring-all-in-one.js"></script>`;

  // Mostrar código de integración
  const codeContainer = document.getElementById('integrationCode');
  if (codeContainer) {
    codeContainer.textContent = integrationCode;
  }

  // Función para abrir el widget
  window.openWidget = function() {
    if (window.RingWidget && typeof window.RingWidget.open === 'function') {
      window.RingWidget.open();
    } else {
      console.error('[Demo Module] Widget no disponible');
      alert('El widget no está disponible. Asegúrate de que ring-all-in-one.js esté cargado.');
    }
  };

  // Función para copiar código de integración
  window.copyIntegrationCode = async function() {
    try {
      await navigator.clipboard.writeText(integrationCode);
      
      // Feedback visual
      const btn = event.target;
      const originalText = btn.textContent;
      btn.textContent = '✓ Copiado';
      btn.style.background = '#10b981';
      btn.style.color = 'white';

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.color = '';
      }, 2000);
    } catch (err) {
      console.error('[Demo Module] Error copiando:', err);
      alert('No se pudo copiar el código. Por favor, cópialo manualmente.');
    }
  };

  console.log('[Demo Module] Inicializado correctamente');
}
