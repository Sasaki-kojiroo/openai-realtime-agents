document.addEventListener("DOMContentLoaded", () => {
  const transcriptEl = document.getElementById("transcript");
  const chatForm = document.getElementById("chatForm");
  const messageInput = document.getElementById("messageInput");
  const copyBtn = document.getElementById("copyBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const modelInfo = document.getElementById("modelInfo");

  // Historial mantendrá objetos { role: "user"|"assistant", content: "..." }
  const history = [];

  // Cargar settings (modelo, temperatura) para mostrar en UI
  fetch("/api/settings")
    .then((r) => r.json())
    .then((settings) => {
      const { model, temperature, realtime_model, voice } = settings || {};
      if (modelInfo) {
        const textModel = model
          ? `Modelo: ${model}${temperature !== undefined ? ` · temp: ${temperature}` : ""}`
          : "";
        const rt = realtime_model
          ? ` | Realtime: ${realtime_model}${voice ? ` · Voz: ${voice}` : ""}`
          : "";
        modelInfo.textContent = `${textModel}${rt}`.trim();
      }
    })
    .catch(() => { /* noop */ });

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = (messageInput.value || "").trim();
    if (!text) return;

    const sentAt = new Date();
    addMessage("user", text, sentAt);

    // Importante: NO agregamos aún el mensaje del usuario a history que enviamos al backend,
    // porque el backend ya agrega el mensaje actual. Lo agregaremos localmente tras la respuesta.
    setFormEnabled(false);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history, // solo historial previo
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data && data.error ? data.error : "Error en la solicitud");
      }

      // Tras respuesta exitosa, ahora sí, persistimos ambos en el historial
      history.push({ role: "user", content: text });

      const reply = data.reply || "";
      addMessage("assistant", reply, data.timestamp ? new Date(data.timestamp) : new Date());
      history.push({ role: "assistant", content: reply });
    } catch (err) {
      addMessage("assistant", `⚠️ Error: ${(err && err.message) || err}`, new Date());
    } finally {
      setFormEnabled(true);
    }

    messageInput.value = "";
    messageInput.focus();
  });

  copyBtn?.addEventListener("click", async () => {
    const plain = transcriptToPlain();
    try {
      await navigator.clipboard.writeText(plain);
      toast("Transcript copiado");
    } catch {
      toast("No se pudo copiar");
    }
  });

  downloadBtn?.addEventListener("click", () => {
    const plain = transcriptToPlain();
    const blob = new Blob([plain], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    const now = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = `transcript_${now.toISOString().replace(/[:.]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  function addMessage(role, text, when) {
    const item = document.createElement("div");
    item.className = `msg ${role}`;

    const group = document.createElement("div");
    group.style.maxWidth = "100%";
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.textContent = text;

    const time = document.createElement("div");
    time.className = "time";
    time.textContent = formatTimestamp(when || new Date());

    group.appendChild(bubble);
    group.appendChild(time);
    item.appendChild(group);

    transcriptEl.appendChild(item);
    // Auto-scroll al final
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
  }

  function transcriptToPlain() {
    // Construye texto plano con el formato:
    // HH:MM:SS.mmm  [role] mensaje
    const lines = [];
    const nodes = transcriptEl.querySelectorAll(".msg");
    nodes.forEach((n) => {
      const role = n.classList.contains("user") ? "user" : "assistant";
      const bubble = n.querySelector(".bubble");
      const time = n.querySelector(".time");
      if (bubble && time) {
        lines.push(`${time.textContent}  [${role}] ${bubble.textContent}`);
      }
    });
    return lines.join("\n");
  }

  function setFormEnabled(enabled) {
    messageInput.disabled = !enabled;
    chatForm.querySelector("button[type='submit']").disabled = !enabled;
  }

  function formatTimestamp(d) {
    const pad = (n, w = 2) => n.toString().padStart(w, "0");
    const h = pad(d.getHours());
    const m = pad(d.getMinutes());
    const s = pad(d.getSeconds());
    const ms = pad(d.getMilliseconds(), 3);
    return `${h}:${m}:${s}.${ms}`;
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    Object.assign(t.style, {
      position: "fixed",
      bottom: "18px",
      right: "18px",
      background: "#0f172a",
      color: "#fff",
      padding: "10px 12px",
      borderRadius: "10px",
      fontSize: "13px",
      zIndex: 9999,
      boxShadow: "0 5px 16px rgba(0,0,0,.25)",
      opacity: "0",
      transition: "opacity .15s ease",
    });
    document.body.appendChild(t);
    requestAnimationFrame(() => { t.style.opacity = "1"; });
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 200);
    }, 1600);
  }
});
