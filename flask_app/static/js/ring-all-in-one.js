/**
 * Ring Widget All-in-One
 * Widget embebible de voz con anillo de energía
 * Todo en un solo archivo: UI, estilos, animación y lógica
 * 
 * Uso:
 * <script>
 *   window.RingWidgetConfig = {
 *     serverUrl: "https://tu-servidor.com",
 *     settingsUrl: "https://tu-servidor.com/data/settings.json",  // opcional
 *     toolsUrl: "https://tu-servidor.com/data/tools.json",        // opcional
 *     position: "bottom-right",  // bottom-right | bottom-left
 *     theme: "dark",             // dark | light
 *     openOnLoad: false
 *   };
 * </script>
 * <script async src="https://tu-servidor.com/static/js/ring-all-in-one.js"></script>
 */

(() => {
  const cfg = window.RingWidgetConfig || {};

  // Detectar serverUrl desde el script si no se proporciona
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
    console.error("[RingWidget] serverUrl no detectado. Define window.RingWidgetConfig.serverUrl");
    return;
  }

  const position = (cfg.position === "bottom-left") ? "bottom-left" : "bottom-right";
  const theme = (cfg.theme === "light") ? "light" : "dark";
  const openOnLoad = !!cfg.openOnLoad;
  const settingsUrl = cfg.settingsUrl || `${serverUrl}/data/settings.json`;
  const toolsUrl = cfg.toolsUrl || `${serverUrl}/data/tools.json`;

  // Paletas de colores
  const themes = {
    dark: {
      bg: "#000000",
      bgGradient: "linear-gradient(135deg, #000000 0%, #0a0a0f 50%, #000000 100%)",
      text: "#e5e7eb",
      textDim: "rgba(203, 213, 225, 0.75)",
      primary: "#6366f1",
      primaryGlow: "rgba(99, 102, 241, 0.5)",
      surface: "rgba(9, 12, 20, 0.85)",
      border: "rgba(148, 163, 184, 0.12)",
      buttonBg: "linear-gradient(135deg, #6b48ff, #0ea5e9)",
      panelBg: "rgba(15, 23, 42, 0.95)",
      overlayBg: "rgba(2, 6, 23, 0.45)"
    },
    light: {
      bg: "#ffffff",
      bgGradient: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)",
      text: "#0f172a",
      textDim: "rgba(51, 65, 85, 0.75)",
      primary: "#3b82f6",
      primaryGlow: "rgba(59, 130, 246, 0.5)",
      surface: "rgba(255, 255, 255, 0.95)",
      border: "rgba(148, 163, 184, 0.3)",
      buttonBg: "linear-gradient(135deg, #3b82f6, #06b6d4)",
      panelBg: "rgba(255, 255, 255, 0.98)",
      overlayBg: "rgba(100, 116, 139, 0.3)"
    }
  };

  const colors = themes[theme];

  // Inyectar estilos del widget flotante
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
    border: 3px solid ${theme === "dark" ? "#fff" : "#3b82f6"};
    background: ${colors.buttonBg};
    box-shadow: 0 10px 24px rgba(0,0,0,0.25);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    transition: transform .2s ease, box-shadow .2s ease;
    position: relative;
  }
  
  .ringw-button::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }
  
  .ringw-button:hover {
    transform: translateY(-2px) scale(1.03);
    box-shadow: 0 14px 28px rgba(0,0,0,0.3);
  }
  
  .ringw-button:hover::before {
    opacity: 1;
  }
  
  .ringw-button svg {
    width: 32px;
    height: 32px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  }
  
  .ringw-panel {
    position: fixed;
    ${position === "bottom-right" ? "right: 24px;" : "left: 24px;"}
    bottom: 100px;
    width: 440px;
    height: 640px;
    border-radius: 18px;
    border: 1px solid ${colors.border};
    box-shadow: 0 24px 64px rgba(2, 6, 23, 0.55), inset 0 1px 0 rgba(255,255,255,0.04);
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    transform: translateY(16px) scale(0.98);
    transition: opacity .2s ease, transform .2s ease;
    background: transparent;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
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
    background: ${colors.bg};
  }
  
  .ringw-close {
    position: absolute;
    top: 10px;
    ${position === "bottom-right" ? "left: 10px;" : "right: 10px;"}
    background: ${theme === "dark" ? "radial-gradient(100% 100% at 50% 0%, rgba(255,255,255,0.08), rgba(255,255,255,0.02))" : "rgba(255,255,255,0.9)"};
    color: ${theme === "dark" ? "white" : "#0f172a"};
    border: 1px solid ${colors.border};
    border-radius: 12px;
    width: 32px;
    height: 32px;
    cursor: pointer;
    display: grid;
    place-items: center;
    box-shadow: 0 4px 12px rgba(2,6,23,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
    transition: all 0.2s ease;
  }
  
  .ringw-close:hover {
    transform: scale(1.1);
    box-shadow: 0 6px 16px rgba(2,6,23,0.6);
  }
  
  .ringw-close svg {
    width: 18px;
    height: 18px;
  }
  
  .ringw-overlay {
    position: fixed;
    inset: 0;
    background: transparent;
    opacity: 0;
    pointer-events: none;
    transition: opacity .2s ease;
    z-index: 999998;
  }
  
  .ringw-overlay.open {
    opacity: 0;
    pointer-events: none;
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

  // Crear contenedor raíz
  const root = document.createElement("div");
  root.className = "ringw-container";

  // Botón flotante
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ringw-button";
  btn.setAttribute("aria-label", "Abrir asistente de voz");
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <circle cx="12" cy="12" r="9"></circle>
      <circle cx="12" cy="12" r="5"></circle>
      <circle cx="12" cy="12" r="1"></circle>
    </svg>`;

  // Panel con iframe
  const panel = document.createElement("div");
  panel.className = "ringw-panel";

  // Botón de cerrar
  const close = document.createElement("button");
  close.type = "button";
  close.className = "ringw-close";
  close.setAttribute("aria-label", "Cerrar");
  close.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>`;

  // Crear iframe con srcdoc (todo el contenido embebido)
  const iframe = document.createElement("iframe");
  iframe.className = "ringw-iframe";
  iframe.setAttribute("allow", "microphone; autoplay; encrypted-media");
  iframe.setAttribute("referrerpolicy", "no-referrer");
  iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms");

  // HTML completo del iframe (todo embebido)
  const iframeHTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ring Widget</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; overflow: hidden; }
    body {
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background: ${colors.bgGradient};
      color: ${colors.text};
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    #ringCanvas {
      display: block;
      filter: drop-shadow(0 0 20px ${colors.primaryGlow});
    }
    
    #ringHint {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      color: ${colors.textDim};
      pointer-events: none;
      z-index: 10;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    #ringHint svg {
      color: ${colors.primary};
      animation: gentleFloat 2.5s ease-in-out infinite;
      margin-bottom: 20px;
      filter: drop-shadow(0 4px 12px ${colors.primaryGlow});
    }
    
    @keyframes gentleFloat {
      0%, 100% { 
        opacity: 1; 
        transform: translateY(0) scale(1);
      }
      50% { 
        opacity: 0.8; 
        transform: translateY(-6px) scale(1.05);
      }
    }
    
    #ringHint h2 {
      font-size: 26px;
      font-weight: 400;
      margin-bottom: 12px;
      background: linear-gradient(135deg, ${colors.text} 0%, ${colors.primary} 50%, ${colors.text} 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      background-size: 200% auto;
      animation: shimmer 3s linear infinite;
      letter-spacing: 0.5px;
    }
    
    @keyframes shimmer {
      0% { background-position: 0% center; }
      100% { background-position: 200% center; }
    }
    
    #ringHint p {
      font-size: 14px;
      opacity: 0.7;
      margin-bottom: 32px;
      animation: fadeInOut 2s ease-in-out infinite;
    }
    
    @keyframes fadeInOut {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 0.9; }
    }
    
    #ringHint .powered-by {
      font-size: 9px;
      opacity: 0.4;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 500;
    }
    
    #ringHint img {
      width: 80px;
      height: auto;
      opacity: 0.8;
      filter: ${theme === "dark" ? "brightness(1.2)" : "brightness(0.9)"};
    }
    
    #loadingIndicator {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      display: none;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      z-index: 10;
    }
    
    .loading-spinner {
      width: 48px;
      height: 48px;
      border: 4px solid ${colors.border};
      border-top-color: ${colors.primary};
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    #remoteAudio { display: none; }
    
    /* Contenedor de mensajes - sutil y elegante */
    #messagesContainer {
      position: absolute;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      width: 90%;
      max-width: 380px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      z-index: 5;
    }
    
    .message-item {
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 13px;
      line-height: 1.4;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      animation: slideUpFade 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      opacity: 0;
      animation-fill-mode: forwards;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    .message-item.removing {
      animation: slideOutFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    
    @keyframes slideUpFade {
      0% {
        opacity: 0;
        transform: translateY(30px) scale(0.95);
        filter: blur(4px);
      }
      50% {
        opacity: 0.5;
        filter: blur(2px);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: blur(0);
      }
    }
    
    @keyframes slideOutFade {
      0% {
        opacity: 1;
        transform: translateY(0) scale(1);
        filter: blur(0);
      }
      50% {
        opacity: 0.5;
        filter: blur(2px);
      }
      100% {
        opacity: 0;
        transform: translateY(-30px) scale(0.95);
        filter: blur(4px);
      }
    }
    
    .message-item.user {
      align-self: flex-end;
      background: ${theme === "dark" 
        ? "linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(139, 92, 246, 0.2))" 
        : "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(99, 102, 241, 0.25))"};
      border: 1px solid ${theme === "dark" ? "rgba(99, 102, 241, 0.3)" : "rgba(59, 130, 246, 0.4)"};
      color: ${theme === "dark" ? "rgba(224, 231, 255, 0.95)" : "rgba(30, 58, 138, 0.95)"};
      text-align: right;
    }
    
    .message-item.assistant {
      align-self: flex-start;
      background: ${theme === "dark"
        ? "linear-gradient(135deg, rgba(139, 92, 246, 0.25), rgba(168, 85, 247, 0.2))"
        : "linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(168, 85, 247, 0.25))"};
      border: 1px solid ${theme === "dark" ? "rgba(139, 92, 246, 0.3)" : "rgba(139, 92, 246, 0.4)"};
      color: ${theme === "dark" ? "rgba(233, 213, 255, 0.95)" : "rgba(76, 29, 149, 0.95)"};
    }
    
    .message-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.7;
      margin-bottom: 4px;
    }
    
    .message-text {
      font-weight: 400;
    }
  </style>
</head>
<body>
  <canvas id="ringCanvas"></canvas>
  
  <div id="messagesContainer"></div>
  
  <div id="ringHint">
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
      <path d="M2 17l10 5 10-5"></path>
      <path d="M2 12l10 5 10-5"></path>
    </svg>
    <h2>Asistente Virtual</h2>
    <p>Haz clic para iniciar</p>
    <div class="powered-by">Powered by</div>
    <img src="https://deoujisdvfuneuzqqdia.supabase.co/storage/v1/object/public/tddlogos/Asset%206Logo%20Blanco.png" alt="Logo" />
  </div>
  
  <div id="loadingIndicator">
    <div class="loading-spinner"></div>
    <p>Conectando...</p>
  </div>
  
  <audio id="remoteAudio" autoplay></audio>
  
  <script>
    const SERVER_URL = "${serverUrl}";
    const SETTINGS_URL = "${settingsUrl}";
    const TOOLS_URL = "${toolsUrl}";
    const THEME = "${theme}";
    
    // Variables globales
    let pc = null;
    let dc = null;
    let micStream = null;
    let audioContext = null;
    let micAnalyser = null;
    let micData = null;
    let remoteAnalyser = null;
    let remoteData = null;
    let connected = false;
    let connecting = false;
    let animationId = null;
    let time = 0;
    let micLevel = 0;
    let aiLevel = 0;
    let prevRadius = 0;
    let prevRingWidth = 0;
    let isAssistantSpeaking = false;
    let lastAssistantEventTs = 0;
    const speakingHoldMs = 1200;
    
    // Variables para auto-desconexión
    let lastActivityTime = 0;
    let inactivityCheckInterval = null;
    const INACTIVITY_TIMEOUT = ${cfg.autoDisconnectTimeout !== undefined ? cfg.autoDisconnectTimeout : 60000}; // Configurable, por defecto 60 segundos
    
    const canvas = document.getElementById("ringCanvas");
    const ctx = canvas.getContext("2d");
    const hint = document.getElementById("ringHint");
    const loadingIndicator = document.getElementById("loadingIndicator");
    const remoteAudio = document.getElementById("remoteAudio");
    const messagesContainer = document.getElementById("messagesContainer");
    
    // Variables para mensajes
    let currentUserTranscript = "";
    let currentAssistantTranscript = "";
    let messages = [];
    const MAX_MESSAGES = 2;
    
    // Función para resetear el timer de inactividad
    function resetInactivityTimer() {
      lastActivityTime = Date.now();
    }
    
    // Función para verificar inactividad
    function checkInactivity() {
      if (!connected || INACTIVITY_TIMEOUT === 0) return;
      
      const now = Date.now();
      const timeSinceActivity = now - lastActivityTime;
      
      // Si han pasado más del timeout sin actividad, desconectar suavemente
      if (timeSinceActivity >= INACTIVITY_TIMEOUT) {
        console.log('[Ring] Auto-desconexión por inactividad');
        smoothDisconnect();
      }
    }
    
    // Función para desconectar suavemente con fade
    function smoothDisconnect() {
      if (!connected) return;
      
      // Fade out de los mensajes primero
      const messageItems = messagesContainer.querySelectorAll('.message-item');
      messageItems.forEach((item, index) => {
        setTimeout(() => {
          item.classList.add('removing');
        }, index * 100);
      });
      
      // Luego cleanup después de que terminen las animaciones
      setTimeout(() => {
        cleanup();
      }, 600);
    }
    
    // Función para añadir mensaje con animaciones suaves
    function addMessage(role, text) {
      if (!text || !text.trim()) return;
      
      // Resetear timer de inactividad
      resetInactivityTimer();
      
      // Añadir nuevo mensaje al array
      messages.push({ role, text: text.trim() });
      
      // Si excedemos el máximo, remover el más antiguo con animación fade suave
      if (messages.length > MAX_MESSAGES) {
        const firstChild = messagesContainer.firstElementChild;
        if (firstChild) {
          firstChild.classList.add('removing');
          setTimeout(() => {
            messages.shift();
            renderMessages();
          }, 500);
        }
      } else {
        renderMessages();
      }
    }
    
    // Función para renderizar mensajes con stagger effect
    function renderMessages() {
      messagesContainer.innerHTML = '';
      messages.forEach((msg, index) => {
        const messageDiv = document.createElement('div');
        messageDiv.className = \`message-item \${msg.role}\`;
        messageDiv.style.animationDelay = \`\${index * 0.1}s\`;
        
        const labelDiv = document.createElement('div');
        labelDiv.className = 'message-label';
        labelDiv.textContent = msg.role === 'user' ? 'Tú' : 'AI';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = msg.text;
        
        messageDiv.appendChild(labelDiv);
        messageDiv.appendChild(textDiv);
        messagesContainer.appendChild(messageDiv);
      });
    }
    
    // Colores según tema
    const colors = THEME === "light" ? {
      hueA: 215,
      hueB: 200,
      colorA: "hsla(215, 95%, 60%, 0.95)",
      colorB: "hsla(200, 90%, 55%, 0.55)",
      glowColor: "hsla(210, 100%, 50%, 0.25)",
      speakingHueA: 265,
      speakingHueB: 190,
      speakingColorA: "hsla(265, 85%, 60%, 0.95)",
      speakingColorB: "hsla(190, 80%, 55%, 0.55)",
      speakingGlow: "hsla(270, 90%, 50%, 0.25)"
    } : {
      hueA: 215,
      hueB: 225,
      colorA: "hsla(215, 95%, 70%, 0.95)",
      colorB: "hsla(225, 90%, 65%, 0.55)",
      glowColor: "hsla(220, 100%, 60%, 0.25)",
      speakingHueA: 265,
      speakingHueB: 190,
      speakingColorA: "hsla(265, 95%, 70%, 0.95)",
      speakingColorB: "hsla(190, 90%, 65%, 0.55)",
      speakingGlow: "hsla(270, 100%, 60%, 0.25)"
    };
    
    function fitCanvas() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const size = Math.min(window.innerWidth, window.innerHeight) * 0.65;
      canvas.style.width = Math.floor(size) + "px";
      canvas.style.height = Math.floor(size) + "px";
      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    
    function computeLevel(analyser, buffer) {
      if (!analyser || !buffer) return 0;
      analyser.getByteTimeDomainData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) sum += Math.abs(buffer[i] - 128);
      return sum / buffer.length / 128;
    }
    
    // Resetear timer de inactividad en interacciones del usuario
    function setupInactivityResetListeners() {
      if (INACTIVITY_TIMEOUT === 0) return; // Desactivado
      
      document.body.addEventListener('keydown', resetInactivityTimer, { passive: true });
      document.body.addEventListener('pointermove', resetInactivityTimer, { passive: true });
      document.body.addEventListener('touchstart', resetInactivityTimer, { passive: true });
    }
    
    function draw() {
      const w = canvas.width / (window.devicePixelRatio || 1);
      const h = canvas.height / (window.devicePixelRatio || 1);
      ctx.clearRect(0, 0, w, h);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.miterLimit = 2;
      
      const rawMic = computeLevel(micAnalyser, micData);
      const rawAI = computeLevel(remoteAnalyser, remoteData);
      micLevel = micLevel * 0.85 + rawMic * 0.15;
      aiLevel = aiLevel * 0.85 + rawAI * 0.15;
      
      // Resetear timer si hay actividad de micrófono
      if (rawMic > 0.01 && INACTIVITY_TIMEOUT > 0) {
        resetInactivityTimer();
      }
      
      const now = performance.now();
      const speakingVisual = isAssistantSpeaking || aiLevel > 0.015 || (now - lastAssistantEventTs) < speakingHoldMs;
      
      const cx = w / 2;
      const cy = h / 2;
      const baseR = Math.min(w, h) * 0.28;
      const userPulse = Math.min(1.0, micLevel * 2.2);
      const aiPulse = Math.min(1.0, aiLevel * 2.0);
      
      time += speakingVisual ? 0.014 + aiPulse * 0.02 : 0.01 + userPulse * 0.01;
      
      let colorA, colorB, glowColor;
      if (speakingVisual) {
        colorA = colors.speakingColorA;
        colorB = colors.speakingColorB;
        glowColor = colors.speakingGlow;
      } else {
        colorA = colors.colorA;
        colorB = colors.colorB;
        glowColor = colors.glowColor;
      }
      
      const wobble = 6 + (speakingVisual ? aiPulse * 25 : userPulse * 10);
      const ringWidth = 10 + (speakingVisual ? 8 * (0.4 + aiPulse) : 6 * (0.3 + userPulse));
      const halo = 45 + (speakingVisual ? 50 * (0.4 + aiPulse) : 38 * (0.3 + userPulse));
      const radiusTarget = baseR + (speakingVisual ? aiPulse * 10 : userPulse * 16);
      
      if (prevRadius === 0) prevRadius = baseR;
      if (prevRingWidth === 0) prevRingWidth = ringWidth;
      prevRadius = prevRadius * 0.85 + radiusTarget * 0.15;
      prevRingWidth = prevRingWidth * 0.8 + ringWidth * 0.2;
      
      const offsetX = speakingVisual ? (Math.random() - 0.5) * aiPulse * 15 : 0;
      const offsetY = speakingVisual ? (Math.random() - 0.5) * aiPulse * 15 : 0;
      
      ctx.save();
      ctx.translate(cx + offsetX, cy + offsetY);
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = halo;
      ctx.shadowColor = glowColor;
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = prevRingWidth * 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, prevRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      
      try {
        ctx.save();
        ctx.translate(cx + offsetX, cy + offsetY);
        ctx.globalCompositeOperation = "lighter";
        const grad = ctx.createConicGradient(time * 0.2, 0, 0);
        grad.addColorStop(0, colorA);
        grad.addColorStop(0.5, colorB);
        grad.addColorStop(1, colorA);
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(2, prevRingWidth * 0.6);
        ctx.shadowBlur = halo * 0.25;
        ctx.shadowColor = glowColor;
        ctx.beginPath();
        ctx.arc(0, 0, prevRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } catch {}
      
      ctx.save();
      ctx.translate(cx + offsetX, cy + offsetY);
      ctx.globalCompositeOperation = "lighter";
      
      const layers = 4;
      for (let i = 0; i < layers; i++) {
        const t = time + i * 0.15;
        ctx.beginPath();
        ctx.lineWidth = prevRingWidth - i * 1.2;
        ctx.strokeStyle = i % 2 === 0 ? colorA : colorB;
        ctx.shadowBlur = halo * (i === 0 ? 0.7 : 0.35);
        ctx.shadowColor = i % 2 === 0 ? colorA : colorB;
        
        const steps = 420;
        for (let s = 0; s < steps; s++) {
          const a = (s / steps) * Math.PI * 2;
          const noise = Math.sin(a * (1.5 + i * 0.2) + t * (1 + i * 0.1)) * (wobble * 0.6) +
                       Math.sin(a * (3.3 + i * 0.3) - t * (0.5 + i * 0.05)) * (wobble * 0.25);
          const r = prevRadius + noise;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
      
      animationId = requestAnimationFrame(draw);
    }
    
    function wireDataChannel(channel) {
      dc = channel;
      dc.onmessage = async (e) => {
        try {
          const ev = JSON.parse(e.data);
          const t = ev.type || "";
          
          // Capturar transcripción del usuario
          if (t === "conversation.item.input_audio_transcription.completed") {
            const transcript = ev.transcript || "";
            if (transcript.trim()) {
              currentUserTranscript = transcript;
              addMessage('user', transcript);
            }
          }
          
          // Capturar transcripción del asistente (deltas)
          if (t === "response.audio_transcript.delta") {
            const delta = ev.delta || "";
            currentAssistantTranscript += delta;
            isAssistantSpeaking = true;
            lastAssistantEventTs = performance.now();
          }
          
          // Cuando el asistente termina de responder
          if (t === "response.audio_transcript.done") {
            if (currentAssistantTranscript.trim()) {
              addMessage('assistant', currentAssistantTranscript);
            }
            currentAssistantTranscript = "";
            lastAssistantEventTs = performance.now();
          }
          
          if (t === "response.audio.delta") {
            isAssistantSpeaking = true;
            lastAssistantEventTs = performance.now();
          }
          
          if (t === "response.audio.done" || t === "response.done") {
            lastAssistantEventTs = performance.now();
          }
          
          // Manejar function calls
          if (t === "response.function_call_arguments.done") {
            const callId = ev.call_id;
            const functionName = ev.name;
            const argsString = ev.arguments || "{}";
            
            try {
              const args = JSON.parse(argsString);
              const response = await fetch(SERVER_URL + "/api/execute_tool", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tool_name: functionName, arguments: args })
              });
              
              const result = await response.json();
              
              // Emitir evento de cambio de datos si es una operación CRUD exitosa
              if (response.ok && result.success) {
                const crudTools = {
                  'crearPersona': 'personas',
                  'modificarPersona': 'personas',
                  'borrarPersona': 'personas',
                  'crearGasto': 'gastos',
                  'modificarGasto': 'gastos',
                  'borrarGasto': 'gastos'
                };
                
                if (crudTools[functionName]) {
                  const collection = crudTools[functionName];
                  console.log(\`[Ring] Emitiendo evento data_changed para: \${collection}\`);
                  window.parent.postMessage({ 
                    type: "data_changed", 
                    collection: collection 
                  }, "*");
                }
              }
              
              if (result.success && result.system_action) {
                if (result.system_action === "disconnect") {
                  const output = JSON.stringify(result.result);
                  dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: { type: "function_call_output", call_id: callId, output: output }
                  }));
                  dc.send(JSON.stringify({ type: "response.create" }));
                  setTimeout(() => cleanup(), 2000);
                  return;
                }
                
                if (result.system_action === "open_url") {
                  window.parent.postMessage({ type: "open_url", url: result.url }, "*");
                  const output = JSON.stringify(result.result);
                  dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: { type: "function_call_output", call_id: callId, output: output }
                  }));
                  dc.send(JSON.stringify({ type: "response.create" }));
                  return;
                }
                
                if (result.system_action === "open_module") {
                  window.parent.postMessage({ type: "open_module", module: result.module }, "*");
                  const output = JSON.stringify(result.result);
                  dc.send(JSON.stringify({
                    type: "conversation.item.create",
                    item: { type: "function_call_output", call_id: callId, output: output }
                  }));
                  dc.send(JSON.stringify({ type: "response.create" }));
                  return;
                }
              }
              
              const output = result.success ? JSON.stringify(result.result) : JSON.stringify({ error: result.error || "Error" });
              dc.send(JSON.stringify({
                type: "conversation.item.create",
                item: { type: "function_call_output", call_id: callId, output: output }
              }));
              dc.send(JSON.stringify({ type: "response.create" }));
            } catch (error) {
              const errorOutput = JSON.stringify({ error: error.message || "Error desconocido" });
              dc.send(JSON.stringify({
                type: "conversation.item.create",
                item: { type: "function_call_output", call_id: callId, output: errorOutput }
              }));
              dc.send(JSON.stringify({ type: "response.create" }));
            }
          }
        } catch {}
      };
    }
    
    function cleanup() {
      // Detener interval de inactividad
      if (inactivityCheckInterval) {
        clearInterval(inactivityCheckInterval);
        inactivityCheckInterval = null;
      }
      
      if (animationId) cancelAnimationFrame(animationId);
      animationId = null;
      
      // Limpiar canvas para evitar frame residual
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      
      // Ocultar canvas en modo idle
      canvas.style.opacity = "0";
      
      try { dc?.close(); } catch {}
      dc = null;
      
      try {
        if (pc) {
          pc.ontrack = null;
          pc.onconnectionstatechange = null;
          pc.ondatachannel = null;
          pc.getSenders?.().forEach((s) => { try { s.track?.stop(); } catch {} });
          pc.close();
        }
      } catch {}
      pc = null;
      
      try { micStream?.getTracks()?.forEach((t) => t.stop()); } catch {}
      micStream = null;
      
      try { audioContext?.close(); } catch {}
      audioContext = null;
      micAnalyser = null;
      micData = null;
      remoteAnalyser = null;
      remoteData = null;
      
      connected = false;
      connecting = false;
      isAssistantSpeaking = false;
      micLevel = 0;
      aiLevel = 0;
      
      // Limpiar mensajes con fade out
      const messageItems = messagesContainer.querySelectorAll('.message-item');
      messageItems.forEach((item, index) => {
        setTimeout(() => {
          item.classList.add('removing');
        }, index * 100);
      });
      
      // Limpiar array de mensajes y mostrar hint después de las animaciones
      setTimeout(() => {
        currentUserTranscript = "";
        currentAssistantTranscript = "";
        messages = [];
        messagesContainer.innerHTML = "";
        
        // Mostrar hint inicial
        hint.style.display = "flex";
        loadingIndicator.style.display = "none";
      }, 600);
    }
    
    async function connect() {
      if (connected || connecting) return;
      
      connecting = true;
      hint.style.display = "none";
      loadingIndicator.style.display = "flex";
      
      try {
        // Leer configuración del servidor para obtener el modelo Realtime correcto
        let realtimeModel = "gpt-4o-realtime-preview-2024-12-17"; // Fallback
        try {
          const settingsRes = await fetch(SETTINGS_URL);
          if (settingsRes.ok) {
            const settings = await settingsRes.json();
            realtimeModel = settings.realtime_model || realtimeModel;
          }
        } catch (err) {
          console.warn('[Ring] No se pudo leer settings, usando modelo por defecto:', err);
        }
        
        const sres = await fetch(SERVER_URL + "/api/session");
        const sdata = await sres.json();
        if (!sres.ok || !sdata?.client_secret?.value) {
          throw new Error(sdata?.error || "No se pudo obtener sesión");
        }
        const ek = sdata.client_secret.value;
        
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          });
        } catch (err) {
          throw new Error("Acceso al micrófono denegado");
        }
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        micAnalyser = audioContext.createAnalyser();
        micAnalyser.fftSize = 1024;
        micData = new Uint8Array(micAnalyser.frequencyBinCount);
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(micAnalyser);
        
        pc = new RTCPeerConnection();
        
        try {
          const ch = pc.createDataChannel("oai-events");
          wireDataChannel(ch);
        } catch (err) {
          console.warn("Failed to create data channel:", err);
        }
        
        pc.ondatachannel = (ev) => {
          if (ev.channel) wireDataChannel(ev.channel);
        };
        
        for (const t of micStream.getAudioTracks()) pc.addTrack(t, micStream);
        pc.addTransceiver("audio", { direction: "sendrecv" });
        
        pc.ontrack = (event) => {
          const [stream] = event.streams;
          const streamToUse = stream || (remoteAudio.srcObject instanceof MediaStream
            ? remoteAudio.srcObject
            : new MediaStream());
          
          if (!stream && event.track) {
            streamToUse.addTrack(event.track);
          }
          remoteAudio.srcObject = streamToUse;
          
          try {
            if (audioContext && !remoteAnalyser) {
              remoteAnalyser = audioContext.createAnalyser();
              remoteAnalyser.fftSize = 1024;
              remoteData = new Uint8Array(remoteAnalyser.frequencyBinCount);
              const remoteSource = audioContext.createMediaStreamSource(streamToUse);
              remoteSource.connect(remoteAnalyser);
            }
          } catch (err) {
            console.warn("Failed to setup remote analyser:", err);
          }
        };
        
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "disconnected" || 
              pc.connectionState === "failed" || 
              pc.connectionState === "closed") {
            cleanup();
          }
        };
        
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        const answerResp = await fetch(
          \`https://api.openai.com/v1/realtime?model=\${encodeURIComponent(realtimeModel)}\`,
          {
            method: "POST",
            body: offer.sdp,
            headers: {
              Authorization: "Bearer " + ek,
              "Content-Type": "application/sdp",
              "OpenAI-Beta": "realtime=v1"
            }
          }
        );
        
        if (!answerResp.ok) {
          throw new Error("Conexión fallida: " + answerResp.status);
        }
        
        const answerSdp = await answerResp.text();
        await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
        
        connected = true;
        connecting = false;
        loadingIndicator.style.display = "none";
        
        // Mostrar canvas al conectar
        canvas.style.opacity = "1";
        
        // Iniciar timer de inactividad
        resetInactivityTimer();
        if (INACTIVITY_TIMEOUT > 0) {
          inactivityCheckInterval = setInterval(checkInactivity, 1000);
          setupInactivityResetListeners();
        }
        
        if (!animationId) {
          fitCanvas();
          animationId = requestAnimationFrame(draw);
        }
      } catch (err) {
        console.error("Connect error:", err);
        connecting = false;
        loadingIndicator.style.display = "none";
        hint.style.display = "flex";
        alert(err.message || "Error de conexión");
        cleanup();
      }
    }
    
    document.body.addEventListener("click", () => {
      if (!connected && !connecting) connect();
    });
    
    window.addEventListener("resize", fitCanvas);
    fitCanvas();
    
    // Iniciar con canvas oculto
    canvas.style.opacity = "0";
    
    try {
      remoteAudio?.addEventListener("playing", () => {
        isAssistantSpeaking = true;
        lastAssistantEventTs = performance.now();
        resetInactivityTimer();
      });
      remoteAudio?.addEventListener("ended", () => {
        isAssistantSpeaking = false;
      });
      remoteAudio?.addEventListener("pause", () => {
        lastAssistantEventTs = performance.now();
        setTimeout(() => {
          if (remoteAudio.paused) isAssistantSpeaking = false;
        }, speakingHoldMs);
      });
    } catch {}
    
    // Resetear timer cuando el usuario habla
    document.body.addEventListener("click", () => {
      if (connected) resetInactivityTimer();
    });
    
    // Escuchar mensaje del padre para desconectar suavemente cuando se cierra el widget
    window.addEventListener("message", (e) => {
      if (e.data && e.data.type === "widget_closing") {
        if (connected) {
          smoothDisconnect();
        }
      }
    });
  </script>
</body>
</html>`;

  iframe.srcdoc = iframeHTML;

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
    
    // Notificar al iframe para desconexión suave
    if (iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "widget_closing" }, "*");
    }
    
    // Cerrar el panel después de un delay para permitir la animación
    setTimeout(() => {
      panel.classList.remove("open");
      overlay.classList.remove("open");
    }, 700);
  });

  overlay.addEventListener("click", (e) => {
    e.preventDefault();
    panel.classList.remove("open");
    overlay.classList.remove("open");
  });

  // Escuchar mensajes del iframe para abrir URLs
  window.addEventListener("message", (e) => {
    if (e.data && e.data.type === "open_url" && e.data.url) {
      window.open(e.data.url, "_blank", "noopener,noreferrer");
    }
  });

  if (openOnLoad) {
    setTimeout(() => {
      panel.classList.add("open");
      overlay.classList.add("open");
    }, 400);
  }

  // Exponer API
  window.RingWidget = {
    open: () => {
      panel.classList.add("open");
      overlay.classList.add("open");
    },
    close: () => {
      panel.classList.remove("open");
      overlay.classList.remove("open");
    },
    toggle
  };
})();
