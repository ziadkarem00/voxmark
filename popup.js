/**
 * VoxMark AI - Popup Controller
 * Manages user preferences, voice list enumeration, live preview, and chrome.storage.sync persistence.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const tabNative = document.getElementById("tab-native");
  const tabOpenai = document.getElementById("tab-openai");
  const panelNative = document.getElementById("panel-native");
  const panelOpenai = document.getElementById("panel-openai");
  const selectNativeVoice = document.getElementById("select-native-voice");
  const inputOpenaiKey = document.getElementById("input-openai-key");
  const btnToggleKey = document.getElementById("btn-toggle-key");
  const selectOpenaiModel = document.getElementById("select-openai-model");
  const selectOpenaiVoice = document.getElementById("select-openai-voice");
  const sliderRate = document.getElementById("slider-rate");
  const valRate = document.getElementById("val-rate");
  const sliderPitch = document.getElementById("slider-pitch");
  const valPitch = document.getElementById("val-pitch");
  const groupPitch = document.getElementById("group-pitch");
  const btnPreview = document.getElementById("btn-preview");
  const btnStopPreview = document.getElementById("btn-stop-preview");
  const savedToast = document.getElementById("saved-toast");

  let currentAudioPreview = null;
  let saveDebounceTimer = null;
  let toastTimer = null;

  // Default state
  const state = {
    engine: "native",
    nativeVoiceURI: "",
    rate: 1.0,
    pitch: 1.0,
    openaiKey: "",
    openaiModel: "tts-1",
    openaiVoice: "nova"
  };

  // --- Show Saved Feedback ---
  function showSavedToast(text = "Settings saved") {
    savedToast.textContent = text;
    savedToast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      savedToast.classList.remove("show");
    }, 1500);
  }

  // --- Save to Chrome Storage ---
  function persistSettings() {
    clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      chrome.storage.sync.set(state, () => {
        showSavedToast();
      });
    }, 200);
  }

  // --- Tab Switching ---
  function setEngineMode(engine) {
    state.engine = engine;
    if (engine === "native") {
      tabNative.classList.add("active");
      tabOpenai.classList.remove("active");
      panelNative.classList.remove("hidden");
      panelOpenai.classList.add("hidden");
      groupPitch.classList.remove("hidden");
    } else {
      tabOpenai.classList.add("active");
      tabNative.classList.remove("active");
      panelOpenai.classList.remove("hidden");
      panelNative.classList.add("hidden");
      groupPitch.classList.add("hidden"); // Pitch is not an OpenAI parameter
    }
    persistSettings();
  }

  tabNative.addEventListener("click", () => setEngineMode("native"));
  tabOpenai.addEventListener("click", () => setEngineMode("openai"));

  // --- Toggle Password Visibility ---
  btnToggleKey.addEventListener("click", () => {
    if (inputOpenaiKey.type === "password") {
      inputOpenaiKey.type = "text";
      btnToggleKey.textContent = "🙈";
    } else {
      inputOpenaiKey.type = "password";
      btnToggleKey.textContent = "👁️";
    }
  });

  // --- Populate Native Voices ---
  function populateVoiceList() {
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;

    selectNativeVoice.innerHTML = "";

    // Prioritize English & natural voices, followed by others
    const sorted = [...voices].sort((a, b) => {
      const aEn = a.lang.startsWith("en");
      const bEn = b.lang.startsWith("en");
      if (aEn && !bEn) return -1;
      if (!aEn && bEn) return 1;

      const aNat = /natural|google|siri|online|neural/i.test(a.name);
      const bNat = /natural|google|siri|online|neural/i.test(b.name);
      if (aNat && !bNat) return -1;
      if (!aNat && bNat) return 1;

      return a.name.localeCompare(b.name);
    });

    // Option for Auto-detect
    const autoOpt = document.createElement("option");
    autoOpt.value = "";
    autoOpt.textContent = "✨ Auto-detect Best Natural Voice";
    selectNativeVoice.appendChild(autoOpt);

    for (const voice of sorted) {
      const opt = document.createElement("option");
      opt.value = voice.voiceURI;
      let label = `${voice.name} (${voice.lang})`;
      if (/natural|neural/i.test(voice.name)) {
        label = `💎 ${label}`;
      } else if (/google|siri/i.test(voice.name)) {
        label = `⚡ ${label}`;
      }
      opt.textContent = label;
      selectNativeVoice.appendChild(opt);
    }

    if (state.nativeVoiceURI) {
      selectNativeVoice.value = state.nativeVoiceURI;
    }
  }

  // In Chrome, voices might load asynchronously
  populateVoiceList();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = populateVoiceList;
  }

  // --- Initialize UI from chrome.storage.sync ---
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
      Object.assign(state, items);

      setEngineMode(state.engine);
      sliderRate.value = state.rate;
      valRate.textContent = `${Number(state.rate).toFixed(2)}x`;
      sliderPitch.value = state.pitch;
      valPitch.textContent = `${Number(state.pitch).toFixed(2)}x`;

      inputOpenaiKey.value = state.openaiKey || "";
      selectOpenaiModel.value = state.openaiModel || "tts-1";
      selectOpenaiVoice.value = state.openaiVoice || "nova";

      if (state.nativeVoiceURI && selectNativeVoice.options.length > 0) {
        selectNativeVoice.value = state.nativeVoiceURI;
      }
    }
  );

  // --- Event Listeners for Controls ---
  selectNativeVoice.addEventListener("change", (e) => {
    state.nativeVoiceURI = e.target.value;
    persistSettings();
  });

  inputOpenaiKey.addEventListener("input", (e) => {
    state.openaiKey = e.target.value.trim();
    persistSettings();
  });

  selectOpenaiModel.addEventListener("change", (e) => {
    state.openaiModel = e.target.value;
    persistSettings();
  });

  selectOpenaiVoice.addEventListener("change", (e) => {
    state.openaiVoice = e.target.value;
    persistSettings();
  });

  sliderRate.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    state.rate = val;
    valRate.textContent = `${val.toFixed(2)}x`;
    persistSettings();
  });

  sliderPitch.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    state.pitch = val;
    valPitch.textContent = `${val.toFixed(2)}x`;
    persistSettings();
  });

  // --- Audio Preview Implementation ---
  function stopPreview() {
    window.speechSynthesis.cancel();
    if (currentAudioPreview) {
      currentAudioPreview.pause();
      currentAudioPreview.src = "";
      currentAudioPreview = null;
    }
    btnPreview.querySelector("span").textContent = "▶ Preview Voice";
    btnPreview.classList.remove("hidden");
    btnStopPreview.classList.add("hidden");
  }

  btnStopPreview.addEventListener("click", stopPreview);

  btnPreview.addEventListener("click", async () => {
    stopPreview();

    const sampleText = "Hello! VoxMark AI is ready to read web text with high quality.";

    if (state.engine === "native") {
      const utterance = new SpeechSynthesisUtterance(sampleText);
      utterance.rate = state.rate || 1.0;
      utterance.pitch = state.pitch || 1.0;

      const voices = window.speechSynthesis.getVoices();
      if (state.nativeVoiceURI) {
        const found = voices.find((v) => v.voiceURI === state.nativeVoiceURI);
        if (found) utterance.voice = found;
      } else {
        // Find best natural voice
        const natural = voices.find(
          (v) => v.lang.startsWith("en") && /natural|online|google|siri/i.test(v.name)
        );
        if (natural) utterance.voice = natural;
      }

      utterance.onstart = () => {
        btnPreview.querySelector("span").textContent = "🔊 Speaking...";
        btnStopPreview.classList.remove("hidden");
      };

      utterance.onend = stopPreview;
      utterance.onerror = stopPreview;

      window.speechSynthesis.speak(utterance);
    } else {
      // OpenAI mode
      if (!state.openaiKey) {
        showSavedToast("Please enter an OpenAI API Key");
        inputOpenaiKey.focus();
        return;
      }

      btnPreview.querySelector("span").textContent = "⏳ Generating...";
      btnStopPreview.classList.remove("hidden");

      try {
        const response = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${state.openaiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: state.openaiModel || "tts-1",
            input: sampleText,
            voice: state.openaiVoice || "nova",
            speed: Math.min(4.0, Math.max(0.25, state.rate || 1.0))
          })
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.error?.message || `HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudioPreview = audio;

        audio.onplay = () => {
          btnPreview.querySelector("span").textContent = "🔊 Playing AI...";
        };

        audio.onended = () => {
          URL.revokeObjectURL(url);
          stopPreview();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);
          showSavedToast("Audio playback failed");
          stopPreview();
        };

        await audio.play();
      } catch (err) {
        console.error("[VoxMark AI] Preview error:", err);
        showSavedToast(`Error: ${err.message}`);
        stopPreview();
      }
    }
  });

  // Cleanup on popup close
  window.addEventListener("unload", stopPreview);
});
