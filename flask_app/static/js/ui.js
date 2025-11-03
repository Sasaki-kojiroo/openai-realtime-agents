/* Modern UI for voice-only interaction with waveform visualization */
(() => {
  const connectBtn = document.getElementById("uiConnectBtn");
  const disconnectBtn = document.getElementById("uiDisconnectBtn");
  const statusEl = document.getElementById("uiStatus");
  const remoteAudio = document.getElementById("uiRemoteAudio");
  const transcriptEl = document.getElementById("uiTranscript");
  const promptText = document.getElementById("promptText");
  const canvas = document.getElementById("waveformCanvas");
  const ctx = canvas ? canvas.getContext("2d") : null;

  let pc = null;
  let micStream = null;
  let dc = null;
  let animationId = null;
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  // Remote (assistant) audio analyser
  let remoteAnalyser = null;
  let remoteDataArray = null;
  // To fix ordering when assistant arrives before final user transcript
  let firstAssistantMsgPending = null;

  let userBuf = "";
  let assistantBuf = "";
  let currentUserMsg = null;
  let currentAssistantMsg = null;

  // Setup canvas
  function setupCanvas() {
    if (!canvas) return;
    canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }

  // Draw smooth waveform (sine waves)
  let wavePhase = 0;
  let isAssistantSpeaking = false;
  
  function drawWaveform() {
    if (!ctx || !canvas) return;
    
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    const centerY = height / 2;
    
    // Clear with fade effect
    ctx.fillStyle = "rgba(15, 23, 42, 0.15)";
    ctx.fillRect(0, 0, width, height);
    
    // Get audio data if available (use remote analyser when AI speaks)
    let amplitude = 0.25;
    if (isAssistantSpeaking && remoteAnalyser && remoteDataArray) {
      remoteAnalyser.getByteTimeDomainData(remoteDataArray);
      let sum = 0;
      for (let i = 0; i < remoteDataArray.length; i++) {
        sum += Math.abs(remoteDataArray[i] - 128);
      }
      amplitude = (sum / remoteDataArray.length / 128) * 1.5;
    } else if (analyser && dataArray) {
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += Math.abs(dataArray[i] - 128);
      }
      amplitude = (sum / dataArray.length / 128) * 1.5;
    }
    amplitude = Math.max(0.1, Math.min(amplitude, 1.5));
    
    // Draw multiple smooth sine waves
    const numWaves = 3;
    const colors = isAssistantSpeaking 
      ? ["rgba(249, 115, 22, 0.8)", "rgba(251, 146, 60, 0.6)", "rgba(253, 186, 116, 0.4)"]
      : ["rgba(99, 102, 241, 0.8)", "rgba(129, 140, 248, 0.6)", "rgba(165, 180, 252, 0.4)"];
    
    for (let w = 0; w < numWaves; w++) {
      ctx.beginPath();
      ctx.strokeStyle = colors[w];
      ctx.lineWidth = 3 - w * 0.5;
      
      const frequency = 0.02 + w * 0.005;
      const phaseShift = w * Math.PI / 3;
      const amplitudeMultiplier = 1 - w * 0.2;
      
      for (let x = 0; x < width; x++) {
        const angle = x * frequency + wavePhase + phaseShift;
        const y = centerY + Math.sin(angle) * amplitude * 80 * amplitudeMultiplier;
        
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.stroke();
    }
    
    wavePhase += 0.05;
    animationId = requestAnimationFrame(drawWaveform);
  }

  // Create message element
  function createMessage(role, text) {
    const msg = document.createElement("div");
    msg.className = `ui-msg ui-msg-${role}`;
    msg.textContent = text;
    transcriptEl.appendChild(msg);
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
    return msg;
  }

  // Update message
  function updateMessage(element, text) {
    if (element) {
      element.textContent = text;
      transcriptEl.scrollTop = transcriptEl.scrollHeight;
    }
  }

  // Wire DataChannel
  function wireDataChannel(channel) {
    dc = channel;
    dc.onopen = () => setStatus("Connected");
    dc.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        const t = ev.type || "";
        
        // User transcription (based on original Next.js code)
        if (t === "conversation.item.input_audio_transcription.delta") {
          const delta = ev.delta ?? "";
          userBuf += delta;
          if (!currentUserMsg) {
            currentUserMsg = createMessage("user", userBuf);
          } else {
            updateMessage(currentUserMsg, userBuf);
          }
          if (promptText) promptText.style.opacity = "0";
          return;
        }
        
        if (t === "conversation.item.input_audio_transcription.completed") {
          const finalText = ev.transcript ?? userBuf;
          if (currentUserMsg && finalText) {
            updateMessage(currentUserMsg, finalText);
          } else {
            // No live delta received; create the user message now
            const created = createMessage("user", finalText || "");
            // If assistant already started, move user message before it
            if (firstAssistantMsgPending) {
              try { transcriptEl.insertBefore(created, firstAssistantMsgPending); } catch {}
            }
          }
          currentUserMsg = null;
          userBuf = "";
          firstAssistantMsgPending = null;
          return;
        }
        
        // Assistant response transcription (based on original Next.js code)
        if (t === "response.audio_transcript.delta") {
          const delta = ev.delta ?? "";
          assistantBuf += delta;
          if (!currentAssistantMsg) {
            currentAssistantMsg = createMessage("assistant", assistantBuf);
            // If user message not yet created, remember for reordering
            if (!currentUserMsg && !userBuf) {
              firstAssistantMsgPending = currentAssistantMsg;
            }
          } else {
            updateMessage(currentAssistantMsg, assistantBuf);
          }
          isAssistantSpeaking = true;
          return;
        }
        
        if (t === "response.audio_transcript.done") {
          const finalText = ev.transcript ?? assistantBuf;
          if (currentAssistantMsg && finalText) {
            updateMessage(currentAssistantMsg, finalText);
          }
          currentAssistantMsg = null;
          assistantBuf = "";
          isAssistantSpeaking = false;
          return;
        }
        
        // Detect when assistant starts/stops speaking (for waveform color)
        if (t === "response.audio.delta") {
          isAssistantSpeaking = true;
          return;
        }
        
        if (t === "response.audio.done" || t === "response.done") {
          isAssistantSpeaking = false;
          return;
        }
      } catch {}
    };
  }

  // Set status
  function setStatus(txt) {
    if (statusEl) statusEl.textContent = txt;
  }

  // Get settings
  async function getSettings() {
    try {
      const r = await fetch("/api/settings");
      if (!r.ok) return {};
      return await r.json();
    } catch {
      return {};
    }
  }

  // Connect
  async function connect() {
    try {
      setStatus("Connecting...");
      connectBtn.style.display = "none";
      
      const settings = await getSettings();
      const realtimeModel = settings?.realtime_model || "gpt-4o-realtime-preview-2025-06-03";
      
      // Get ephemeral key
      const sres = await fetch("/api/session");
      const sdata = await sres.json();
      if (!sres.ok || !sdata?.client_secret?.value) {
        throw new Error(sdata?.error || "No ephemeral client_secret received");
      }
      const ek = sdata.client_secret.value;
      
      // Capture microphone
      setStatus("Opening microphone...");
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      
      // Setup audio visualization
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(micStream);
      source.connect(analyser);
      analyser.fftSize = 2048;
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      
      setupCanvas();
      drawWaveform();
      
      // Build RTCPeerConnection
      setStatus("Connecting to AI...");
      pc = new RTCPeerConnection();
      
      try {
        const ch = pc.createDataChannel("oai-events");
        wireDataChannel(ch);
      } catch {}
      
      pc.ondatachannel = (ev) => {
        try {
          if (ev.channel) wireDataChannel(ev.channel);
        } catch {}
      };
      
      for (const t of micStream.getAudioTracks()) {
        pc.addTrack(t, micStream);
      }
      pc.addTransceiver("audio", { direction: "sendrecv" });
      
      pc.onconnectionstatechange = () => {
        setStatus(pc.connectionState);
        if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
          cleanup();
        }
      };
      
      pc.ontrack = (event) => {
        if (remoteAudio) {
          const [stream] = event.streams;
          if (stream) {
            remoteAudio.srcObject = stream;
            // Init remote analyser once
            try {
              if (audioContext && !remoteAnalyser) {
                remoteAnalyser = audioContext.createAnalyser();
                const remoteSource = audioContext.createMediaStreamSource(stream);
                remoteSource.connect(remoteAnalyser);
                remoteAnalyser.fftSize = 2048;
                remoteDataArray = new Uint8Array(remoteAnalyser.frequencyBinCount);
              }
            } catch {}
          } else {
            const s = remoteAudio.srcObject instanceof MediaStream ? remoteAudio.srcObject : new MediaStream();
            s.addTrack(event.track);
            remoteAudio.srcObject = s;
            try {
              if (audioContext && !remoteAnalyser) {
                remoteAnalyser = audioContext.createAnalyser();
                const remoteSource = audioContext.createMediaStreamSource(s);
                remoteSource.connect(remoteAnalyser);
                remoteAnalyser.fftSize = 2048;
                remoteDataArray = new Uint8Array(remoteAnalyser.frequencyBinCount);
              }
            } catch {}
          }
        }
      };
      
      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Exchange SDP
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
      
      disconnectBtn.style.display = "block";
      setStatus("Connected - Speak now");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message || err}`);
      cleanup();
      connectBtn.style.display = "block";
    }
  }

  // Cleanup
  function cleanup() {
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    
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
    
    disconnectBtn.style.display = "none";
    connectBtn.style.display = "block";
    
    if (promptText) promptText.style.opacity = "1";
  }

  // Disconnect
  function disconnect() {
    setStatus("Disconnected");
    cleanup();
  }

  // Event listeners
  connectBtn?.addEventListener("click", connect);
  disconnectBtn?.addEventListener("click", disconnect);
  
  // Resize canvas on window resize
  window.addEventListener("resize", setupCanvas);
  
  // Initial setup
  setupCanvas();
})();
