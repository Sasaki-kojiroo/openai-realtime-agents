(() => {
  // Simple embeddable Ring Widget (iframe-based)
  // Usage on any site:
  // <script>
  //   window.RingWidgetConfig = {
  //     serverUrl: "https://tu-dominio-flask.com",
  //     position: "bottom-right", // bottom-right | bottom-left
  //     buttonImage: "https://tu-cdn.com/avatar.png",
  //     theme: "dark",            // dark | light (futuro, por ahora UI interna del ring)
  //     openOnLoad: false
  //   };
  // </script>
  // <script async src="https://tu-dominio-flask.com/static/js/ring-widget.js"></script>

  const cfg = window.RingWidgetConfig || {};

  // Inferir serverUrl desde el propio script si no se proporcionó
  let inferredServerUrl = "";
  try {
    const thisScript = document.currentScript || (function() {
      const scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();
    if (thisScript && thisScript.src) {
      const u = new URL(thisScript.src, window.location.href);
      inferredServerUrl = u.origin;
    }
  } catch (e) {}

  const serverUrl = (cfg.serverUrl || inferredServerUrl || "").replace(/\/+$/, "");
  if (!serverUrl) {
    console.error("[RingWidget] serverUrl no detectado. Define window.RingWidgetConfig.serverUrl o sirve el script desde tu servidor.");
    return;
  }

  const position = (cfg.position === "bottom-left") ? "bottom-left" : "bottom-right";
  const buttonImage = cfg.buttonImage || (serverUrl + "/static/image/ring-avatar.png"); // opcional, no existe por defecto
  const openOnLoad = !!cfg.openOnLoad;

  // Crear estilos scoped
  const style = document.createElement("style");
  style.textContent = `
  .ringw-container {
    position: fixed;
    z-index: 999999;
    ${position === "bottom-right" ? "right: 24px;" : "left: 24px;"}
    bottom: 24px;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }
  .ringw-button {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    border: 3px solid #fff;
    background: linear-gradient(135deg, #6b48ff, #0ea5e9);
    box-shadow: 0 10px 24px rgba(0,0,0,0.25);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transition: transform .2s ease, box-shadow .2s ease;
  }
  .ringw-button:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 14px 28px rgba(0,0,0,0.3);
  }
  .ringw-button img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .ringw-panel {
    position: fixed;
    ${position === "bottom-right" ? "right: 24px;" : "left: 24px;"}
    bottom: 100px;
    width: 440px;
    height: 640px;
    border-radius: 18px;
    border: 1px solid rgba(148,163,184,0.15);
    box-shadow: 0 24px 64px rgba(2, 6, 23, 0.55), inset 0 1px 0 rgba(255,255,255,0.04);
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    transform: translateY(16px) scale(0.98);
    transition: opacity .2s ease, transform .2s ease;
    background: transparent;
    backdrop-filter: none;
  }
  .ringw-panel.open {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0) scale(1);
  }
  .ringw-iframe {
    width: 100%;
    height: 100%;
    border: 0;
    display: block;
  }
  .ringw-close {
    position: absolute;
    top: 10px;
    ${position === "bottom-right" ? "left: 10px;" : "right: 10px;"}
    background: radial-gradient(100% 100% at 50% 0%, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
    color: white;
    border: 1px solid rgba(148,163,184,0.18);
    border-radius: 12px;
    width: 32px;
    height: 32px;
    cursor: pointer;
    display: grid;
    place-items: center;
    box-shadow: 0 4px 12px rgba(2,6,23,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .ringw-close svg {
    width: 18px;
    height: 18px;
  }

  .ringw-overlay {
    position: fixed;
    inset: 0;
    background: rgba(2,6,23,0.45);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    opacity: 0;
    pointer-events: none;
    transition: opacity .2s ease;
    z-index: 999998;
  }
  .ringw-overlay.open {
    opacity: 1;
    pointer-events: auto;
  }
  @media (max-width: 520px) {
    .ringw-panel {
      ${position === "bottom-right" ? "right: 12px;" : "left: 12px;"}
      bottom: 96px;
      width: calc(100vw - 24px);
      height: 85vh;
      border-radius: 16px;
    }
    .ringw-button {
      width: 58px;
      height: 58px;
    }
  }`;
  document.head.appendChild(style);

  // Crear contenedor raíz (para no contaminar DOM del host)
  const root = document.createElement("div");
  root.className = "ringw-container";

  // Botón flotante
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ringw-button";
  if (buttonImage) {
    const img = document.createElement("img");
    img.alt = "Ring";
    img.src = buttonImage;
    btn.appendChild(img);
  } else {
    // Fallback: ícono sencillo
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="white" stroke-width="2">
        <circle cx="12" cy="12" r="9"></circle>
        <circle cx="12" cy="12" r="5"></circle>
        <circle cx="12" cy="12" r="1"></circle>
      </svg>`;
  }

  // Panel con iframe
  const panel = document.createElement("div");
  panel.className = "ringw-panel";

  const close = document.createElement("button");
  close.type = "button";
  close.className = "ringw-close";
  close.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <line x1="18" y1="6" x2="6" y2="18" stroke="white"></line>
      <line x1="6" y1="6" x2="18" y2="18" stroke="white"></line>
    </svg>
  `;

  const iframe = document.createElement("iframe");
  iframe.className = "ringw-iframe";
  // Pasamos ?embed=1 para que el servidor devuelva la UI sin sidebar
  const url = `${serverUrl}/ring?embed=1`;
  iframe.src = url;
  iframe.setAttribute("allow", "microphone; autoplay; encrypted-media");
  iframe.setAttribute("referrerpolicy", "no-referrer");

  // Ensamblar
  const overlay = document.createElement("div");
  overlay.className = "ringw-overlay";

  panel.appendChild(close);
  panel.appendChild(iframe);
  root.appendChild(btn);
  root.appendChild(panel);

  document.body.appendChild(overlay);
  document.body.appendChild(root);

  // Eventos
  const toggle = () => {
    const isOpen = panel.classList.contains("open");
    if (isOpen) {
      panel.classList.remove("open");
      overlay.classList.remove("open");
    } else {
      panel.classList.add("open");
      overlay.classList.add("open");
      // En algunos navegadores, para autoplay se requiere interacción del usuario (ya ocurrió con click)
      // El ring dentro del iframe manejará el resto.
    }
  };

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });

  close.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    panel.classList.remove("open");
    overlay.classList.remove("open");
  });

  // Cerrar al hacer click fuera (opcional)
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target)) {
      panel.classList.remove("open");
      overlay.classList.remove("open");
    }
  });

  // Cerrar al hacer click en el overlay
  overlay.addEventListener("click", (e) => {
    e.preventDefault();
    panel.classList.remove("open");
    overlay.classList.remove("open");
  });

  if (openOnLoad) {
    setTimeout(() => {
      panel.classList.add("open");
      overlay.classList.add("open");
    }, 400);
  }

  // Exponer una API mínima opcional
  window.RingWidget = {
    open: () => panel.classList.add("open"),
    close: () => panel.classList.remove("open"),
    toggle
  };
})();
