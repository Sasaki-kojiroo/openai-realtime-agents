/**
 * Tools Module
 * Maneja la configuración de herramientas
 */

export async function init() {
  console.log('[Tools Module] Inicializando...');

  const container = document.getElementById('toolsModuleContent');
  
  try {
    // Cargar el HTML completo de tools desde el endpoint original
    const response = await fetch('/tools');
    if (!response.ok) {
      throw new Error('Error cargando herramientas');
    }
    
    const html = await response.text();
    
    // Extraer solo el contenido (sin el layout base)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const content = doc.querySelector('.page') || doc.querySelector('section') || doc.body;
    
    // Extraer también los estilos inline
    const styles = doc.querySelectorAll('style');
    
    // Inyectar contenido
    container.innerHTML = content.innerHTML;
    
    // Añadir los estilos al head si no existen ya
    styles.forEach(styleTag => {
      // Verificar si ya existe un estilo similar
      const existingStyles = Array.from(document.head.querySelectorAll('style'));
      const styleExists = existingStyles.some(existing => 
        existing.textContent.trim() === styleTag.textContent.trim()
      );
      
      if (!styleExists) {
        const newStyle = document.createElement('style');
        newStyle.textContent = styleTag.textContent;
        document.head.appendChild(newStyle);
      }
    });
    
    // Cargar tools-helper.js si no está cargado
    if (!window.toolsHelper) {
      const script = document.createElement('script');
      script.src = '/static/js/tools-helper.js';
      document.head.appendChild(script);
    }
    
    // Re-ejecutar los scripts inline del contenido
    const scripts = container.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      if (oldScript.src) {
        newScript.src = oldScript.src;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
    
    // Ejecutar scripts inline que NO están dentro de .page (por ej. los de templates/tools.html que definen editCustomTool/editSystemTool)
    try {
      const contentScripts = new Set(Array.from(content.querySelectorAll('script')));
      const docInlineScripts = Array.from(doc.querySelectorAll('script')).filter(s => !s.src && !contentScripts.has(s));
      docInlineScripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        newScript.textContent = oldScript.textContent;
        // Anclar en head para asegurar ámbito global (window)
        document.head.appendChild(newScript);
      });
    } catch (e) {
      console.warn('[Tools Module] No se pudieron inyectar scripts globales del documento:', e);
    }
    
    // Interceptar formularios para que funcionen en la SPA
    setTimeout(() => {
      // Manejar formularios de toggle
      const toggleForms = container.querySelectorAll('form[action*="/tools/toggle/"]');
      toggleForms.forEach(form => {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const response = await fetch(form.action, { method: 'POST' });
          if (response.ok) {
            // Recargar el módulo para mostrar cambios
            init();
          }
        });
      });
      
      // Manejar formularios de delete
      const deleteForms = container.querySelectorAll('form[action*="/tools/delete/"]');
      deleteForms.forEach(form => {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (confirm('¿Eliminar esta herramienta?')) {
            const response = await fetch(form.action, { method: 'POST' });
            if (response.ok) {
              // Recargar el módulo para mostrar cambios
              init();
            }
          }
        });
      });
      
      // Reemplazar el botón "Ir a Energy Ring" por "Abrir Asistente"
      const ringButtons = container.querySelectorAll('a[href*="ring"]');
      ringButtons.forEach(btn => {
        if (btn.textContent.includes('Energy Ring')) {
          btn.textContent = '🎯 Abrir Asistente';
          btn.href = '#';
          btn.onclick = (e) => {
            e.preventDefault();
            if (window.RingWidget && typeof window.RingWidget.open === 'function') {
              window.RingWidget.open();
            }
          };
        }
      });
      
      // Enlazar botones "Editar" para herramientas personalizadas (evitar onclick inline)
      const customEditBtns = container.querySelectorAll('button[onclick^="editCustomTool("]');
      customEditBtns.forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        const match = onclick.match(/editCustomTool\(['"]([^'"]+)['"]\)/);
        const toolId = match ? match[1] : null;
        // Evitar doble ejecución
        btn.removeAttribute('onclick');
        btn.addEventListener('click', async (e) => {
          e.preventDefault();
          if (toolId && typeof window.editCustomTool === 'function') {
            await window.editCustomTool(toolId);
          } else if (onclick) {
            // Fallback: ejecutar el handler inline si existe
            try { new Function(onclick).call(window); } catch (err) { console.error('Error ejecutando editCustomTool inline:', err); }
          } else {
            console.warn('No se pudo determinar el ID de la herramienta a editar');
          }
        });
      });

      // Enlazar botones "Editar" para herramientas del sistema
      const systemEditBtns = container.querySelectorAll('button[onclick^="editSystemTool("]');
      systemEditBtns.forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        // Evitar doble ejecución
        btn.removeAttribute('onclick');
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          if (typeof window.editSystemTool === 'function') {
            // Intentar extraer argumentos del inline
            const argsMatch = onclick.match(/editSystemTool\((.*)\)/);
            if (argsMatch) {
              try {
                // Los argumentos son strings; evaluamos como array
                const args = eval('[' + argsMatch[1] + ']');
                window.editSystemTool.apply(window, args);
                return;
              } catch (err) {
                console.warn('No se pudieron parsear los argumentos de editSystemTool:', err);
              }
            }
          }
          // Fallback: ejecutar el handler inline crudo si existe
          if (onclick) {
            try { new Function(onclick).call(window); } catch (err) { console.error('Error ejecutando editSystemTool inline:', err); }
          }
        });
      });
    }, 100);
    
    console.log('[Tools Module] Inicializado correctamente');
    
  } catch (error) {
    console.error('[Tools Module] Error:', error);
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 400px; color: #ef4444;">
        <div style="text-align: center;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 16px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <p>Error al cargar herramientas</p>
          <small style="color: #64748b;">${error.message}</small>
        </div>
      </div>
    `;
  }
}
