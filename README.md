# Aural Music Player

Aural is a responsive, browser-based music player built with plain HTML, CSS, and JavaScript. It works by opening `index.html` directly; there is no build step or framework.

## Features

- Four bundled MP3 sample tracks, with per-track artwork and accent colors.
- Play, pause, next, and previous controls. Previous restarts the current track after it has played for more than three seconds.
- Track time, duration, and a seekable progress bar.
- Volume slider and mute control; volume preference is saved in `localStorage`.
- Five-band audio equalizer with flat, bass, treble, vocal, and rock presets, custom gain sliders, and an on/off bypass.
- Clickable playlist with active-track highlighting, animated equalizer, and track durations.
- Shuffle, repeat off / all / one, and playback speed cycling through 0.75×, 1×, 1.25×, and 1.5×.
- Canvas audio visualizer with 40 bars, powered by the Web Audio API after playback is first requested.
- Both player pages include a short locally generated WAV fallback for bundled samples if the browser cannot decode the MP3s. The fallback is synthesized compatibility audio, not the original recordings; modern browsers normally play the bundled MP3s.
- Add local audio files to the playlist using the file picker.
- Create 1–30 second ringtone clips from the currently selected song, preview them, save them to the built-in **Ringtones** playlist, and download the WAV audio file. Ringtones are stored locally in IndexedDB and appear on both app pages.
- Browse every song or named playlist in normal, alphabetical, duration, random, or newest-added order. Playback follows the selected order, which is remembered in browser storage. Create, switch between, and delete named playlists, then choose and remove tracks in each playlist. Playlist names and bundled-track selections persist in browser storage.
- Search the current playlist or All Songs by title or artist as you type. Use `/` to focus search, Escape to clear it, or the clear button to restore the full list.
- Keyboard shortcuts: Space (play/pause), Left/Right (seek 5 seconds), Up/Down (volume), N (next), P (previous), M (mute), and S (shuffle).
- Media Session controls on supported browsers.
- Dark/light themes with the selected theme saved in browser storage across both pages, responsive layout, reduced-motion support, accessible labels, and visible keyboard focus.
- Coordinated midnight-blue dark and cool mist-light palettes with song-responsive accent colors, softer ambient glows, high-contrast text, and consistent danger states.
- The player uses an adaptive two-column listening layout on wider screens and a focused single-column layout on phones, with accent-tinted progress and a live playback indicator.
- Choose a custom background image from the image button in the header. The image is resized, saved locally in your browser, and shared between the player and playlist pages; use the reset button beside it to restore the default background.

## Files

```text
music-player/
├── index.html
├── playlist.html
├── audio-compatibility.js
├── ringtone-store.js
├── background-customizer.js
├── theme.js
├── style.css
├── music-library.js
├── script.js
├── playlist.js
└── audio/
    ├── neon-drift.mp3
    ├── golden-hour.mp3
    ├── ocean-circuit.mp3
    └── midnight-bloom.mp3
```

The bundled audio examples are SoundHelix sample tracks, provided by [SoundHelix](https://www.soundhelix.com/audio-examples).

## Run

Open `index.html` in a modern browser for the player, or `playlist.html` for the dedicated playable playlist page. Use the navigation links to switch between pages. Start playback with the play button or Space; browsers require a user gesture before audio playback and Web Audio processing, including the equalizer, can begin.

## Add songs

On the playlist page, use **+** to create a named playlist, **Add tracks** to choose songs from the library, and each playlist's **three-dot menu** to rename or delete it. Use the **×** beside a track to remove it from the current playlist. Playlist names and selections of bundled tracks are saved in browser storage. Use **Add music** to load audio files from your device; they are not uploaded and are only available for the current page session. To bundle additional tracks permanently, copy supported audio files into `audio/` and add track objects to the shared `tracks` array in `music-library.js`, including `title`, `artist`, `src`, `cover`, and `hue`.

On the player page, choose **Ringtone** to trim a 1–30 second section of the current song. Preview the selection, then create it to save it locally in the built-in **Ringtones** playlist. Use the download button beside a saved ringtone to export its WAV file; it can be converted if your phone requires a different ringtone format.
# Music-Player
