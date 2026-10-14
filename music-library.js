"use strict";

const makeCover = (hue, title, subtitle) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="hsl(${hue} 78% 68%)"/><stop offset="1" stop-color="hsl(${(hue + 62) % 360} 80% 34%)"/></linearGradient><radialGradient id="r"><stop stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#171323" stop-opacity=".08"/></radialGradient></defs><rect width="400" height="400" fill="url(#g)"/><circle cx="200" cy="200" r="176" fill="url(#r)"/><circle cx="200" cy="200" r="125" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="2"/><circle cx="200" cy="200" r="94" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/><path d="M0 270 Q100 150 210 240T400 160V400H0Z" fill="#171323" fill-opacity=".2"/><text x="200" y="190" text-anchor="middle" fill="#fff" font-family="sans-serif" font-size="25" font-weight="700" letter-spacing="5">${title}</text><text x="200" y="224" text-anchor="middle" fill="#fff" fill-opacity=".75" font-family="sans-serif" font-size="11" letter-spacing="4">${subtitle}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

const tracks = [
  { title: "Neon Drift", artist: "SoundHelix", src: "audio/neon-drift.mp3", cover: makeCover(266, "NEON", "AFTER HOURS"), hue: 266, duration: 372.715083, compatibilityRoot: 220 },
  { title: "Golden Hour", artist: "SoundHelix", src: "audio/golden-hour.mp3", cover: makeCover(34, "GOLDEN", "SOFT LIGHT"), hue: 34, duration: 425.952625, compatibilityRoot: 262 },
  { title: "Ocean Circuit", artist: "SoundHelix", src: "audio/ocean-circuit.mp3", cover: makeCover(190, "OCEAN", "DEEP CURRENT"), hue: 190, duration: 344.084875, compatibilityRoot: 196 },
  { title: "Midnight Bloom", artist: "SoundHelix", src: "audio/midnight-bloom.mp3", cover: makeCover(325, "BLOOM", "NIGHT GARDEN"), hue: 325, duration: 302.524083, compatibilityRoot: 233 }
];
