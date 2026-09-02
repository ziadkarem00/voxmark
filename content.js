/**
 * VoxMark AI - Content Script
 * Dual-engine Text-to-Speech playback controller & Glassmorphic Floating HUD
 */

(function () {
  // Prevent duplicate injection in the same tab
  if (window.__VOXMARK_AI_INITIALIZED__) {
    return;
  }
  window.__VOXMARK_AI_INITIALIZED__ = true;

  // --- Configuration & State ---
  const STATE = {
    active: false,
    engine: "native", // 'native' | 'openai'
    text: "",
    chunks: [],
    currentChunkIndex: 0,
    isPlaying: false,
    audioElement: null,
    audioObjectUrl: null,
    speechWatchdog: null,
    settings: {
      engine: "native",
      nativeVoiceURI: "",
      rate: 1.0,
      pitch: 1.0,
      openaiKey: "",
      openaiModel: "tts-1",
      openaiVoice: "nova"
    }
  };

  let hudHost = null;
  let hudShadow = null;
  let hudElement = null;
  let isCleaningUp = false;

  // --- SVGs for HUD Buttons ---
  const ICONS = {
    play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
    pause: `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
    stop: `<svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>`
  };

  // --- Settings Loader ---
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(
        {
          engine: "native",
          nativeVoiceURI: "",
          rate: 1.0,
          pitch: 1.0,
          openaiKey: "",
          openaiModel: "tts-1",
          openaiVoice: "nova"
        },
        (items) => {
          STATE.settings = { ...STATE.settings, ...items };
          resolve(STATE.settings);
        }
      );
    });
  }

  // --- Shadow DOM HUD Creation ---
  function getOrCreateHUD() {
    if (hudHost && document.body.contains(hudHost)) {
      return hudElement;
    }

    // Create root host element
    hudHost = document.createElement("div");
    hudHost.id = "voxmark-root";
    hudShadow = hudHost.attachShadow({ mode: "open" });

    // Inject CSS into Shadow Root for total style isolation
    const style = document.createElement("style");
    style.textContent = `
      :host {
        all: initial;
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #f8fafc;
        pointer-events: auto;
        user-select: none;
        -webkit-font-smoothing: antialiased;
      }
      .voxmark-hud {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 14px 8px 16px;
        background: rgba(15, 20, 32, 0.92);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 9999px;
        box-shadow: 0 16px 36px -4px rgba(0, 0, 0, 0.6),
                    0 0 0 1px rgba(255, 255, 255, 0.08),
                    0 0 24px -2px rgba(99, 102, 241, 0.35);
        transform: translateY(20px) scale(0.95);
        opacity: 0;
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        max-width: 440px;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
      }
      .voxmark-hud.voxmark-visible {
        transform: translateY(0) scale(1);
        opacity: 1;
      }
      .voxmark-hud.voxmark-hiding {
        transform: translateY(16px) scale(0.92);
        opacity: 0;
        pointer-events: none;
      }
      .voxmark-progress-track {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: rgba(255, 255, 255, 0.08);
      }
      .voxmark-progress-bar {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #38bdf8, #818cf8, #c084fc);
        transition: width 0.2s ease;
      }
      .voxmark-wave {
        display: flex;
        align-items: center;
        gap: 3px;
        height: 18px;
        padding-right: 2px;
      }
      .voxmark-bar {
        width: 3px;
        height: 5px;
        border-radius: 3px;
        background: linear-gradient(180deg, #38bdf8, #818cf8);
        transition: height 0.15s ease;
      }
      .voxmark-playing .voxmark-bar:nth-child(1) { animation: voxmark-wave 0.8s ease-in-out infinite alternate; }
      .voxmark-playing .voxmark-bar:nth-child(2) { animation: voxmark-wave 0.8s ease-in-out infinite 0.2s alternate; }
      .voxmark-playing .voxmark-bar:nth-child(3) { animation: voxmark-wave 0.8s ease-in-out infinite 0.4s alternate; }
      .voxmark-playing .voxmark-bar:nth-child(4) { animation: voxmark-wave 0.8s ease-in-out infinite 0.15s alternate; }
      .voxmark-playing .voxmark-bar:nth-child(5) { animation: voxmark-wave 0.8s ease-in-out infinite 0.35s alternate; }
      @keyframes voxmark-wave {
        0% { height: 4px; }
        100% { height: 18px; }
      }
      .voxmark-meta {
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-width: 90px;
        max-width: 170px;
      }
      .voxmark-title-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .voxmark-brand {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.3px;
        background: linear-gradient(135deg, #38bdf8, #818cf8);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .voxmark-mode-badge {
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        padding: 1px 5px;
        border-radius: 4px;
        background: rgba(99, 102, 241, 0.2);
        color: #a5b4fc;
        border: 1px solid rgba(99, 102, 241, 0.3);
        letter-spacing: 0.4px;
      }
      .voxmark-status {
        font-size: 11px;
        color: #94a3b8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-top: 1px;
      }
      .voxmark-controls {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .voxmark-btn {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #f8fafc;
        cursor: pointer;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        outline: none;
        transition: all 0.2s ease;
      }
      .voxmark-btn:hover {
        background: rgba(255, 255, 255, 0.18);
        border-color: rgba(255, 255, 255, 0.25);
        transform: scale(1.06);
      }
      .voxmark-btn:active { transform: scale(0.94); }
      .voxmark-btn-primary {
        background: linear-gradient(135deg, #4f46e5, #6366f1);
        border-color: rgba(165, 180, 252, 0.4);
        box-shadow: 0 0 12px rgba(99, 102, 241, 0.5);
        width: 34px;
        height: 34px;
      }
      .voxmark-btn-primary:hover {
        background: linear-gradient(135deg, #4338ca, #4f46e5);
        box-shadow: 0 0 16px rgba(99, 102, 241, 0.7);
      }
      .voxmark-btn svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }
      .voxmark-btn-stop:hover {
        background: rgba(239, 68, 68, 0.25);
        border-color: rgba(239, 68, 68, 0.4);
        color: #fca5a5;
      }
      .voxmark-speed-badge {
        font-size: 10px;
        font-weight: 600;
        color: #cbd5e1;
        background: rgba(255, 255, 255, 0.07);
        padding: 3px 6px;
        border-radius: 6px;
        margin-left: 2px;
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .voxmark-alert {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.96);
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 16px;
        font-size: 11px;
        font-weight: 500;
        color: #fca5a5;
        z-index: 10;
      }
    `;
    hudShadow.appendChild(style);

    // Build HUD inner DOM
    hudElement = document.createElement("div");
    hudElement.className = "voxmark-hud";
    hudElement.innerHTML = `
      <div class="voxmark-progress-track">
        <div class="voxmark-progress-bar" id="vm-progress"></div>
      </div>
      <div class="voxmark-wave" id="vm-wave">
        <div class="voxmark-bar"></div>
        <div class="voxmark-bar"></div>
        <div class="voxmark-bar"></div>
        <div class="voxmark-bar"></div>
        <div class="voxmark-bar"></div>
      </div>
      <div class="voxmark-meta">
        <div class="voxmark-title-row">
          <span class="voxmark-brand">VoxMark</span>
          <span class="voxmark-mode-badge" id="vm-mode">AI</span>
        </div>
        <div class="voxmark-status" id="vm-status">Preparing speech...</div>
      </div>
      <div class="voxmark-controls">
        <button class="voxmark-btn voxmark-btn-primary" id="vm-toggle" title="Play / Pause">
          ${ICONS.pause}
        </button>
        <button class="voxmark-btn voxmark-btn-stop" id="vm-stop" title="Stop Reading">
          ${ICONS.stop}
        </button>
        <span class="voxmark-speed-badge" id="vm-speed">1.0x</span>
      </div>
    `;

    hudShadow.appendChild(hudElement);
    document.body.appendChild(hudHost);

    // Bind event listeners inside Shadow DOM
    const toggleBtn = hudShadow.getElementById("vm-toggle");
    const stopBtn = hudShadow.getElementById("vm-stop");

    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      togglePlayPause();
    });

    stopBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      stopPlayback(true);
    });

    // Animate in
    requestAnimationFrame(() => {
      hudElement.classList.add("voxmark-visible");
    });

    return hudElement;
  }

  // --- HUD State Updaters ---
  function updateHUDState({ status, isPlaying, progressPercent, modeLabel, speedLabel }) {
    if (!hudShadow || !hudElement) return;

    const wave = hudShadow.getElementById("vm-wave");
    const toggleBtn = hudShadow.getElementById("vm-toggle");
    const statusEl = hudShadow.getElementById("vm-status");
    const progressEl = hudShadow.getElementById("vm-progress");
    const modeEl = hudShadow.getElementById("vm-mode");
    const speedEl = hudShadow.getElementById("vm-speed");

    if (wave && isPlaying !== undefined) {
      wave.classList.toggle("voxmark-playing", isPlaying);
    }

    if (toggleBtn && isPlaying !== undefined) {
      toggleBtn.innerHTML = isPlaying ? ICONS.pause : ICONS.play;
    }

    if (statusEl && status) {
      statusEl.textContent = status;
    }

    if (progressEl && progressPercent !== undefined) {
      progressEl.style.width = `${Math.min(100, Math.max(0, progressPercent))}%`;
    }

    if (modeEl && modeLabel) {
      modeEl.textContent = modeLabel;
    }

    if (speedEl && speedLabel) {
      speedEl.textContent = speedLabel;
    }
  }

  function showHUDAlert(message, durationMs = 3000) {
    if (!hudShadow || !hudElement) return;
    const existing = hudShadow.querySelector(".voxmark-alert");
    if (existing) existing.remove();

    const alert = document.createElement("div");
    alert.className = "voxmark-alert";
    alert.textContent = message;
    hudElement.appendChild(alert);

    setTimeout(() => {
      if (alert.parentNode) alert.remove();
    }, durationMs);
  }

  function removeHUD() {
    if (!hudHost || !hudElement) return;

    hudElement.classList.remove("voxmark-visible");
    hudElement.classList.add("voxmark-hiding");

    setTimeout(() => {
      if (hudHost && hudHost.parentNode) {
        hudHost.parentNode.removeChild(hudHost);
      }
      hudHost = null;
      hudShadow = null;
      hudElement = null;
    }, 280);
  }

  // --- Text Chunking ---
  /**
   * Chunks long text into sentence blocks (max ~160 chars) to prevent Chrome TTS freeze.
   */
  function chunkText(text) {
    const rawSentences = text.match(/[^.!?;\n]+[.!?;\n]+|\s*[^.!?;\n]+$/g) || [text];
    const chunks = [];

    for (let sentence of rawSentences) {
      sentence = sentence.trim();
      if (!sentence) continue;

      if (sentence.length <= 160) {
        chunks.push(sentence);
      } else {
        // Break excessively long sentences on word boundaries
        const words = sentence.split(/\s+/);
        let current = "";
        for (const word of words) {
          if ((current + " " + word).trim().length > 160) {
            if (current) chunks.push(current.trim());
            current = word;
          } else {
            current = current ? current + " " + word : word;
          }
        }
        if (current) chunks.push(current.trim());
      }
    }

    return chunks.length > 0 ? chunks : [text];
  }

  // --- Best Voice Selector for Native TTS ---
  function selectBestNativeVoice(preferredURI) {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    // 1. Explicit user choice from settings
    if (preferredURI) {
      const match = voices.find((v) => v.voiceURI === preferredURI);
      if (match) return match;
    }

    // 2. High-quality natural voices heuristic (Google, Microsoft Natural/Online, Apple Siri)
    const naturalKeywords = ["natural", "online", "google", "siri", "neural"];
    for (const keyword of naturalKeywords) {
      const natural = voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          v.name.toLowerCase().includes(keyword)
      );
      if (natural) return natural;
    }

    // 3. Fallback to any English voice
    const englishVoice = voices.find((v) => v.lang.startsWith("en"));
    if (englishVoice) return englishVoice;

    // 4. Fallback to default
    const defaultVoice = voices.find((v) => v.default);
    return defaultVoice || voices[0];
  }

  // --- Native SpeechSynthesis Watchdog ---
  /**
   * Chrome has an engine bug where long speech freezes after ~15 seconds.
   * Periodically calling pause() and resume() keeps the native speech pipeline alive.
   */
  function startSpeechWatchdog() {
    stopSpeechWatchdog();
    STATE.speechWatchdog = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  }

  function stopSpeechWatchdog() {
    if (STATE.speechWatchdog) {
      clearInterval(STATE.speechWatchdog);
      STATE.speechWatchdog = null;
    }
  }

  // --- Native TTS Playback ---
  function playNativeChunk(index) {
    if (!STATE.active || index >= STATE.chunks.length) {
      stopPlayback(true);
      return;
    }

    STATE.currentChunkIndex = index;
    const chunkTextContent = STATE.chunks[index];

    // Ensure voices are loaded
    const voice = selectBestNativeVoice(STATE.settings.nativeVoiceURI);
    const utterance = new SpeechSynthesisUtterance(chunkTextContent);

    if (voice) {
      utterance.voice = voice;
    }
    utterance.rate = STATE.settings.rate || 1.0;
    utterance.pitch = STATE.settings.pitch || 1.0;

    const progress = ((index) / STATE.chunks.length) * 100;
    updateHUDState({
      status: `Sentence ${index + 1} of ${STATE.chunks.length}`,
      isPlaying: true,
      progressPercent: progress,
      modeLabel: "NATIVE",
      speedLabel: `${utterance.rate.toFixed(1)}x`
    });

    utterance.onend = () => {
      if (!STATE.active) return;
      playNativeChunk(index + 1);
    };

    utterance.onerror = (err) => {
      console.warn("[VoxMark AI] SpeechSynthesis chunk error:", err);
      if (STATE.active && index + 1 < STATE.chunks.length) {
        playNativeChunk(index + 1);
      } else {
        stopPlayback(true);
      }
    };

    window.speechSynthesis.speak(utterance);
    startSpeechWatchdog();
  }

  function startNativePlayback() {
    window.speechSynthesis.cancel();
    STATE.engine = "native";
    STATE.isPlaying = true;

    // On some browsers getVoices() is async on initial load
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        playNativeChunk(0);
      };
    } else {
      playNativeChunk(0);
    }
  }

  // --- OpenAI TTS Playback ---
  async function startOpenAIPlayback() {
    STATE.engine = "openai";
    const apiKey = (STATE.settings.openaiKey || "").trim();

    if (!apiKey) {
      console.warn("[VoxMark AI] No OpenAI API Key found. Falling back to native TTS.");
      showHUDAlert("No API Key. Using native voice...");
      setTimeout(() => {
        startNativePlayback();
      }, 1200);
      return;
    }

    updateHUDState({
      status: "Generating AI voice...",
      isPlaying: false,
      progressPercent: 10,
      modeLabel: STATE.settings.openaiModel === "tts-1-hd" ? "HD AI" : "AI",
      speedLabel: `${(STATE.settings.rate || 1.0).toFixed(1)}x`
    });

    try {
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: STATE.settings.openaiModel || "tts-1",
          input: STATE.text.slice(0, 4096), // API character ceiling limit
          voice: STATE.settings.openaiVoice || "nova",
          speed: Math.min(4.0, Math.max(0.25, STATE.settings.rate || 1.0))
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const blob = await response.blob();
      if (!STATE.active) return; // playback was cancelled while downloading

      STATE.audioObjectUrl = URL.createObjectURL(blob);
      const audio = new Audio(STATE.audioObjectUrl);
      STATE.audioElement = audio;

      audio.addEventListener("timeupdate", () => {
        if (!audio.duration) return;
        const pct = (audio.currentTime / audio.duration) * 100;
        updateHUDState({
          progressPercent: pct,
          status: `Playing (${Math.round(audio.currentTime)}s / ${Math.round(audio.duration)}s)`
        });
      });

      audio.addEventListener("ended", () => {
        stopPlayback(true);
      });

      audio.addEventListener("error", (e) => {
        console.error("[VoxMark AI] Audio element error:", e);
        showHUDAlert("Playback error. Falling back...");
        startNativePlayback();
      });

      await audio.play();
      STATE.isPlaying = true;
      updateHUDState({
        status: `Voice: ${STATE.settings.openaiVoice}`,
        isPlaying: true,
        progressPercent: 0
      });
    } catch (err) {
      console.error("[VoxMark AI] OpenAI TTS Request Failed:", err);
      showHUDAlert(`AI error: ${err.message}. Falling back...`, 3000);
      setTimeout(() => {
        if (STATE.active) {
          startNativePlayback();
        }
      }, 1500);
    }
  }

  // --- Master Play / Pause / Stop Handlers ---
  function togglePlayPause() {
    if (!STATE.active) return;

    if (STATE.engine === "openai" && STATE.audioElement) {
      if (STATE.audioElement.paused) {
        STATE.audioElement.play();
        STATE.isPlaying = true;
      } else {
        STATE.audioElement.pause();
        STATE.isPlaying = false;
      }
      updateHUDState({ isPlaying: STATE.isPlaying });
    } else {
      // Native engine
      if (window.speechSynthesis.speaking) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          STATE.isPlaying = true;
        } else {
          window.speechSynthesis.pause();
          STATE.isPlaying = false;
        }
        updateHUDState({ isPlaying: STATE.isPlaying });
      }
    }
  }

  function stopPlayback(dismissHUD = true) {
    if (isCleaningUp) return;
    isCleaningUp = true;

    // Halt native speech
    stopSpeechWatchdog();
    window.speechSynthesis.cancel();

    // Halt HTML5 audio
    if (STATE.audioElement) {
      try {
        STATE.audioElement.pause();
        STATE.audioElement.src = "";
      } catch (_) {}
      STATE.audioElement = null;
    }

    if (STATE.audioObjectUrl) {
      URL.revokeObjectURL(STATE.audioObjectUrl);
      STATE.audioObjectUrl = null;
    }

    STATE.active = false;
    STATE.isPlaying = false;
    STATE.chunks = [];
    STATE.currentChunkIndex = 0;

    if (dismissHUD) {
      removeHUD();
    }

    isCleaningUp = false;
  }

  // --- Main Reading Entrypoint ---
  async function readText(text) {
    if (!text || !text.trim()) return;

    // Clean up any ongoing session
    stopPlayback(false);

    await loadSettings();

    STATE.active = true;
    STATE.text = text.trim();
    STATE.chunks = chunkText(STATE.text);
    STATE.currentChunkIndex = 0;

    // Show HUD
    getOrCreateHUD();
    updateHUDState({
      status: "Initializing...",
      isPlaying: false,
      progressPercent: 0,
      modeLabel: STATE.settings.engine === "openai" ? "AI" : "NATIVE",
      speedLabel: `${(STATE.settings.rate || 1.0).toFixed(1)}x`
    });

    if (STATE.settings.engine === "openai" && STATE.settings.openaiKey) {
      startOpenAIPlayback();
    } else {
      startNativePlayback();
    }
  }

  // --- Highlight & Selection Change Listener ---
  // "Clicking 'Stop' or highlighting new text immediately halts audio playback and removes the HUD."
  let lastSelectionText = "";

  document.addEventListener("selectionchange", () => {
    if (!STATE.active) return;

    const selection = window.getSelection();
    const currentSelection = selection ? selection.toString().trim() : "";

    // Ignore if selection is empty (e.g. clicking around) or matches the text currently being read
    if (!currentSelection) return;
    if (currentSelection === STATE.text) return;
    if (currentSelection === lastSelectionText) return;

    lastSelectionText = currentSelection;
    // User highlighted fresh/new text on the page: halt audio & remove HUD immediately
    stopPlayback(true);
  });

  // --- Cleanup on navigation / unload ---
  window.addEventListener("pagehide", () => stopPlayback(true));
  window.addEventListener("beforeunload", () => stopPlayback(true));

  // --- Message Dispatcher from Background Service Worker ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return;

    switch (message.action) {
      case "READ_SELECTION":
        readText(message.text);
        sendResponse({ success: true });
        break;

      case "STOP_PLAYBACK":
        stopPlayback(true);
        sendResponse({ success: true });
        break;

      case "TOGGLE_PLAY_PAUSE":
        togglePlayPause();
        sendResponse({ success: true, isPlaying: STATE.isPlaying });
        break;

      default:
        break;
    }
    return true;
  });
})();
