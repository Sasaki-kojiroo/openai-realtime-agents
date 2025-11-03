/* Enhanced Energy Ring UI with improved UX and controls
   - Visual status indicators and error messages
   - Mute/unmute functionality
   - Better state management
   - Improved accessibility
*/
(() => {
  // DOM Elements
  const stage = document.getElementById("ringStage");
  const canvas = document.getElementById("ringCanvas");
  const ringInfo = document.getElementById("ringInfo");
  const hint = document.getElementById("ringHint");
  const loadingIndicator = document.getElementById("loadingIndicator");
  const activeInfo = document.getElementById("activeInfo");
  const remoteAudio = document.getElementById("ringRemoteAudio");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const errorMessage = document.getElementById("errorMessage");
  const controlBar = document.getElementById("controlBar");
  const muteBtn = document.getElementById("muteBtn");
  const disconnectBtn = document.getElementById("disconnectBtn");
  const micIcon = document.getElementById("micIcon");
  const micOffIcon = document.getElementById("micOffIcon");
  const micStatus = document.getElementById("micStatus");
  const assistantStatus = document.getElementById("assistantStatus");
  const micStatusItem = micStatus ? micStatus.closest(".info-item") : null;
  const ctx = canvas.getContext("2d");

  // WebRTC/Audio
  let pc = null;
  let dc = null;
  let micStream = null;
  let audioContext = null;
  let micAnalyser = null;
  let micData = null;
  let remoteAnalyser = null;
  let remoteData = null;

  // State
  let connected = false;
  let connecting = false;
  let isMuted = false;
  let isAssistantSpeaking = false;
  let animationId = null;
  let time = 0;
  // Hold y suavizado visual de "speaking"
  let lastAssistantEventTs = 0;
  const speakingHoldMs = 1200;
  let prevRadius = 0;
  let prevRingWidth = 0;

  // Smoothed levels
  let micLevel = 0;
  let aiLevel = 0;

  // UI State Management
  function updateStatus(status, message = "") {
    const states = {
      disconnected: { color: "#64748b", text: "Desconectado" },
      connecting: { color: "#f59e0b", text: "Conectando..." },
      connected: { color: "#10b981", text: "Conectado" },
      error: { color: "#ef4444", text: "Error" }
    };

    const state = states[status] || states.disconnected;
    statusDot.style.backgroundColor = state.color;
    statusText.textContent = state.text;
    statusText.style.color = state.color;

    if (message) {
      showError(message);
    } else {
      hideError();
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = "block";
    setTimeout(() => hideError(), 8000); // Auto-hide after 8 seconds
  }

  function hideError() {
    errorMessage.style.display = "none";
    errorMessage.textContent = "";
  }

  function showLoading() {
    if (ringInfo) ringInfo.style.display = "flex";
    hint.style.display = "none";
    loadingIndicator.style.display = "flex";
    activeInfo.style.display = "none";
  }

  function showActive() {
    if (ringInfo) ringInfo.style.display = "flex";
    hint.style.display = "none";
    loadingIndicator.style.display = "none";
    activeInfo.style.display = "flex";
    controlBar.style.display = "flex";
  }

  function showHint() {
    hint.style.display = "flex";
    loadingIndicator.style.display = "none";
    activeInfo.style.display = "none";
    controlBar.style.display = "none";
  }

  function updateAssistantStatus(speaking) {
    isAssistantSpeaking = !!speaking;
    if (speaking) {
      lastAssistantEventTs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    }
    if (assistantStatus) assistantStatus.style.display = speaking ? "flex" : "none";
    if (micStatusItem) micStatusItem.style.display = speaking ? "none" : "flex";
  }

  function updateMuteUI() {
    if (isMuted) {
      micIcon.style.display = "none";
      micOffIcon.style.display = "block";
      muteBtn.classList.add("muted");
      if (micStatus) micStatus.textContent = "Micrófono silenciado";
    } else {
      micIcon.style.display = "block";
      micOffIcon.style.display = "none";
      muteBtn.classList.remove("muted");
      if (micStatus) micStatus.textContent = "Escuchando...";
    }
    // Mientras habla el asistente, ocultar el bloque de "Listening…"
    if (micStatusItem) {
      micStatusItem.style.display = isAssistantSpeaking ? "none" : "flex";
    }
  }

  // Resize canvas to device pixel ratio
  function fitCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const containerWidth = stage.clientWidth;
    const containerHeight = stage.clientHeight;
    const size = Math.min(containerWidth, containerHeight) * 0.65;
    
    canvas.style.width = `${Math.floor(size)}px`;
    canvas.style.height = `${Math.floor(size)}px`;
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Helpers
  async function getSettings() {
    try {
      const r = await fetch("/api/settings");
      return r.ok ? r.json() : {};
    } catch (err) {
      console.error("[ring] Failed to fetch settings:", err);
      return {};
    }
  }

  function cleanup() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;

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

    try {
      micStream?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    micStream = null;

    try { audioContext?.close(); } catch {}
    audioContext = null;
    micAnalyser = null;
    micData = null;
    remoteAnalyser = null;
    remoteData = null;

    connected = false;
    connecting = false;
    isMuted = false;
    isAssistantSpeaking = false;
    micLevel = 0;
    aiLevel = 0;
    
    if (ringInfo) ringInfo.style.display = "flex";
    updateStatus("disconnected");
    showHint();
  }

  function computeLevel(analyser, buffer) {
    if (!analyser || !buffer) return 0;
    analyser.getByteTimeDomainData(buffer);
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += Math.abs(buffer[i] - 128);
    return sum / buffer.length / 128;
  }

  // Draw animated energy ring
  function draw() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    ctx.clearRect(0, 0, w, h);
    // Mejora de calidad de trazo
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.miterLimit = 2;

    // Levels (EMA smoothing)
    const rawMic = isMuted ? 0 : computeLevel(micAnalyser, micData);
    const rawAI = computeLevel(remoteAnalyser, remoteData);
    micLevel = micLevel * 0.85 + rawMic * 0.15;
    aiLevel = aiLevel * 0.85 + rawAI * 0.15;

    const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
    const speakingVisual = isAssistantSpeaking || aiLevel > 0.015 || (now - lastAssistantEventTs) < speakingHoldMs;

    const cx = w / 2;
    const cy = h / 2;
    const baseR = Math.min(w, h) * 0.28;
    const userPulse = Math.min(1.0, micLevel * 2.2);
    const aiPulse = Math.min(1.0, aiLevel * 2.0);

    // Animation time
    time += speakingVisual ? 0.014 + aiPulse * 0.02 : 0.01 + userPulse * 0.01;

    // Color selection (assistant speaking -> purple/cyan, muted -> gray, else blue)
    let hueA, hueB, colorA, colorB, glowColor;
    
    if (isMuted) {
      hueA = 220;
      hueB = 220;
      colorA = `hsla(220, 20%, 50%, 0.6)`;
      colorB = `hsla(220, 20%, 45%, 0.4)`;
      glowColor = `hsla(220, 20%, 50%, 0.15)`;
    } else if (speakingVisual) {
      hueA = 265;
      hueB = 190;
      colorA = `hsla(${hueA}, 95%, 70%, 0.95)`;
      colorB = `hsla(${hueB}, 90%, 65%, 0.55)`;
      glowColor = `hsla(270, 100%, 60%, 0.25)`;
    } else {
      hueA = 215;
      hueB = 225;
      colorA = `hsla(${hueA}, 95%, 70%, 0.95)`;
      colorB = `hsla(${hueB}, 90%, 65%, 0.55)`;
      glowColor = `hsla(220, 100%, 60%, 0.25)`;
    }

    // Parameters modify with amplitude
    const wobble = isMuted ? 3 : 6 + (speakingVisual ? aiPulse * 25 : userPulse * 10); // Aumentadas las ondulaciones del AI
    const ringWidth = isMuted ? 8 : 10 + (speakingVisual ? 8 * (0.4 + aiPulse) : 6 * (0.3 + userPulse));
    const halo = isMuted ? 20 : 45 + (speakingVisual ? 50 * (0.4 + aiPulse) : 38 * (0.3 + userPulse));
    const radiusTarget = baseR + (isMuted ? 0 : speakingVisual ? aiPulse * 10 : userPulse * 16);
    if (prevRadius === 0) prevRadius = baseR;
    if (prevRingWidth === 0) prevRingWidth = ringWidth;
    prevRadius = prevRadius * 0.85 + radiusTarget * 0.15;
    prevRingWidth = prevRingWidth * 0.8 + ringWidth * 0.2;

    // Glow halo
    ctx.save();
    const offsetX = speakingVisual ? (Math.random() - 0.5) * aiPulse * 15 : 0;
    const offsetY = speakingVisual ? (Math.random() - 0.5) * aiPulse * 15 : 0;
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

    // Base rotating conic gradient ring
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

    // Multi-stroke energy ring with subtle wobble
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
        const noise =
          Math.sin(a * (1.5 + i * 0.2) + t * (1 + i * 0.1)) * (wobble * 0.6) +
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

    // Seguridad: si se quedó atascado el estado visual, apágalo cuando no haya energía ni reproducción
    if (isAssistantSpeaking && !speakingVisual && remoteAudio && remoteAudio.paused) {
      updateAssistantStatus(false);
    }
    animationId = requestAnimationFrame(draw);
  }

  function wireDataChannel(channel) {
    dc = channel;
    dc.onopen = () => {
      console.log("[ring] Data channel opened");
    };
    dc.onmessage = async (e) => {
      try {
        const ev = JSON.parse(e.data);
        const t = ev.type || "";

        // Manejar function calls
        if (t === "response.function_call_arguments.done") {
          console.log("[ring] 🔧 Function call detectado:", ev);
          
          const callId = ev.call_id;
          const functionName = ev.name;
          const argsString = ev.arguments || "{}";
          
          try {
            const args = JSON.parse(argsString);
            
            // Ejecutar la herramienta
            const response = await fetch('/api/execute_tool', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                tool_name: functionName,
                arguments: args
              })
            });
            
            const result = await response.json();
            
            // Manejar acciones del sistema
            if (result.success && result.system_action) {
              console.log("[ring] 🔧 Acción del sistema detectada:", result.system_action);
              
              if (result.system_action === "disconnect") {
                // Preparar respuesta antes de desconectar
                const output = JSON.stringify(result.result);
                const responseEvent = {
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: callId,
                    output: output
                  }
                };
                dc.send(JSON.stringify(responseEvent));
                dc.send(JSON.stringify({ type: "response.create" }));
                
                // Esperar un momento para que el AI responda antes de desconectar
                setTimeout(() => {
                  console.log("[ring] 👋 Desconectando por solicitud del AI...");
                  disconnect();
                }, 2000);
                
                return;
              }
              
              if (result.system_action === "open_url") {
                const urlToOpen = result.url;
                console.log("[ring] 🌐 Abriendo URL:", urlToOpen);
                
                // Abrir URL en nueva ventana
                try {
                  window.open(urlToOpen, '_blank', 'noopener,noreferrer');
                  console.log("[ring] ✅ URL abierta exitosamente");
                } catch (error) {
                  console.error("[ring] ❌ Error abriendo URL:", error);
                }
                
                // Enviar confirmación al AI
                const output = JSON.stringify(result.result);
                const responseEvent = {
                  type: "conversation.item.create",
                  item: {
                    type: "function_call_output",
                    call_id: callId,
                    output: output
                  }
                };
                dc.send(JSON.stringify(responseEvent));
                dc.send(JSON.stringify({ type: "response.create" }));
                
                return;
              }
            }
            
            // Preparar la respuesta para herramientas normales
            const output = result.success 
              ? JSON.stringify(result.result)
              : JSON.stringify({ error: result.error || 'Error ejecutando herramienta' });
            
            // Enviar la respuesta al AI
            const responseEvent = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: output
              }
            };
            
            dc.send(JSON.stringify(responseEvent));
            
            // Crear respuesta del asistente
            dc.send(JSON.stringify({ type: "response.create" }));
            
            console.log("[ring] ✅ Respuesta de herramienta enviada:", output);
          } catch (error) {
            console.error("[ring] ❌ Error ejecutando herramienta:", error);
            
            // Enviar error al AI
            const errorOutput = JSON.stringify({ 
              error: error.message || 'Error desconocido' 
            });
            
            const responseEvent = {
              type: "conversation.item.create",
              item: {
                type: "function_call_output",
                call_id: callId,
                output: errorOutput
              }
            };
            
            dc.send(JSON.stringify(responseEvent));
            dc.send(JSON.stringify({ type: "response.create" }));
          }
          return;
        }

        // Assistant speaking toggle based on server events
        if (t === "response.audio_transcript.delta" || t === "response.audio.delta") {
          updateAssistantStatus(true);
          return;
        }
        if (
          t === "response.audio_transcript.done" ||
          t === "response.audio.done" ||
          t === "response.done"
        ) {
          lastAssistantEventTs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
          // No apagar inmediatamente; se apagará con ended/pause o por falta de energía
          return;
        }
      } catch {
        // ignore non-JSON events
      }
    };
    dc.onerror = (err) => {
      console.error("[ring] Data channel error:", err);
    };
  }

  async function connect() {
    if (connected || connecting) return;

    connecting = true;
    updateStatus("connecting");
    showLoading();
    if (ringInfo) ringInfo.style.display = "none";

    try {
      // Get ephemeral key
      const sres = await fetch("/api/session");
      const sdata = await sres.json();
      if (!sres.ok || !sdata?.client_secret?.value) {
        throw new Error(sdata?.error || "No ephemeral client_secret received");
      }
      const ek = sdata.client_secret.value;

      // Request microphone access
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (err) {
        throw new Error("Acceso al micrófono denegado. Por favor, permite el acceso al micrófono e inténtalo de nuevo.");
      }

      // Setup Audio Context
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      micAnalyser = audioContext.createAnalyser();
      micAnalyser.fftSize = 1024;
      micData = new Uint8Array(micAnalyser.frequencyBinCount);
      const micSource = audioContext.createMediaStreamSource(micStream);
      micSource.connect(micAnalyser);

      // WebRTC PeerConnection
      pc = new RTCPeerConnection();

      // Data channel
      try {
        const ch = pc.createDataChannel("oai-events");
        wireDataChannel(ch);
      } catch (err) {
        console.warn("[ring] Failed to create data channel:", err);
      }

      pc.ondatachannel = (ev) => {
        if (ev.channel) wireDataChannel(ev.channel);
      };

      // Send mic
      for (const t of micStream.getAudioTracks()) pc.addTrack(t, micStream);
      pc.addTransceiver("audio", { direction: "sendrecv" });

      // Remote audio and analyser
      pc.ontrack = (event) => {
        const [stream] = event.streams;
        const streamToUse =
          stream || (remoteAudio.srcObject instanceof MediaStream
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
          console.warn("[ring] Failed to setup remote analyser:", err);
        }
      };

      pc.onconnectionstatechange = () => {
        console.log("[ring] Connection state:", pc.connectionState);
        if (pc.connectionState === "disconnected" || 
            pc.connectionState === "failed" || 
            pc.connectionState === "closed") {
          updateStatus("error", "Conexión perdida");
          cleanup();
        }
      };

      // Offer/Answer exchange
      const settings = await getSettings();
      const model = settings?.realtime_model || "gpt-4o-realtime-preview-2024-12-17";
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const answerResp = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${ek}`,
            "Content-Type": "application/sdp",
            "OpenAI-Beta": "realtime=v1",
          },
        }
      );

      if (!answerResp.ok) {
        const errText = await answerResp.text();
        throw new Error(`Conexión fallida: ${answerResp.status} - ${errText}`);
      }

      const answerSdp = await answerResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      connected = true;
      connecting = false;
      updateStatus("connected");
      showActive();

      // Start animation
      if (!animationId) {
        fitCanvas();
        animationId = requestAnimationFrame(draw);
      }
    } catch (err) {
      console.error("[ring] connect error:", err);
      connecting = false;
      updateStatus("error", err.message || "Conexión fallida");
      cleanup();
    }
  }

  function disconnect() {
    cleanup();
  }

  function toggleMute() {
    if (!connected || !micStream) return;

    isMuted = !isMuted;
    micStream.getAudioTracks().forEach((track) => {
      track.enabled = !isMuted;
    });
    updateMuteUI();
  }

  // Event Listeners
  stage.addEventListener("click", (e) => {
    // Don't trigger connect if clicking on controls
    if (e.target.closest(".control-bar")) return;
    if (!connected && !connecting) connect();
  }, { passive: true });

  stage.addEventListener("touchend", (e) => {
    if (e.target.closest(".control-bar")) return;
    if (!connected && !connecting) connect();
  }, { passive: true });

  muteBtn?.addEventListener("click", toggleMute);
  disconnectBtn?.addEventListener("click", disconnect);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      disconnect();
    } else if (e.key === "m" || e.key === "M") {
      if (connected) toggleMute();
    }
  });

  // Layout
  window.addEventListener("resize", fitCanvas);
  fitCanvas();

  // Sincronizar estado speaking con reproducción real del audio remoto
  try {
    remoteAudio?.addEventListener("playing", () => updateAssistantStatus(true));
    remoteAudio?.addEventListener("ended", () => updateAssistantStatus(false));
    remoteAudio?.addEventListener("pause", () => {
      lastAssistantEventTs = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      setTimeout(() => {
        if (remoteAudio.paused) updateAssistantStatus(false);
      }, speakingHoldMs);
    });
  } catch {}

  // Initialize UI
  updateStatus("disconnected");
  showHint();
})();
