/* Simple WebRTC client for OpenAI Realtime with ephemeral token from /api/session.
   - Connect: fetch ephemeral key, capture mic, create RTCPeerConnection,
     exchange SDP with POST https://api.openai.com/v1/realtime?model=...
   - Remote audio auto-plays in #remoteAudio
   - Mute toggles local mic track enabled
   - Live transcript via server events over RTCDataChannel (and optional Web Speech API fallback)
*/
(() => {
  const connectBtn = document.getElementById("voiceConnectBtn");
  const disconnectBtn = document.getElementById("voiceDisconnectBtn");
  const muteBtn = document.getElementById("voiceMuteBtn");
  const statusEl = document.getElementById("voiceStatus");
  const remoteAudio = document.getElementById("remoteAudio");

  let pc = null;
  let micStream = null;
  let isMuted = false;
  let modelForRealtime = null; // from settings

  // Live transcript support (mostrar texto en vivo)
  const transcriptEl = document.getElementById("transcript");
  let dc = null; // DataChannel para eventos JSON del servidor
  let assistantBuf = "";
  let userBuf = "";
  let assistantNode = null;
  let userNode = null;

  // Señal para saber si el servidor está enviando transcripciones del usuario.
  let hasServerUserDelta = false;

  // Fallback: Web Speech API (solo si el servidor no envía STT del usuario)
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  let sttActive = false;
  function startLocalSTT() {
    if (!SR || sttActive) return;
    try {
      rec = new SR();
      rec.lang = "es-ES";                // puedes ajustar el idioma
      rec.interimResults = true;
      rec.continuous = true;
      rec.onresult = (e) => {
        // Si el servidor NO manda deltas del usuario, usamos la transcripción local
        if (hasServerUserDelta) return;
        let txt = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          txt += e.results[i][0].transcript;
        }
        userBuf = txt;
        setMsg("user", userBuf);
      };
      rec.onend = () => {
        // Reiniciar si seguimos conectados
        if (pc) {
          try { rec.start(); } catch {}
        }
      };
      rec.onerror = () => {};
      rec.start();
      sttActive = true;
    } catch {
      // ignorar
    }
  }
  function stopLocalSTT() {
    try {
      if (rec) {
        const tmp = rec;
        rec = null;
        tmp.onend = null;
        tmp.stop();
      }
    } catch {}
    sttActive = false;
  }

  function createMsg(role) {
    const item = document.createElement("div");
    item.className = `msg ${role}`;
    const group = document.createElement("div");
    group.style.maxWidth = "100%";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = role === "assistant" ? "" : "";
    const time = document.createElement("div");
    time.className = "time";
    time.textContent = formatTimestamp(new Date());
    group.appendChild(bubble);
    group.appendChild(time);
    item.appendChild(group);
    transcriptEl.appendChild(item);
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
    return { item, group, bubble, time };
  }

  function setMsg(role, text) {
    if (!transcriptEl) return;
    if (role === "assistant") {
      if (!assistantNode) assistantNode = createMsg("assistant");
      assistantNode.bubble.textContent = text;
      assistantNode.time.textContent = formatTimestamp(new Date());
      // Add a streaming caret/animation while assistant is generating
      assistantNode.bubble.classList.add("streaming");
    } else {
      if (!userNode) userNode = createMsg("user");
      userNode.bubble.textContent = text;
      userNode.time.textContent = formatTimestamp(new Date());
    }
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  function finalize(role) {
    if (role === "assistant") {
      if (assistantNode) {
        assistantNode.bubble.classList.remove("streaming");
      }
      assistantNode = null;
    } else {
      if (userNode) {
        userNode.bubble.classList.remove("streaming");
      }
      userNode = null;
    }
  }

  function formatTimestamp(d) {
    const pad = (n, w = 2) => n.toString().padStart(w, "0");
    const h = pad(d.getHours());
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    const ms = pad(d.getMilliseconds(), 3);
    return `${h}:${m}:${s}.${ms}`;
  }

  function wireDataChannel(channel) {
    dc = channel;
    dc.onopen = () => setStatus("CONNECTED");
    dc.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        const t = ev.type || "";
        // console.debug("RTC event:", t, ev);

        // Usuario (transcripción de entrada)
        // Cubrimos variantes de eventos para STT (transcript/transcription)
        if (
          t === "input_audio_buffer.transcript.delta" ||
          t === "input_audio_transcription.delta" ||
          t === "transcription.delta" ||
          (t.includes("transcript") && t.endsWith(".delta")) ||
          (t.includes("transcription") && t.endsWith(".delta"))
        ) {
          hasServerUserDelta = true;
          const delta = ev.delta ?? ev.text ?? ev.output ?? ev.output_text ?? "";
          userBuf += delta;
          setMsg("user", userBuf);
          return;
        }
        if (
          t === "input_audio_buffer.transcript.completed" ||
          t === "input_audio_transcription.completed" ||
          t === "transcription.completed" ||
          (t.includes("transcript") && (t.endsWith(".completed") || t.endsWith(".done"))) ||
          (t.includes("transcription") && (t.endsWith(".completed") || t.endsWith(".done")))
        ) {
          finalize("user");
          userBuf = "";
          return;
        }
        if (t === "input_audio_buffer.speech_started" || t === "vad.speech_started") {
          userBuf = "";
          setMsg("user", "");
          return;
        }

        // Asistente (texto de salida)
        if (
          t === "response.delta" ||
          t === "response.output_text.delta" ||
          (t.startsWith("response.") && t.endsWith(".delta"))
        ) {
          const delta = ev.delta || ev.output_text || ev.text || "";
          assistantBuf += delta;
          setMsg("assistant", assistantBuf);
          return;
        }
        if (
          t === "response.completed" ||
          t === "response.output_text.done" ||
          (t.startsWith("response.") && (t.endsWith(".completed") || t.endsWith(".done")))
        ) {
          finalize("assistant");
          assistantBuf = "";
          return;
        }
      } catch {
        // no-op
      }
    };
  }

  function setStatus(txt) {
    if (statusEl) statusEl.textContent = txt;
  }
  function setConnectedUI(connected) {
    connectBtn.disabled = connected;
    disconnectBtn.disabled = !connected;
    muteBtn.disabled = !connected;
  }
  async function getSettings() {
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) return {};
      return await r.json();
    } catch {
      return {};
    }
  }

  async function connect() {
    try {
      setStatus("Requesting session…");
      setConnectedUI(false);
      hasServerUserDelta = false;

      const settings = await getSettings();
      const realtimeModel = settings?.realtime_model || "gpt-4o-realtime-preview-2025-06-03";
      modelForRealtime = realtimeModel;

      // Get ephemeral key from server
      const sres = await fetch("/api/session");
      const sdata = await sres.json();
      if (!sres.ok || !sdata?.client_secret?.value) {
        throw new Error(sdata?.error || "No ephemeral client_secret received");
      }
      const ek = sdata.client_secret.value;

      // Capture microphone
      setStatus("Opening microphone…");
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Build RTCPeerConnection
      setStatus("Creating peer connection…");
      pc = new RTCPeerConnection();
      // Crear DataChannel para recibir eventos (texto streaming, etc.)
      try {
        const ch = pc.createDataChannel("oai-events");
        wireDataChannel(ch);
      } catch {}
      // Aceptar canal creado por el servidor si aplica
      pc.ondatachannel = (ev) => {
        try {
          if (ev.channel) wireDataChannel(ev.channel);
        } catch {}
      };

      // Add local audio track
      for (const t of micStream.getAudioTracks()) {
        pc.addTrack(t, micStream);
      }
      // Ensure bi-directional audio even if addTrack didn't set it
      pc.addTransceiver("audio", { direction: "sendrecv" });

      pc.onconnectionstatechange = () => {
        setStatus(pc.connectionState);
        if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
          cleanup();
        }
      };

      pc.ontrack = (event) => {
        // Attach remote stream to the audio element
        if (remoteAudio) {
          const [stream] = event.streams;
          if (stream) {
            remoteAudio.srcObject = stream;
          } else {
            // Fallback if no streams in event
            const s = remoteAudio.srcObject instanceof MediaStream ? remoteAudio.srcObject : new MediaStream();
            s.addTrack(event.track);
            remoteAudio.srcObject = s;
          }
        }
      };

      // Create offer
      setStatus("Creating offer…");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Exchange SDP with OpenAI Realtime (REST SDP)
      setStatus("Negotiating with OpenAI…");
      const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(realtimeModel)}`;
      const answerResp = await fetch(url, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${ek}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1",
        },
      });
      if (!answerResp.ok) {
        const errText = await answerResp.text();
        throw new Error(`Realtime answer failed: ${answerResp.status} ${errText}`);
      }
      const answerSdp = await answerResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // Iniciar fallback de STT local si existe
      startLocalSTT();

      // Update UI
      setConnectedUI(true);
      isMuted = false;
      muteBtn.textContent = "Mute Mic";
      setStatus("CONNECTED");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err && err.message ? err.message : err}`);
      cleanup();
    }
  }

  function cleanup() {
    try {
      if (pc) {
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.getSenders?.().forEach((s) => {
          try { s.track?.stop(); } catch {}
        });
        pc.close();
      }
    } catch {}
    pc = null;
    try { if (dc) dc.close(); } catch {}
    dc = null;

    try {
      if (micStream) {
        for (const t of micStream.getTracks()) t.stop();
      }
    } catch {}
    micStream = null;

    // Parar STT local (si está activo)
    stopLocalSTT();

    setConnectedUI(false);
  }

  function disconnect() {
    setStatus("DISCONNECTED");
    cleanup();
  }

  function toggleMute() {
    if (!micStream) return;
    const tracks = micStream.getAudioTracks();
    if (!tracks.length) return;
    isMuted = !isMuted;
    tracks.forEach((t) => (t.enabled = !isMuted));
    muteBtn.textContent = isMuted ? "Unmute Mic" : "Mute Mic";
    setStatus(isMuted ? "Mic muted" : "Mic live");
  }

  connectBtn?.addEventListener("click", () => {
    if (pc) return;
    connect();
  });
  disconnectBtn?.addEventListener("click", () => disconnect());
  muteBtn?.addEventListener("click", () => toggleMute());

  // Optional: auto-connect on load if query ?voice=auto
  try {
    const qp = new URLSearchParams(window.location.search);
    if (qp.get("voice") === "auto") {
      connect();
    }
  } catch {}
})();
