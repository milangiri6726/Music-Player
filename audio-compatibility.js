"use strict";

(() => {
  const fallbackUrls = new Map();

  function createFallback(track) {
    if (!Number.isFinite(track.compatibilityRoot)) return null;
    if (fallbackUrls.has(track.src)) return fallbackUrls.get(track.src);

    const sampleRate = 16000;
    const duration = 16;
    const frameCount = sampleRate * duration;
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
    data.setUint32(24, sampleRate, true);
    data.setUint32(28, sampleRate * 2, true);
    data.setUint16(32, 2, true);
    data.setUint16(34, 16, true);
    writeText(36, "data");
    data.setUint32(40, frameCount * 2, true);

    const melody = [0, 3, 7, 10, 7, 3, 5, 10];
    const chords = [0, -5, -2, -7];
    const rootNote = track.compatibilityRoot;
    let peak = 0;
    for (let index = 0; index < frameCount; index += 1) {
      const time = index / sampleRate;
      const beat = time % 0.5;
      const step = Math.floor(time / 0.5);
      const chord = chords[Math.floor(time / 4) % chords.length];
      const melodyFrequency = rootNote * 2 ** ((melody[step % melody.length] + chord + 12) / 12);
      const bassFrequency = rootNote * 2 ** ((chord - 12) / 12);
      const envelope = Math.min(1, beat * 36) * Math.exp(-beat * 3.2);
      const lead = (Math.sin(2 * Math.PI * melodyFrequency * time)
        + 0.22 * Math.sin(4 * Math.PI * melodyFrequency * time)) * envelope * 0.22;
      const bass = Math.sin(2 * Math.PI * bassFrequency * time) * 0.19;
      const chordPad = Math.sin(2 * Math.PI * rootNote * 2 ** ((chord + 4) / 12) * time) * 0.08;
      const kick = Math.sin(2 * Math.PI * 72 * beat) * Math.exp(-beat * 24) * 0.12;
      const edgeFade = Math.min(1, index / 160, (frameCount - index) / 160);
      const sample = (lead + bass + chordPad + kick) * edgeFade;
      data.setInt16(44 + index * 2, Math.max(-1, Math.min(1, sample)) * 32767, true);
      peak = Math.max(peak, Math.abs(sample));
    }
    if (peak > 0.85) {
      const normalization = 0.85 / peak;
      for (let index = 0; index < frameCount; index += 1) {
        data.setInt16(44 + index * 2, data.getInt16(44 + index * 2, true) * normalization, true);
      }
    }

    const url = URL.createObjectURL(new Blob([wave], { type: "audio/wav" }));
    fallbackUrls.set(track.src, url);
    return url;
  }

  function getFallback(track) {
    return fallbackUrls.get(track.src) ?? null;
  }

  function release() {
    for (const url of fallbackUrls.values()) URL.revokeObjectURL(url);
    fallbackUrls.clear();
  }

  window.auralAudioCompatibility = Object.freeze({ createFallback, getFallback, release });
})();
