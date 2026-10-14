"use strict";

const audio = document.querySelector("#audio");
const root = document.documentElement;
const app = document.querySelector(".app-shell");
const elements = {
  title: document.querySelector("#track-title"),
  artist: document.querySelector("#track-artist"),
  cover: document.querySelector("#cover-art"),
  play: document.querySelector("#play-pause"),
  playIcon: document.querySelector("#play-icon"),
  currentTime: document.querySelector("#current-time"),
  totalTime: document.querySelector("#total-time"),
  seek: document.querySelector("#seek"),
  volume: document.querySelector("#volume"),
  mute: document.querySelector("#mute"),
  volumeIcon: document.querySelector("#volume-icon"),
  shuffle: document.querySelector("#shuffle"),
  repeat: document.querySelector("#repeat"),
  repeatBadge: document.querySelector("#repeat-one-badge"),
  speed: document.querySelector("#speed"),
  list: document.querySelector("#playlist"),
  count: document.querySelector("#track-count"),
  fileInput: document.querySelector("#add-songs"),
  status: document.querySelector("#status"),
  canvas: document.querySelector("#visualizer"),
  equalizerToggle: document.querySelector("#equalizer-toggle"),
  equalizerPanel: document.querySelector("#equalizer-panel"),
  equalizerEnabled: document.querySelector("#equalizer-enabled"),
  equalizerPreset: document.querySelector("#equalizer-preset"),
  equalizerReset: document.querySelector("#equalizer-reset"),
  equalizerBands: document.querySelector("#equalizer-bands"),
  ringtoneOpen: document.querySelector("#ringtone-open"),
  ringtoneDialog: document.querySelector("#ringtone-dialog"),
  ringtoneForm: document.querySelector("#ringtone-form"),
  ringtoneName: document.querySelector("#ringtone-name"),
  ringtoneStart: document.querySelector("#ringtone-start"),
  ringtoneEnd: document.querySelector("#ringtone-end"),
  ringtoneSelectionStatus: document.querySelector("#ringtone-selection-status"),
  ringtonePreview: document.querySelector("#ringtone-preview"),
  ringtoneSave: document.querySelector("#ringtone-save")
};

const playbackSpeeds = [0.75, 1, 1.25, 1.5];
const bundledDurations = new Map(tracks.map(track => [track.src, track.duration]));
const equalizerBandSpecs = [
  { frequency: 60, label: "60 Hz", type: "lowshelf" },
  { frequency: 250, label: "250 Hz", type: "peaking" },
  { frequency: 1000, label: "1 kHz", type: "peaking" },
  { frequency: 4000, label: "4 kHz", type: "peaking" },
  { frequency: 12000, label: "12 kHz", type: "highshelf" }
];
const equalizerPresets = {
  flat: [0, 0, 0, 0, 0],
  bass: [7, 5, 0, -1, 0],
  treble: [0, -1, 0, 4, 7],
  vocal: [-2, 0, 4, 3, 1],
  rock: [5, 3, -1, 3, 5]
};
let currentIndex = 0;
let isShuffling = false;
let playedInShuffle = new Set();
let repeatMode = "off";
let speedIndex = 1;
let isSeeking = false;
let lastVolume = 80;
let audioContext = null;
let analyser = null;
let sourceNode = null;
let equalizerFilters = [];
let pendingLoad = 0;
let activeObjectUrls = [];
let ringtoneProcessor = null;
let ringtoneSilence = null;
let ringtoneCapture = null;
let ringtonePreviewEnd = null;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function updateRangeFill(input, percentage) {
  input.style.setProperty("--fill", `${Math.max(0, Math.min(100, percentage))}%`);
}

function setStatus(message = "") {
  elements.status.textContent = message;
}

function selectedRingtoneRange() {
  const start = Number(elements.ringtoneStart.value);
  const end = Number(elements.ringtoneEnd.value);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
    return { error: "Choose a valid start and end time." };
  }
  if (end - start < 1 || end - start > 30) {
    return { error: "The clip must be between 1 and 30 seconds long." };
  }
  const track = tracks[currentIndex];
  if (!track || !Number.isFinite(track.duration) || end > track.duration) {
    return { error: "The clip must fit within the selected song." };
  }
  return { start, end, track };
}

function updateRingtoneSelection() {
  const range = selectedRingtoneRange();
  elements.ringtoneSelectionStatus.textContent = range.error
    || `Selected clip: ${(range.end - range.start).toFixed(1)} seconds`;
  elements.ringtoneSelectionStatus.classList.toggle("has-error", Boolean(range.error));
  elements.ringtoneSave.disabled = Boolean(range.error) || Boolean(ringtoneCapture);
  elements.ringtonePreview.disabled = Boolean(range.error) || Boolean(ringtoneCapture);
}

function openRingtoneDialog() {
  const track = tracks[currentIndex];
  if (!track) {
    setStatus("Select a song before creating a ringtone.");
    return;
  }
  const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : track.duration;
  if (!Number.isFinite(duration) || duration < 1) {
    setStatus("Wait for the song to load before creating a ringtone.");
    return;
  }
  const start = Math.max(0, Math.min(audio.currentTime || 0, Math.max(0, duration - 1)));
  const end = Math.min(duration, start + 20);
  elements.ringtoneName.value = `${track.title} Ringtone`.slice(0, 60);
  elements.ringtoneStart.max = String(Math.max(0, duration - 1));
  elements.ringtoneEnd.max = String(duration);
  elements.ringtoneStart.value = start.toFixed(1);
  elements.ringtoneEnd.value = end.toFixed(1);
  updateRingtoneSelection();
  elements.ringtoneDialog.showModal();
  elements.ringtoneName.focus();
}

function stopRingtonePreview() {
  ringtonePreviewEnd = null;
  if (elements.ringtoneDialog.open) elements.ringtonePreview.textContent = "Preview clip";
}

async function previewRingtone() {
  const range = selectedRingtoneRange();
  if (range.error) {
    updateRingtoneSelection();
    return;
  }
  stopRingtonePreview();
  audio.currentTime = range.start;
  ringtonePreviewEnd = range.end;
  elements.ringtonePreview.textContent = "Stop preview";
  try {
    await playAudio();
    if (audio.paused) {
      stopRingtonePreview();
      elements.ringtoneSelectionStatus.textContent = "The selected song could not be played for preview.";
      elements.ringtoneSelectionStatus.classList.add("has-error");
    }
  } catch (error) {
    stopRingtonePreview();
    elements.ringtoneSelectionStatus.textContent = `Preview failed: ${error.message}`;
    elements.ringtoneSelectionStatus.classList.add("has-error");
  }
}

function encodeRingtoneWav(capture) {
  const frameCount = Math.ceil((capture.end - capture.start) * capture.sampleRate);
  const wave = new ArrayBuffer(44 + frameCount * 2);
  const data = new DataView(wave);
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) {
      data.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  data.setUint32(4, 36 + frameCount * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, 1, true);
  data.setUint32(24, capture.sampleRate, true);
  data.setUint32(28, capture.sampleRate * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  writeText(36, "data");
  data.setUint32(40, frameCount * 2, true);

  let frameOffset = 0;
  for (const chunk of capture.samples) {
    const framesToCopy = Math.min(chunk.length, frameCount - frameOffset);
    for (let index = 0; index < framesToCopy; index += 1) {
      const sample = Math.max(-1, Math.min(1, chunk[index]));
      data.setInt16(44 + (frameOffset + index) * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
    }
    frameOffset += framesToCopy;
    if (frameOffset >= frameCount) break;
  }
  return new Blob([wave], { type: "audio/wav" });
}

function disconnectRingtoneProcessor() {
  if (analyser && ringtoneProcessor) analyser.disconnect(ringtoneProcessor);
  if (ringtoneProcessor && ringtoneSilence) ringtoneProcessor.disconnect(ringtoneSilence);
}

function cancelRingtoneCapture(message = "") {
  if (!ringtoneCapture) return;
  const capture = ringtoneCapture;
  ringtoneCapture = null;
  capture.cancelled = true;
  clearTimeout(capture.timeout);
  disconnectRingtoneProcessor();
  audio.playbackRate = capture.previousPlaybackRate;
  if (!audio.paused) audio.pause();
  if (message && elements.ringtoneDialog.open) {
    elements.ringtoneSelectionStatus.textContent = message;
    elements.ringtoneSelectionStatus.classList.add("has-error");
  }
  updateRingtoneSelection();
}

async function saveRingtoneCapture(capture) {
  const blob = encodeRingtoneWav(capture);
  const ringtone = {
    id: window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: capture.title,
    artist: capture.track.artist,
    hue: capture.track.hue,
    duration: capture.end - capture.start,
    createdAt: Date.now(),
    blob
  };
  try {
    await window.auralRingtoneStore.addToLibrary(ringtone, tracks);
    renderPlaylist();
    elements.ringtoneDialog.close();
    setStatus("Ringtone saved. Find it in the Ringtones playlist.");
  } catch (error) {
    elements.ringtoneSelectionStatus.textContent = `Could not save the ringtone: ${error.message}`;
    elements.ringtoneSelectionStatus.classList.add("has-error");
    console.error("Unable to save the ringtone:", error);
    elements.ringtoneSave.disabled = false;
    elements.ringtonePreview.disabled = false;
  }
}

function finishRingtoneCapture() {
  if (!ringtoneCapture) return;
  const capture = ringtoneCapture;
  ringtoneCapture = null;
  clearTimeout(capture.timeout);
  disconnectRingtoneProcessor();
  audio.playbackRate = capture.previousPlaybackRate;
  audio.pause();
  if (capture.cancelled) return;
  updateRingtoneSelection();
  if (capture.samples.length === 0) {
    elements.ringtoneSelectionStatus.textContent = "No audio was captured. Try again.";
    elements.ringtoneSelectionStatus.classList.add("has-error");
    return;
  }
  void saveRingtoneCapture(capture);
}

async function createRingtone(event) {
  event.preventDefault();
  const range = selectedRingtoneRange();
  if (range.error) {
    updateRingtoneSelection();
    return;
  }
  if (!window.auralRingtoneStore) {
    elements.ringtoneSelectionStatus.textContent = "Ringtone creation is not supported in this browser.";
    elements.ringtoneSelectionStatus.classList.add("has-error");
    return;
  }
  if (!audioContext || !analyser) {
    initializeAudioGraph();
  }
  if (!audioContext || !analyser || !audioContext.createScriptProcessor) {
    elements.ringtoneSelectionStatus.textContent = "Audio recording is not available in this browser.";
    elements.ringtoneSelectionStatus.classList.add("has-error");
    return;
  }

  try {
    if (!ringtoneProcessor) {
      ringtoneProcessor = audioContext.createScriptProcessor(4096, 1, 1);
      ringtoneSilence = audioContext.createGain();
      ringtoneSilence.gain.value = 0;
      ringtoneSilence.connect(audioContext.destination);
      ringtoneProcessor.onaudioprocess = processEvent => {
        if (!ringtoneCapture || !ringtoneCapture.started) return;
        const input = processEvent.inputBuffer;
        const firstChannel = input.getChannelData(0);
        const samples = new Float32Array(firstChannel.length);
        if (input.numberOfChannels === 1) {
          samples.set(firstChannel);
        } else {
          const secondChannel = input.getChannelData(1);
          for (let index = 0; index < samples.length; index += 1) {
            samples[index] = (firstChannel[index] + secondChannel[index]) / 2;
          }
        }
        ringtoneCapture.samples.push(samples);
        for (let channel = 0; channel < processEvent.outputBuffer.numberOfChannels; channel += 1) {
          processEvent.outputBuffer.getChannelData(channel).fill(0);
        }
      };
    }
    const recordTitle = elements.ringtoneName.value.trim() || `${range.track.title} Ringtone`;
    const record = {
      track: range.track,
      title: recordTitle,
      start: range.start,
      end: range.end,
      sampleRate: audioContext.sampleRate,
      samples: [],
      previousPlaybackRate: audio.playbackRate,
      started: false,
      cancelled: false,
      timeout: 0
    };
    ringtoneCapture = record;
    ringtoneProcessor.connect(ringtoneSilence);
    analyser.connect(ringtoneProcessor);
    elements.ringtoneSave.disabled = true;
    elements.ringtonePreview.disabled = true;
    elements.ringtoneSelectionStatus.textContent = "Recording your ringtone…";
    elements.ringtoneSelectionStatus.classList.remove("has-error");
    audio.playbackRate = 1;
    audio.currentTime = range.start;
    await playAudio();
    if (audio.paused) {
      record.cancelled = true;
      finishRingtoneCapture();
      elements.ringtoneSelectionStatus.textContent = "The selected song could not be played, so no ringtone was recorded.";
      elements.ringtoneSelectionStatus.classList.add("has-error");
      return;
    }
    record.started = true;
    record.timeout = window.setTimeout(() => finishRingtoneCapture(), (range.end - range.start) * 1000 + 1200);
  } catch (error) {
    if (ringtoneCapture) {
      cancelRingtoneCapture();
    } else {
      audio.pause();
    }
    updateRingtoneSelection();
    elements.ringtoneSelectionStatus.textContent = `Could not create the ringtone: ${error.message}`;
    elements.ringtoneSelectionStatus.classList.add("has-error");
    console.error("Unable to create the ringtone:", error);
  }
}

function renderEqualizer() {
  const fragment = document.createDocumentFragment();
  equalizerBandSpecs.forEach((band, index) => {
    const control = document.createElement("label");
    control.className = "equalizer-band";
    control.htmlFor = `eq-band-${index}`;
    const value = document.createElement("span");
    value.className = "equalizer-value";
    value.id = `eq-value-${index}`;
    value.textContent = "0 dB";
    const slider = document.createElement("input");
    slider.className = "equalizer-slider";
    slider.id = `eq-band-${index}`;
    slider.type = "range";
    slider.min = "-12";
    slider.max = "12";
    slider.step = "0.5";
    slider.value = "0";
    slider.setAttribute("aria-label", `${band.label} equalizer gain`);
    slider.setAttribute("aria-valuetext", "0 decibels");
    slider.addEventListener("input", () => {
      value.textContent = `${Number(slider.value) > 0 ? "+" : ""}${slider.value} dB`;
      slider.setAttribute("aria-valuetext", `${slider.value} decibels`);
      elements.equalizerPreset.value = "custom";
      applyEqualizerSettings();
    });
    const frequency = document.createElement("span");
    frequency.className = "equalizer-frequency";
    frequency.textContent = band.label;
    control.append(value, slider, frequency);
    fragment.append(control);
  });
  elements.equalizerBands.replaceChildren(fragment);
}

function equalizerValues() {
  return Array.from(elements.equalizerBands.querySelectorAll(".equalizer-slider"), slider => Number(slider.value));
}

function applyEqualizerSettings() {
  const gains = equalizerValues();
  equalizerFilters.forEach((filter, index) => {
    filter.gain.value = elements.equalizerEnabled.checked ? gains[index] : 0;
  });
}

function applyEqualizerPreset(preset) {
  const gains = equalizerPresets[preset];
  if (!gains) return;
  elements.equalizerBands.querySelectorAll(".equalizer-slider").forEach((slider, index) => {
    slider.value = String(gains[index]);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  });
  elements.equalizerPreset.value = preset;
  applyEqualizerSettings();
}

function updatePlaybackState() {
  const playing = !audio.paused;
  app.classList.toggle("playing", playing);
  app.classList.toggle("paused", !playing);
  elements.play.setAttribute("aria-label", playing ? "Pause" : "Play");
  elements.play.title = playing ? "Pause (Space)" : "Play (Space)";
  elements.playIcon.setAttribute("d", playing ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z");
  if ("mediaSession" in navigator && "playbackState" in navigator.mediaSession) {
    navigator.mediaSession.playbackState = playing ? "playing" : "paused";
  }
}

function renderPlaylist() {
  if (!elements.list || !elements.count) return;
  const fragment = document.createDocumentFragment();
  elements.list.replaceChildren();

  if (tracks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-library";
    empty.textContent = "Add audio files to build your playlist.";
    fragment.append(empty);
  }

  tracks.forEach((track, index) => {
    const item = document.createElement("li");
    item.className = "playlist-item";
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `Play ${track.title} by ${track.artist}`);
    item.setAttribute("aria-current", index === currentIndex ? "true" : "false");
    if (index === currentIndex) item.classList.add("active");

    const marker = document.createElement("span");
    marker.className = "track-marker";
    const number = document.createElement("span");
    number.className = "track-index";
    number.textContent = String(index + 1).padStart(2, "0");
    const equalizer = document.createElement("span");
    equalizer.className = "track-equalizer";
    equalizer.setAttribute("aria-hidden", "true");
    for (let bar = 0; bar < 3; bar += 1) equalizer.append(document.createElement("i"));
    marker.append(number, equalizer);

    const copy = document.createElement("span");
    copy.className = "track-copy";
    const title = document.createElement("span");
    title.className = "track-name";
    title.textContent = track.title;
    const artist = document.createElement("span");
    artist.className = "track-artist";
    artist.textContent = track.artist;
    copy.append(title, artist);

    const duration = document.createElement("span");
    duration.className = "track-duration";
    duration.textContent = track.duration > 0 ? formatTime(track.duration) : "--:--";
    item.append(marker, copy, duration);
    item.addEventListener("click", () => loadTrack(index, true));
    item.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        loadTrack(index, true);
      }
    });
    fragment.append(item);
  });

  elements.list.append(fragment);
  elements.count.textContent = `${tracks.length} ${tracks.length === 1 ? "track" : "tracks"}`;
}

function updateMediaSession(track) {
  if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: "Aural — Sample Collection"
  });
}

function loadTrack(index, shouldPlay = false) {
  if (index < 0 || index >= tracks.length) return;
  if (ringtoneCapture) {
    cancelRingtoneCapture("Ringtone creation was canceled because the song changed.");
    if (elements.ringtoneDialog.open) {
      elements.ringtoneSelectionStatus.textContent = "Ringtone creation was canceled because the song changed.";
    }
  }
  stopRingtonePreview();
  currentIndex = index;
  if (isShuffling) playedInShuffle.add(index);
  const track = tracks[index];
  if (bundledDurations.has(track.src) && !window.auralAudioCompatibility.getFallback(track)) {
    track.duration = bundledDurations.get(track.src);
  }
  const loadId = ++pendingLoad;
  root.style.setProperty("--h", String(track.hue));
  elements.title.textContent = track.title;
  elements.artist.textContent = track.artist;
  elements.cover.src = track.cover;
  elements.cover.alt = `Abstract album artwork for ${track.title}`;
  elements.totalTime.textContent = track.duration > 0 ? formatTime(track.duration) : "0:00";
  elements.currentTime.textContent = "0:00";
  elements.seek.value = "0";
  updateRangeFill(elements.seek, 0);
  audio.pause();
  audio.src = window.auralAudioCompatibility.getFallback(track) || track.playbackSrc || track.src;
  audio.playbackRate = playbackSpeeds[speedIndex];
  updateMediaSession(track);
  renderPlaylist();
  setStatus("");
  if (shouldPlay) {
    void playAudio(loadId);
  }
}

function initializeAudioGraph() {
  if (audioContext || !window.AudioContext && !window.webkitAudioContext) return;
  let context;
  let mediaSource;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    context = new AudioContextClass();
    const filters = equalizerBandSpecs.map(band => {
      const filter = context.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      filter.Q.value = 1;
      return filter;
    });
    const nextAnalyser = context.createAnalyser();
    nextAnalyser.fftSize = 128;
    nextAnalyser.smoothingTimeConstant = 0.82;
    mediaSource = context.createMediaElementSource(audio);
    let previousNode = mediaSource;
    for (const filter of filters) {
      previousNode.connect(filter);
      previousNode = filter;
    }
    previousNode.connect(nextAnalyser);
    nextAnalyser.connect(context.destination);
    audioContext = context;
    sourceNode = mediaSource;
    equalizerFilters = filters;
    analyser = nextAnalyser;
    applyEqualizerSettings();
  } catch (error) {
    if (mediaSource && context) {
      try {
        mediaSource.disconnect();
        mediaSource.connect(context.destination);
        audioContext = context;
        sourceNode = mediaSource;
      } catch (bypassError) {
        console.error("Unable to bypass the audio effects graph:", bypassError);
      }
    } else if (context) {
      void context.close().catch(closeError => {
        console.warn("Unable to close the unused audio context:", closeError);
      });
    }
    analyser = null;
    equalizerFilters = [];
    setStatus("Audio visualizer could not be initialized in this browser.");
    console.error("Unable to initialize the audio visualizer:", error);
  }
}

async function playAudio(loadId = pendingLoad) {
  initializeAudioGraph();
  if (loadId !== pendingLoad) return;
  try {
    if (audioContext?.state === "suspended") await audioContext.resume();
    if (loadId !== pendingLoad) return;
    await audio.play();
    setStatus("");
  } catch (error) {
    if (loadId !== pendingLoad) return;
    const track = tracks[currentIndex];
    if (error.name === "NotSupportedError"
      && track?.compatibilityRoot
      && !window.auralAudioCompatibility.getFallback(track)) {
      try {
        const fallbackUrl = window.auralAudioCompatibility.createFallback(track);
        audio.src = fallbackUrl;
        await audio.play();
        setStatus("");
        return;
      } catch (fallbackError) {
        if (loadId !== pendingLoad) return;
        setStatus(`Could not start audio playback: ${fallbackError.message}`);
        console.error("Unable to play the bundled or compatibility audio:", fallbackError);
        return;
      }
    }
    if (error.name !== "AbortError") {
      setStatus(`Playback failed: ${error.message}`);
      console.error("Unable to play the selected track:", error);
    }
  }
}

function togglePlayback() {
  if (audio.paused) {
    void playAudio();
  } else {
    audio.pause();
  }
}

function selectNextIndex() {
  if (isShuffling) {
    let choices = tracks.map((_, index) => index).filter(index => !playedInShuffle.has(index));
    if (choices.length === 0) {
      if (repeatMode !== "all" || tracks.length < 2) return currentIndex;
      playedInShuffle = new Set([currentIndex]);
      choices = tracks.map((_, index) => index).filter(index => index !== currentIndex);
    }
    const nextIndex = choices[Math.floor(Math.random() * choices.length)];
    playedInShuffle.add(nextIndex);
    return nextIndex;
  }
  if (tracks.length < 2) return currentIndex;
  if (currentIndex + 1 < tracks.length) return currentIndex + 1;
  return repeatMode === "all" ? 0 : currentIndex;
}

function selectPreviousIndex() {
  if (tracks.length < 2) return currentIndex;
  if (isShuffling) {
    const choices = tracks.map((_, index) => index).filter(index => index !== currentIndex);
    return choices[Math.floor(Math.random() * choices.length)];
  }
  return (currentIndex - 1 + tracks.length) % tracks.length;
}

function playNext() {
  const nextIndex = selectNextIndex();
  if (nextIndex !== currentIndex) loadTrack(nextIndex, true);
}

function playPrevious() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  const previousIndex = selectPreviousIndex();
  if (previousIndex !== currentIndex) loadTrack(previousIndex, true);
}

function setVolume(value, persist = true) {
  const volume = Math.max(0, Math.min(100, Number(value)));
  elements.volume.value = String(volume);
  updateRangeFill(elements.volume, volume);
  audio.volume = volume / 100;
  if (volume > 0) lastVolume = volume;
  audio.muted = volume === 0;
  elements.mute.setAttribute("aria-pressed", String(audio.muted));
  elements.mute.setAttribute("aria-label", audio.muted ? "Unmute" : "Mute");
  elements.volumeIcon.setAttribute("d", volume === 0
    ? "M11 5 6 9H3v6h3l5 4V5Zm5 4 5 6m0-6-5 6"
    : volume < 45
      ? "M11 5 6 9H3v6h3l5 4V5Zm5 4a5 5 0 0 1 0 6"
      : "M11 5 6 9H3v6h3l5 4V5Zm5 4a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12");
  if (persist) {
    try {
      localStorage.setItem("aural-volume", String(volume));
    } catch (error) {
      console.warn("Could not save the volume preference:", error);
    }
  }
}

function toggleMute() {
  setVolume(audio.muted || Number(elements.volume.value) === 0 ? lastVolume || 80 : 0);
}

function setRepeatMode(mode) {
  repeatMode = mode;
  elements.repeat.dataset.mode = mode;
  elements.repeat.setAttribute("aria-pressed", String(mode !== "off"));
  elements.repeat.setAttribute("aria-label", `Repeat ${mode}`);
  elements.repeat.title = `Repeat: ${mode}`;
}

function setSpeed(nextIndex) {
  speedIndex = nextIndex;
  const speed = playbackSpeeds[speedIndex];
  audio.playbackRate = speed;
  elements.speed.textContent = `${speed.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}×`;
  elements.speed.setAttribute("aria-label", `Playback speed ${speed} times`);
}

function setShuffle(enabled) {
  isShuffling = enabled;
  playedInShuffle = new Set([currentIndex]);
  elements.shuffle.setAttribute("aria-pressed", String(enabled));
  elements.shuffle.setAttribute("aria-label", `Shuffle ${enabled ? "on" : "off"}`);
}

function renderTime() {
  if (isSeeking || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  const percentage = (audio.currentTime / audio.duration) * 100;
  elements.seek.value = String(Math.round(percentage * 10));
  updateRangeFill(elements.seek, percentage);
  elements.currentTime.textContent = formatTime(audio.currentTime);
}

function handleTrackEnded() {
  if (repeatMode === "one") {
    audio.currentTime = 0;
    void playAudio();
    return;
  }
  if (repeatMode === "all" && tracks.length === 1) {
    audio.currentTime = 0;
    void playAudio();
    return;
  }
  const nextIndex = selectNextIndex();
  if (nextIndex !== currentIndex) {
    loadTrack(nextIndex, true);
    return;
  }
  audio.currentTime = 0;
  renderTime();
}

function addLocalFiles(files) {
  const selected = Array.from(files).filter(isSupportedAudioFile);
  if (selected.length === 0) {
    setStatus("Choose one or more supported audio files.");
    return;
  }
  const firstAddedIndex = tracks.length;
  for (const file of selected) {
    const objectUrl = URL.createObjectURL(file);
    activeObjectUrls.push(objectUrl);
    const title = file.name.replace(/\.[^.]+$/, "") || file.name;
    const hue = Math.floor(Math.random() * 360);
    tracks.push({
      title,
      artist: "Local file",
      src: objectUrl,
      cover: makeCover(hue, "LOCAL", "YOUR LIBRARY"),
      hue,
      duration: 0
    });
  }
  renderPlaylist();
  loadTrack(firstAddedIndex, true);
  setStatus(`${selected.length} ${selected.length === 1 ? "song" : "songs"} added.`);
}

function handleKeyboard(event) {
  const target = event.target;
  const isTyping = target instanceof HTMLElement
    && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName));
  if (isTyping || event.altKey || event.ctrlKey || event.metaKey) return;

  const key = event.key.toLowerCase();
  if (key === " " || key === "spacebar") {
    event.preventDefault();
    togglePlayback();
  } else if (key === "arrowleft") {
    event.preventDefault();
    audio.currentTime = Math.max(0, audio.currentTime - 5);
  } else if (key === "arrowright") {
    event.preventDefault();
    audio.currentTime = Number.isFinite(audio.duration)
      ? Math.min(audio.duration, audio.currentTime + 5)
      : audio.currentTime + 5;
  } else if (key === "arrowup") {
    event.preventDefault();
    setVolume(Number(elements.volume.value) + 5);
  } else if (key === "arrowdown") {
    event.preventDefault();
    setVolume(Number(elements.volume.value) - 5);
  } else if (key === "n") {
    playNext();
  } else if (key === "p") {
    playPrevious();
  } else if (key === "m") {
    toggleMute();
  } else if (key === "s") {
    setShuffle(!isShuffling);
  }
}

function isSupportedAudioFile(file) {
  return file.type.startsWith("audio/")
    || /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|webm)$/i.test(file.name);
}

function installMediaSessionHandlers() {
  if (!("mediaSession" in navigator)) return;
  const handlers = {
    play: () => void playAudio(),
    pause: () => audio.pause(),
    nexttrack: playNext,
    previoustrack: playPrevious
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch (error) {
      console.warn(`Media Session action "${action}" is not available:`, error);
    }
  }
}

function drawRoundedBar(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  if (typeof context.roundRect === "function") {
    context.roundRect(x, y, width, height, safeRadius);
  } else {
    context.moveTo(x + safeRadius, y);
    context.arcTo(x + width, y, x + width, y + height, safeRadius);
    context.arcTo(x + width, y + height, x, y + height, safeRadius);
    context.arcTo(x, y + height, x, y, safeRadius);
    context.arcTo(x, y, x + width, y, safeRadius);
    context.closePath();
  }
  context.fill();
}

function drawVisualizer() {
  const canvas = elements.canvas;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const bars = 40;
  const gap = 5;
  const barWidth = (width - gap * (bars - 1)) / bars;
  const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
  let animationTime = 0;

  function draw() {
    requestAnimationFrame(draw);
    context.clearRect(0, 0, width, height);
    if (data && analyser) analyser.getByteFrequencyData(data);
    const gradient = context.createLinearGradient(0, height, 0, 0);
    gradient.addColorStop(0, `hsl(${tracks[currentIndex]?.hue ?? 266} 86% 58%)`);
    gradient.addColorStop(1, `hsl(${((tracks[currentIndex]?.hue ?? 266) + 48) % 360} 88% 72%)`);
    context.fillStyle = gradient;
    animationTime += 0.035;

    for (let index = 0; index < bars; index += 1) {
      const quiet = !audio.paused && data
        ? data[Math.floor(index * (data.length * 0.8 / bars))] / 255
        : 0.07 + (Math.sin(animationTime + index * 0.47) + 1) * 0.045;
      const barHeight = Math.max(5, quiet * height);
      const x = index * (barWidth + gap);
      drawRoundedBar(context, x, (height - barHeight) / 2, barWidth, barHeight, 4);
    }
  }
  draw();
}

elements.play.addEventListener("click", togglePlayback);
document.querySelector("#previous").addEventListener("click", playPrevious);
document.querySelector("#next").addEventListener("click", playNext);
elements.shuffle.addEventListener("click", () => setShuffle(!isShuffling));
elements.repeat.addEventListener("click", () => {
  const modes = ["off", "all", "one"];
  setRepeatMode(modes[(modes.indexOf(repeatMode) + 1) % modes.length]);
});
elements.speed.addEventListener("click", () => setSpeed((speedIndex + 1) % playbackSpeeds.length));
elements.mute.addEventListener("click", toggleMute);
elements.volume.addEventListener("input", () => setVolume(elements.volume.value));
elements.seek.addEventListener("input", () => {
  isSeeking = true;
  const percentage = Number(elements.seek.value) / 10;
  updateRangeFill(elements.seek, percentage);
  if (Number.isFinite(audio.duration)) {
    elements.currentTime.textContent = formatTime(audio.duration * percentage / 100);
  }
});
elements.seek.addEventListener("change", () => {
  if (Number.isFinite(audio.duration)) audio.currentTime = audio.duration * Number(elements.seek.value) / 1000;
  isSeeking = false;
});
elements.fileInput?.addEventListener("change", () => {
  addLocalFiles(elements.fileInput.files);
  elements.fileInput.value = "";
});
elements.equalizerToggle.addEventListener("click", () => {
  const isExpanded = elements.equalizerToggle.getAttribute("aria-expanded") === "true";
  elements.equalizerToggle.setAttribute("aria-expanded", String(!isExpanded));
  elements.equalizerPanel.hidden = isExpanded;
});
elements.equalizerEnabled.addEventListener("change", applyEqualizerSettings);
elements.equalizerPreset.addEventListener("change", () => {
  applyEqualizerPreset(elements.equalizerPreset.value);
});
elements.equalizerReset.addEventListener("click", () => applyEqualizerPreset("flat"));
elements.ringtoneOpen.addEventListener("click", openRingtoneDialog);
elements.ringtoneStart.addEventListener("input", updateRingtoneSelection);
elements.ringtoneEnd.addEventListener("input", updateRingtoneSelection);
elements.ringtonePreview.addEventListener("click", () => {
  if (ringtonePreviewEnd !== null) {
    stopRingtonePreview();
    audio.pause();
  } else {
    void previewRingtone();
  }
});
elements.ringtoneForm.addEventListener("submit", createRingtone);
elements.ringtoneDialog.addEventListener("cancel", () => {
  stopRingtonePreview();
  if (ringtoneCapture) {
    cancelRingtoneCapture();
  } else {
    audio.pause();
  }
});
elements.ringtoneDialog.addEventListener("click", event => {
  if (event.target === elements.ringtoneDialog) elements.ringtoneDialog.close();
});
elements.ringtoneDialog.addEventListener("close", () => {
  stopRingtonePreview();
  if (ringtoneCapture) {
    cancelRingtoneCapture();
  }
});
document.addEventListener("keydown", handleKeyboard);
for (const closeButton of elements.ringtoneDialog.querySelectorAll("[data-close-dialog]")) {
  closeButton.addEventListener("click", () => elements.ringtoneDialog.close());
}

audio.addEventListener("play", updatePlaybackState);
audio.addEventListener("pause", () => {
  updatePlaybackState();
  if (ringtoneCapture && !ringtoneCapture.finishing) {
    cancelRingtoneCapture("Recording canceled because playback was paused.");
  } else if (ringtonePreviewEnd !== null) {
    stopRingtonePreview();
  }
});
audio.addEventListener("timeupdate", () => {
  renderTime();
  if (ringtonePreviewEnd !== null && audio.currentTime >= ringtonePreviewEnd) {
    stopRingtonePreview();
    audio.pause();
  }
  if (ringtoneCapture && audio.currentTime >= ringtoneCapture.end && !ringtoneCapture.finishing) {
    ringtoneCapture.finishing = true;
    clearTimeout(ringtoneCapture.timeout);
    ringtoneCapture.timeout = window.setTimeout(finishRingtoneCapture, 120);
  }
});
audio.addEventListener("loadedmetadata", () => {
  const track = tracks[currentIndex];
  if (track && audio.currentSrc === audio.src && Number.isFinite(audio.duration)) {
    track.duration = audio.duration;
    elements.totalTime.textContent = formatTime(audio.duration);
    renderPlaylist();
  }
});
audio.addEventListener("ended", () => {
  if (ringtoneCapture) {
    if (!ringtoneCapture.finishing) {
      ringtoneCapture.finishing = true;
      clearTimeout(ringtoneCapture.timeout);
      ringtoneCapture.timeout = window.setTimeout(finishRingtoneCapture, 120);
    }
  } else if (ringtonePreviewEnd !== null) {
    stopRingtonePreview();
  } else {
    handleTrackEnded();
  }
});
audio.addEventListener("error", () => {
  const track = tracks[currentIndex];
  if (track && audio.currentSrc === audio.src && audio.error) {
    if (ringtoneCapture) {
      cancelRingtoneCapture("Recording canceled because the selected song could not be played.");
    }
    if (track.compatibilityRoot && audio.error.code === 4 && !window.auralAudioCompatibility.getFallback(track)) return;
    const messages = {
      1: "Audio loading was canceled.",
      2: "A network error interrupted audio loading.",
      3: "This audio file could not be decoded.",
      4: "This audio format is not supported."
    };
    setStatus(messages[audio.error.code] || `Unable to load ${track.title}.`);
  }
});
window.addEventListener("beforeunload", () => {
  for (const objectUrl of activeObjectUrls) URL.revokeObjectURL(objectUrl);
  window.auralRingtoneStore.release();
  window.auralAudioCompatibility.release();
});

void (async () => {
  try {
    await window.auralRingtoneStore.loadIntoLibrary(tracks);
  } catch (error) {
    setStatus(`Saved ringtones could not be loaded: ${error.message}`);
    console.error("Unable to load saved ringtones:", error);
  }

  let savedVolume = 80;
  try {
    const storedVolume = Number(localStorage.getItem("aural-volume"));
    if (Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 100) {
      savedVolume = storedVolume;
    }
  } catch (error) {
    console.warn("Could not read the saved volume preference:", error);
  }

  setVolume(savedVolume, false);
  setSpeed(speedIndex);
  setRepeatMode("off");
  setShuffle(false);
  renderEqualizer();
  installMediaSessionHandlers();
  renderPlaylist();
  loadTrack(0);
  updatePlaybackState();
  drawVisualizer();
})();
