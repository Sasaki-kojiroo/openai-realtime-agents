/**
 * SPA Controller
 * Maneja la navegaciรณn interna, lazy loading de mรณdulos y comunicaciรณn con el widget
 */

(function() {
  'use strict';

  // Mรณdulos permitidos
  const ALLOWED_MODULES = ['system', 'tools', 'demo', 'tablas'];
  
  // Mรณdulo actual
  let currentModule = null;
  
  // Cache de mรณdulos cargados
  const moduleCache = new Map();

  /**
   * Carga un mรณdulo dinรกmicamente
   * @param {string} moduleName - Nombre del mรณdulo a cargar
   */
  async function openModule(moduleName) {
    // Validar mรณdulo
    if (!ALLOWED_MODULES.includes(moduleName)) {
      console.error(`[SPA] Mรณdulo no permitido: ${moduleName}`);
      return;
    }

    // Si ya estรก cargado, no hacer nada
    if (currentModule === moduleName) {
      console.log(`[SPA] Mรณdulo ${moduleName} ya estรก activo`);
      return;
    }

    console.log(`[SPA] Cargando mรณdulo: ${moduleName}`);

    try {
      const appContent = document.getElementById('app-content');
      
      // Mostrar indicador de carga
      appContent.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #64748b;">
          <div style="text-align: center;">
            <div style="width: 48px; height: 48px; border: 4px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
            <p>Cargando ${moduleName}...</p>
          </div>
        </div>
      `;

      // Fetch del HTML parcial
      const response = await fetch(`/modules/${moduleName}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Inyectar HTML
      appContent.innerHTML = html;

      // Cargar y ejecutar el mรณdulo JS si existe
      try {
        const moduleUrl = `/static/js/modules/${moduleName}.js`;
        
        // Verificar si ya estรก en cache
        let module;
        if (moduleCache.has(moduleName)) {
          module = moduleCache.get(moduleName);
        } else {
          // Dynamic import del mรณdulo
          module = await import(moduleUrl);
          moduleCache.set(moduleName, module);
        }

        // Ejecutar init() si existe
        if (module && typeof module.init === 'function') {
          console.log(`[SPA] Inicializando mรณdulo ${moduleName}`);
          module.init();
        }
      } catch (err) {
        // Si no hay mรณdulo JS, no pasa nada (algunos mรณdulos pueden no necesitarlo)
        console.log(`[SPA] No se encontrรณ mรณdulo JS para ${moduleName} (esto es normal si no lo necesita)`);
      }

      // Actualizar mรณdulo actual
      currentModule = moduleName;

      // Actualizar estado del sidebar
      updateSidebarState(moduleName);

      // Actualizar URL (History API)
      const newUrl = `${window.location.pathname}#${moduleName}`;
      window.history.pushState({ module: moduleName }, '', newUrl);

      console.log(`[SPA] Mรณdulo ${moduleName} cargado exitosamente`);

    } catch (error) {
      console.error(`[SPA] Error cargando mรณdulo ${moduleName}:`, error);
      
      const appContent = document.getElementById('app-content');
      appContent.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #ef4444;">
          <div style="text-align: center;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 16px;">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <p>Error al cargar el mรณdulo</p>
            <small style="color: #64748b;">${error.message}</small>
          </div>
        </div>
      `;
    }
  }

  /**
   * Actualiza el estado visual del sidebar
   * @param {string} moduleName - Nombre del mรณdulo activo
   */
  function updateSidebarState(moduleName) {
    // Remover clase active de todos los items
    document.querySelectorAll('.menu-item').forEach(item => {
      item.classList.remove('active');
    });

    // Agregar clase active al item correspondiente
    const activeItem = document.querySelector(`.menu-item[data-module="${moduleName}"]`);
    if (activeItem) {
      activeItem.classList.add('active');
    }
  }

  /**
   * Maneja la navegaciรณn hacia atrรกs/adelante del navegador
   */
  function handlePopState(event) {
    if (event.state && event.state.module) {
      openModule(event.state.module);
    } else {
      // Si no hay estado, cargar el mรณdulo por defecto desde el hash
      const hash = window.location.hash.slice(1);
      if (hash && ALLOWED_MODULES.includes(hash)) {
        openModule(hash);
      } else {
        openModule('system'); // Mรณdulo por defecto
      }
    }
  }

  /**
   * Inicializa el SPA
   */
  function init() {
    console.log('[SPA] Inicializando...');

    // Configurar event listeners para el sidebar
    document.querySelectorAll('.menu-item[data-module]').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const moduleName = item.getAttribute('data-module');
        openModule(moduleName);
      });
    });

    // Escuchar eventos de navegaciรณn del navegador
    window.addEventListener('popstate', handlePopState);

    // Escuchar mensajes del widget (para navegaciรณn desde el AI)
    window.addEventListener('message', (event) => {
      // Validar origen si es necesario
      // if (event.origin !== window.location.origin) return;

      if (event.data && event.data.type === 'open_module') {
        const moduleName = event.data.module;
        if (moduleName && ALLOWED_MODULES.includes(moduleName)) {
          console.log(`[SPA] Navegación solicitada por widget: ${moduleName}`);
          openModule(moduleName);
        }
      }
      
      // Escuchar eventos de cambio de datos desde el widget
      if (event.data && event.data.type === 'data_changed') {
        const collection = event.data.collection;
        console.log(`[SPA] Datos cambiados en colección: ${collection}`);
        
        // Si estamos en el módulo tablas, refrescar la colección afectada
        if (currentModule === 'tablas' && window.tablasModule && typeof window.tablasModule.refresh === 'function') {
          console.log(`[SPA] Refrescando tabla: ${collection}`);
          window.tablasModule.refresh(collection);
        }
      }
    });

    // Cargar mรณdulo inicial basado en hash o por defecto
    const hash = window.location.hash.slice(1);
    const initialModule = (hash && ALLOWED_MODULES.includes(hash)) ? hash : 'system';
    
    // Pequeรฑo delay para asegurar que el DOM estรฉ listo
    setTimeout(() => {
      openModule(initialModule);
    }, 100);

    console.log('[SPA] Inicializado correctamente');
  }

  // Exponer openModule globalmente para uso externo
  window.openModule = openModule;

  // Inicializar cuando el DOM estรฉ listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
