"use strict";

const audio = document.querySelector("#library-audio");
const root = document.documentElement;
const elements = {
  playlistNavLink: document.querySelector("#nav-playlist"),
  allSongsNavLink: document.querySelector("#nav-all-songs"),
  nav: document.querySelector("#playlist-nav"),
  list: document.querySelector("#library-tracks"),
  title: document.querySelector("#library-title-now"),
  artist: document.querySelector("#library-artist-now"),
  cover: document.querySelector("#library-cover"),
  play: document.querySelector("#library-play"),
  playIcon: document.querySelector("#library-play-icon"),
  status: document.querySelector("#library-status"),
  fileInput: document.querySelector("#add-songs"),
  create: document.querySelector("#create-playlist"),
  createDialog: document.querySelector("#create-playlist-dialog"),
  createForm: document.querySelector("#create-playlist-form"),
  newName: document.querySelector("#new-playlist-name"),
  createError: document.querySelector("#create-playlist-error"),
  renameDialog: document.querySelector("#rename-playlist-dialog"),
  renameForm: document.querySelector("#rename-playlist-form"),
  renameName: document.querySelector("#rename-playlist-name"),
  renameError: document.querySelector("#rename-playlist-error"),
  addTracks: document.querySelector("#add-tracks"),
  addDialog: document.querySelector("#add-tracks-dialog"),
  addForm: document.querySelector("#add-tracks-form"),
  availableTracks: document.querySelector("#available-tracks"),
  selectedName: document.querySelector("#selected-playlist-name"),
  selectedCount: document.querySelector("#selected-playlist-count"),
  allSongs: document.querySelector("#all-songs"),
  allSongsCount: document.querySelector("#all-songs-count"),
  search: document.querySelector("#library-search-input"),
  searchClear: document.querySelector("#library-search-clear"),
  searchCount: document.querySelector("#library-search-count"),
  sortControl: document.querySelector("#all-songs-sort-control"),
  sortTrigger: document.querySelector("#sort-trigger"),
  sortCurrentLabel: document.querySelector("#sort-current-label"),
  sortMenu: document.querySelector("#sort-menu")
};
const storageKey = "aural-playlists";
const sortStorageKey = "aural-song-sort";
let playlists = [];
let selectedPlaylistId = "";
let currentTrackId = "";
let objectUrls = [];
let playlistToRename = "";
let isAllSongsView = new URLSearchParams(window.location.search).get("view") === "all";
let pendingLoad = 0;
let songSortOrder = "default";
let randomTrackOrder = [];
let lastAddedAt = 0;

function createId() {
  return window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeDefaultPlaylist() {
  return {
    id: "my-playlist",
    name: "My Playlist",
    trackIds: tracks
      .filter(track => !track.src.startsWith("ringtone:") && !track.src.startsWith("blob:"))
      .map(track => track.src)
  };
}

function persistPlaylists() {
  const knownTrackIds = new Set(tracks.filter(track => !track.src.startsWith("blob:")).map(track => track.src));
  const savedPlaylists = playlists.map(playlist => ({
    id: playlist.id,
    name: playlist.name,
    trackIds: playlist.trackIds.filter(trackId => knownTrackIds.has(trackId))
  }));
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      selectedPlaylistId,
      playlists: savedPlaylists
    }));
  } catch (error) {
    elements.status.textContent = "Your playlists could not be saved in this browser.";
    console.warn("Unable to save playlists:", error);
  }
}

function loadSavedPlaylists() {
  const knownTrackIds = new Set(tracks.map(track => track.src));
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!saved || !Array.isArray(saved.playlists)) return;
    const restored = saved.playlists
      .filter(playlist => playlist
        && typeof playlist.id === "string"
        && typeof playlist.name === "string"
        && playlist.name.trim()
        && Array.isArray(playlist.trackIds))
      .map(playlist => ({
        id: playlist.id,
        name: playlist.name.trim().slice(0, 40),
        trackIds: [...new Set(playlist.trackIds.filter(id => knownTrackIds.has(id)))]
      }));
    if (restored.length > 0) playlists = restored;
    if (typeof saved.selectedPlaylistId === "string"
      && playlists.some(playlist => playlist.id === saved.selectedPlaylistId)) {
      selectedPlaylistId = saved.selectedPlaylistId;
    }
  } catch (error) {
    console.warn("Unable to load saved playlists:", error);
  }
}

function getSelectedPlaylist() {
  return playlists.find(playlist => playlist.id === selectedPlaylistId) ?? null;
}

function getPlaylistTracks(playlist = getSelectedPlaylist()) {
  if (!playlist) return [];
  return playlist.trackIds
    .map(trackId => tracks.find(track => track.src === trackId))
    .filter(track => track !== undefined);
}

function getDisplayedTracks() {
  const displayedTracks = isAllSongsView ? [...tracks] : getPlaylistTracks();
  if (songSortOrder === "alphabetical") {
    displayedTracks.sort((first, second) => first.title.localeCompare(second.title, undefined, {
      sensitivity: "base",
      numeric: true
    }));
  } else if (songSortOrder === "duration") {
    displayedTracks.sort((first, second) => {
      const firstDuration = Number.isFinite(first.duration) && first.duration > 0 ? first.duration : Infinity;
      const secondDuration = Number.isFinite(second.duration) && second.duration > 0 ? second.duration : Infinity;
      return firstDuration - secondDuration || first.title.localeCompare(second.title, undefined, { sensitivity: "base" });
    });
  } else if (songSortOrder === "random") {
    const order = new Map(randomTrackOrder.map((trackId, index) => [trackId, index]));
    displayedTracks.sort((first, second) => order.get(first.src) - order.get(second.src));
  } else if (songSortOrder === "added") {
    displayedTracks.sort((first, second) => (second.addedAt ?? 0) - (first.addedAt ?? 0));
  }
  return displayedTracks;
}

function shuffleTrackOrder() {
  randomTrackOrder = tracks.map(track => track.src);
  for (let index = randomTrackOrder.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [randomTrackOrder[index], randomTrackOrder[swapIndex]] =
      [randomTrackOrder[swapIndex], randomTrackOrder[index]];
  }
}

function closeSortMenu(returnFocus = false) {
  elements.sortMenu.hidden = true;
  elements.sortTrigger.setAttribute("aria-expanded", "false");
  if (returnFocus) elements.sortTrigger.focus();
}

function updateSortControl() {
  const selectedOption = elements.sortMenu.querySelector(`[data-sort-order="${songSortOrder}"]`);
  if (!selectedOption) return;
  elements.sortCurrentLabel.textContent = selectedOption.querySelector("strong").textContent;
  elements.sortTrigger.setAttribute("aria-label", `Sort songs: ${elements.sortCurrentLabel.textContent}`);
  for (const option of elements.sortMenu.querySelectorAll("[data-sort-order]")) {
    option.setAttribute("aria-checked", String(option === selectedOption));
  }
}

function setSongSortOrder(sortOrder) {
  songSortOrder = sortOrder;
  if (songSortOrder === "random") shuffleTrackOrder();
  updateSortControl();
  try {
    localStorage.setItem(sortStorageKey, songSortOrder);
  } catch (error) {
    elements.status.textContent = "Your song order could not be saved in this browser.";
    console.warn("Unable to save song order:", error);
  }
  renderTracks();
}

function getNextAddedAt() {
  lastAddedAt = Math.max(Date.now(), lastAddedAt + 1);
  return lastAddedAt;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function renderPlaylistNavigation() {
  elements.playlistNavLink.toggleAttribute("aria-current", !isAllSongsView);
  if (!isAllSongsView) elements.playlistNavLink.setAttribute("aria-current", "page");
  elements.allSongsNavLink.toggleAttribute("aria-current", isAllSongsView);
  if (isAllSongsView) elements.allSongsNavLink.setAttribute("aria-current", "page");
  elements.allSongsCount.textContent = String(tracks.length);
  elements.allSongs.classList.toggle("selected", isAllSongsView);
  elements.allSongs.setAttribute("aria-current", String(isAllSongsView));
  const fragment = document.createDocumentFragment();
  elements.nav.replaceChildren();
  playlists.forEach(playlist => {
    const item = document.createElement("li");
    item.className = "playlist-nav-item";
    const select = document.createElement("button");
    select.className = "playlist-nav-button";
    select.type = "button";
    select.classList.toggle("selected", playlist.id === selectedPlaylistId);
    select.setAttribute("aria-current", !isAllSongsView && playlist.id === selectedPlaylistId ? "true" : "false");
    const icon = document.createElement("span");
    icon.className = "playlist-nav-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "♫";
    const copy = document.createElement("span");
    copy.className = "playlist-nav-copy";
    const name = document.createElement("span");
    name.className = "playlist-nav-name";
    name.textContent = playlist.name;
    const count = document.createElement("span");
    const trackCount = playlist.trackIds.filter(id => tracks.some(track => track.src === id)).length;
    count.className = "playlist-nav-count";
    count.textContent = String(trackCount);
    copy.append(name);
    select.append(icon, copy, count);
    select.addEventListener("click", () => selectPlaylist(playlist.id));
    item.append(select);

    if (playlist.id !== "ringtones") {
      const menuWrap = document.createElement("div");
      menuWrap.className = "playlist-menu-wrap";
      const menuToggle = document.createElement("button");
      menuToggle.className = "playlist-menu-toggle";
      menuToggle.type = "button";
      menuToggle.setAttribute("aria-label", `Manage ${playlist.name}`);
      menuToggle.setAttribute("aria-haspopup", "menu");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.title = `Manage ${playlist.name}`;
      const dots = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      dots.setAttribute("viewBox", "0 0 24 24");
      dots.setAttribute("aria-hidden", "true");
      const dotPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      dotPath.setAttribute("d", "M12 5v.01M12 12v.01M12 19v.01");
      dots.append(dotPath);
      menuToggle.append(dots);

      const menu = document.createElement("div");
      menu.className = "playlist-options-menu";
      menu.setAttribute("role", "menu");
      menu.hidden = true;
      const rename = document.createElement("button");
      rename.className = "playlist-menu-action";
      rename.type = "button";
      rename.setAttribute("role", "menuitem");
      rename.textContent = "Rename";
      rename.addEventListener("click", () => openRenameDialog(playlist));
      menu.append(rename);

      if (playlists.length > 1) {
        const remove = document.createElement("button");
        remove.className = "playlist-menu-action danger";
        remove.type = "button";
        remove.setAttribute("role", "menuitem");
        remove.textContent = "Delete";
        remove.addEventListener("click", () => deletePlaylist(playlist.id));
        menu.append(remove);
      }
      menuToggle.addEventListener("click", () => {
        const willOpen = menu.hidden;
        closePlaylistMenus();
        menu.hidden = !willOpen;
        menuToggle.setAttribute("aria-expanded", String(willOpen));
        if (willOpen) rename.focus();
      });
      menuWrap.append(menuToggle, menu);
      item.append(menuWrap);
    }
    fragment.append(item);
  });
  elements.nav.append(fragment);
}

function renderCurrentTrack() {
  const track = tracks.find(item => item.src === currentTrackId);
  if (!track) {
    elements.title.textContent = "No track selected";
    elements.artist.textContent = "Choose a song from your playlist";
    elements.cover.removeAttribute("src");
    elements.cover.alt = "";
    return;
  }
  elements.title.textContent = track.title;
  elements.artist.textContent = track.artist;
  elements.cover.src = track.cover;
  elements.cover.alt = `Artwork for ${track.title}`;
}

function renderTracks() {
  const playlist = getSelectedPlaylist();
  const allPlaylistTracks = getDisplayedTracks();
  const query = elements.search.value.trim().toLocaleLowerCase();
  const playlistTracks = query
    ? allPlaylistTracks.filter(track => `${track.title} ${track.artist}`.toLocaleLowerCase().includes(query))
    : allPlaylistTracks;
  const fragment = document.createDocumentFragment();
  elements.list.replaceChildren();
  elements.selectedName.textContent = isAllSongsView ? "All Songs" : playlist?.name ?? "Playlist";
  elements.selectedCount.textContent = `${allPlaylistTracks.length} ${allPlaylistTracks.length === 1 ? "track" : "tracks"}`;
  elements.searchCount.textContent = query
    ? `${playlistTracks.length} of ${allPlaylistTracks.length} ${allPlaylistTracks.length === 1 ? "track" : "tracks"}`
    : `${allPlaylistTracks.length} ${allPlaylistTracks.length === 1 ? "track" : "tracks"}`;
  elements.searchClear.hidden = !query;
  elements.addTracks.hidden = isAllSongsView;
  elements.addTracks.disabled = !playlist || isAllSongsView;

  if (playlistTracks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty-library";
    if (query) {
      empty.classList.add("empty-search-results");
      const message = document.createElement("span");
      message.textContent = `No matches for "${elements.search.value.trim()}".`;
      const clear = document.createElement("button");
      clear.className = "empty-search-clear";
      clear.type = "button";
      clear.textContent = "Clear search";
      clear.addEventListener("click", () => {
        elements.search.value = "";
        renderTracks();
        elements.search.focus();
      });
      empty.append(message, clear);
    } else {
      empty.textContent = isAllSongsView
        ? "No songs in your library yet. Use Add music to load audio files."
        : "This playlist is empty. Add tracks to get started.";
    }
    fragment.append(empty);
  }

  playlistTracks.forEach((track, index) => {
    const item = document.createElement("li");
    item.className = "playlist-item library-track";
    if (isAllSongsView) item.classList.add("all-songs-track");
    const isCurrent = track.src === currentTrackId;
    if (isCurrent) item.classList.add("active");
    item.setAttribute("aria-current", isCurrent ? "true" : "false");

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

    const play = document.createElement("button");
    play.className = "library-track-main";
    play.type = "button";
    play.setAttribute("aria-label", `Play ${track.title} by ${track.artist}`);
    const cover = document.createElement("img");
    cover.className = "library-track-cover";
    cover.src = track.cover;
    cover.alt = "";
    const details = document.createElement("span");
    details.className = "library-track-details";
    const title = document.createElement("span");
    title.className = "track-name";
    title.textContent = track.title;
    const artist = document.createElement("span");
    artist.className = "track-artist";
    artist.textContent = track.artist;
    details.append(title, artist);
    play.append(marker, cover, details);
    play.addEventListener("click", () => playTrack(track.src));

    const duration = document.createElement("span");
    duration.className = "track-duration";
    duration.textContent = formatTime(track.duration);
    item.append(play, duration);
    const hasDownload = track.src.startsWith("ringtone:") && track.playbackSrc;
    if (hasDownload) item.classList.add("ringtone-track");
    if (hasDownload || (!isAllSongsView && playlist?.id !== "ringtones")) {
      const actions = document.createElement("span");
      actions.className = "track-actions";
      if (hasDownload) {
        const download = document.createElement("a");
        download.className = "download-track-button";
        download.href = track.playbackSrc;
        download.download = `${track.title}.${track.fileExtension || "webm"}`;
        download.setAttribute("aria-label", `Download ringtone ${track.title}`);
        download.title = "Download ringtone";
        download.textContent = "↓";
        actions.append(download);
      }
      if (!isAllSongsView && playlist?.id !== "ringtones") {
        const remove = document.createElement("button");
        remove.className = "remove-track-button";
        remove.type = "button";
        remove.setAttribute("aria-label", `Remove ${track.title} from ${playlist.name}`);
        remove.title = "Remove from playlist";
        remove.textContent = "×";
        remove.addEventListener("click", () => removeTrack(track.src));
        actions.append(remove);
      }
      item.append(actions);
    }
    fragment.append(item);
  });

  elements.list.append(fragment);
}

function renderAvailableTracks() {
  const playlist = getSelectedPlaylist();
  const selectedIds = new Set(playlist?.trackIds ?? []);
  const fragment = document.createDocumentFragment();
  elements.availableTracks.replaceChildren();
  tracks.forEach(track => {
    const item = document.createElement("li");
    const label = document.createElement("label");
    label.className = "available-track";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = track.src;
    checkbox.checked = selectedIds.has(track.src);
    const cover = document.createElement("img");
    cover.src = track.cover;
    cover.alt = "";
    const details = document.createElement("span");
    details.className = "available-track-details";
    const title = document.createElement("strong");
    title.textContent = track.title;
    const artist = document.createElement("span");
    artist.textContent = track.artist;
    details.append(title, artist);
    label.append(checkbox, cover, details);
    item.append(label);
    fragment.append(item);
  });
  elements.availableTracks.append(fragment);
}

function updatePlaybackState() {
  const playing = !audio.paused;
  document.body.classList.toggle("playing", playing);
  document.body.classList.toggle("paused", !playing);
  elements.play.setAttribute("aria-label", playing ? "Pause" : "Play");
  elements.play.title = playing ? "Pause (Space)" : "Play or pause (Space)";
  elements.playIcon.setAttribute("d", playing ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z");
}

function loadTrack(trackId, shouldPlay = false) {
  const track = tracks.find(item => item.src === trackId);
  if (!track) return;
  currentTrackId = trackId;
  root.style.setProperty("--h", String(track.hue));
  renderCurrentTrack();
  renderTracks();
  elements.status.textContent = "";
  setAudioTrack(track, shouldPlay);
}

function setAudioTrack(track, shouldPlay = false) {
  const loadId = ++pendingLoad;
  audio.pause();
  if (!track) {
    audio.removeAttribute("src");
    audio.load();
    return;
  }
  audio.src = window.auralAudioCompatibility.getFallback(track) || track.playbackSrc || track.src;
  if (shouldPlay) void playAudio(loadId);
}

async function playAudio(loadId = pendingLoad) {
  if (loadId !== pendingLoad) return;
  const track = tracks.find(item => item.src === currentTrackId);
  if (!track) return;
  if (audio.ended) audio.currentTime = 0;

  try {
    await audio.play();
  } catch (error) {
    if (loadId !== pendingLoad) return;
    if (error.name === "NotSupportedError"
      && track.compatibilityRoot
      && !window.auralAudioCompatibility.getFallback(track)) {
      try {
        audio.src = window.auralAudioCompatibility.createFallback(track);
        await audio.play();
        return;
      } catch (fallbackError) {
        if (fallbackError.name !== "AbortError" && loadId === pendingLoad) {
          elements.status.textContent = `Playback failed: ${fallbackError.message}`;
          console.error("Unable to play the bundled or compatibility audio:", fallbackError);
        }
        return;
      }
    }
    if (error.name !== "AbortError") {
      elements.status.textContent = `Playback failed: ${error.message}`;
      console.error("Unable to play the selected track:", error);
    }
  }
}

function playTrack(trackId) {
  if (trackId === currentTrackId) {
    if (audio.paused) playAudio();
    else audio.pause();
    return;
  }
  loadTrack(trackId, true);
}

function playNext() {
  const playlistTracks = getDisplayedTracks();
  const currentIndex = playlistTracks.findIndex(track => track.src === currentTrackId);
  const next = playlistTracks[currentIndex + 1];
  if (next) loadTrack(next.src, true);
  else audio.pause();
}

function selectPlaylist(playlistId) {
  if (selectedPlaylistId === playlistId) return;
  isAllSongsView = false;
  selectedPlaylistId = playlistId;
  const playlistTracks = getPlaylistTracks(getSelectedPlaylist());
  if (!playlistTracks.some(track => track.src === currentTrackId)) {
    currentTrackId = playlistTracks[0]?.src ?? "";
    const track = tracks.find(item => item.src === currentTrackId);
    setAudioTrack(track);
    if (track) root.style.setProperty("--h", String(track.hue));
    renderCurrentTrack();
  }
  elements.status.textContent = "";
  renderPlaylistNavigation();
  renderTracks();
  persistPlaylists();
}

function selectAllSongs() {
  if (isAllSongsView) return;
  isAllSongsView = true;
  renderPlaylistNavigation();
  renderTracks();
}

function deletePlaylist(playlistId) {
  if (playlists.length <= 1) return;
  const playlist = playlists.find(item => item.id === playlistId);
  if (!playlist || !window.confirm(`Delete the playlist "${playlist.name}"?`)) return;
  playlists = playlists.filter(item => item.id !== playlistId);
  if (selectedPlaylistId === playlistId) {
    selectedPlaylistId = playlists[0].id;
    const firstTrack = getPlaylistTracks()[0];
    if (firstTrack) {
      currentTrackId = firstTrack.src;
      setAudioTrack(firstTrack);
      root.style.setProperty("--h", String(firstTrack.hue));
    } else {
      currentTrackId = "";
      setAudioTrack(null);
    }
    renderCurrentTrack();
  }
  renderPlaylistNavigation();
  renderTracks();
  persistPlaylists();
}

function closePlaylistMenus() {
  for (const menu of elements.nav.querySelectorAll(".playlist-options-menu")) {
    menu.hidden = true;
    menu.parentElement.querySelector(".playlist-menu-toggle").setAttribute("aria-expanded", "false");
  }
}

function openRenameDialog(playlist) {
  closePlaylistMenus();
  playlistToRename = playlist.id;
  elements.renameError.textContent = "";
  elements.renameName.value = playlist.name;
  elements.renameDialog.showModal();
  elements.renameName.focus();
  elements.renameName.select();
}

function removeTrack(trackId) {
  const playlist = getSelectedPlaylist();
  if (!playlist) return;
  playlist.trackIds = playlist.trackIds.filter(id => id !== trackId);
  const remainingTracks = getPlaylistTracks(playlist);
  if (trackId === currentTrackId) {
    currentTrackId = remainingTracks[0]?.src ?? "";
    const track = tracks.find(item => item.src === currentTrackId);
    setAudioTrack(track);
    if (track) root.style.setProperty("--h", String(track.hue));
    renderCurrentTrack();
  }
  renderPlaylistNavigation();
  renderTracks();
  persistPlaylists();
}

function addLocalFiles(files) {
  const selected = Array.from(files).filter(isSupportedAudioFile);
  if (selected.length === 0) {
    elements.status.textContent = "Choose one or more supported audio files.";
    return;
  }
  const playlist = getSelectedPlaylist();
  const addedAt = getNextAddedAt();
  for (const file of selected) {
    const hue = Math.floor(Math.random() * 360);
    const objectUrl = URL.createObjectURL(file);
    objectUrls.push(objectUrl);
    const track = {
      title: file.name.replace(/\.[^.]+$/, "") || file.name,
      artist: "Local file",
      src: objectUrl,
      cover: makeCover(hue, "LOCAL", "YOUR LIBRARY"),
      hue,
      duration: 0,
      addedAt
    };
    tracks.push(track);
    playlist.trackIds.push(track.src);
  }
  if (songSortOrder === "random") shuffleTrackOrder();
  const firstAddedTrackId = playlist.trackIds[playlist.trackIds.length - selected.length];
  renderPlaylistNavigation();
  renderTracks();
  persistPlaylists();
  loadTrack(firstAddedTrackId, true);
  elements.status.textContent = `${selected.length} ${selected.length === 1 ? "song" : "songs"} added. Local files are available until you close this page.`;
}

function isSupportedAudioFile(file) {
  return file.type.startsWith("audio/")
    || /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|webm)$/i.test(file.name);
}

elements.play.addEventListener("click", () => {
  if (!currentTrackId) {
    const firstTrack = getPlaylistTracks()[0];
    if (firstTrack) loadTrack(firstTrack.src, true);
  } else if (audio.paused) {
    playAudio();
  } else {
    audio.pause();
  }
});
elements.create.addEventListener("click", () => {
  elements.createError.textContent = "";
  elements.createForm.reset();
  elements.createDialog.showModal();
  elements.newName.focus();
});
elements.createForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = elements.newName.value.trim();
  if (!name) {
    elements.createError.textContent = "Enter a playlist name.";
    elements.newName.focus();
    return;
  }
  if (playlists.some(playlist => playlist.name.toLowerCase() === name.toLowerCase())) {
    elements.createError.textContent = "A playlist with that name already exists.";
    elements.newName.focus();
    return;
  }
  const playlist = { id: createId(), name, trackIds: [] };
  playlists.push(playlist);
  elements.createDialog.close();
  selectPlaylist(playlist.id);
  elements.status.textContent = `"${name}" created. Add some tracks to get started.`;
  renderPlaylistNavigation();
});
elements.renameForm.addEventListener("submit", event => {
  event.preventDefault();
  const name = elements.renameName.value.trim();
  const playlist = playlists.find(item => item.id === playlistToRename);
  if (!playlist) {
    elements.renameError.textContent = "This playlist is no longer available.";
    return;
  }
  if (!name) {
    elements.renameError.textContent = "Enter a playlist name.";
    elements.renameName.focus();
    return;
  }
  if (playlists.some(item => item.id !== playlist.id && item.name.toLowerCase() === name.toLowerCase())) {
    elements.renameError.textContent = "A playlist with that name already exists.";
    elements.renameName.focus();
    return;
  }
  playlist.name = name;
  playlistToRename = "";
  elements.renameDialog.close();
  renderPlaylistNavigation();
  renderTracks();
  persistPlaylists();
  elements.status.textContent = "Playlist renamed.";
});
elements.addTracks.addEventListener("click", () => {
  renderAvailableTracks();
  elements.addDialog.showModal();
});
elements.allSongs.addEventListener("click", selectAllSongs);
elements.sortTrigger.addEventListener("click", () => {
  const shouldOpen = elements.sortMenu.hidden;
  elements.sortMenu.hidden = !shouldOpen;
  elements.sortTrigger.setAttribute("aria-expanded", String(shouldOpen));
  if (shouldOpen) {
    elements.sortMenu.querySelector('[aria-checked="true"]').focus();
  }
});
elements.sortMenu.addEventListener("click", event => {
  const option = event.target instanceof Element ? event.target.closest("[data-sort-order]") : null;
  if (!option) return;
  setSongSortOrder(option.dataset.sortOrder);
  closeSortMenu(true);
});
elements.sortTrigger.addEventListener("keydown", event => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    elements.sortMenu.hidden = false;
    elements.sortTrigger.setAttribute("aria-expanded", "true");
    const options = [...elements.sortMenu.querySelectorAll("[data-sort-order]")];
    (event.key === "ArrowDown" ? options[0] : options[options.length - 1]).focus();
  }
});
elements.sortMenu.addEventListener("keydown", event => {
  const options = [...elements.sortMenu.querySelectorAll("[data-sort-order]")];
  const currentIndex = options.indexOf(document.activeElement);
  let nextIndex = currentIndex;
  if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
  else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = options.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    closeSortMenu(true);
    return;
  } else return;
  event.preventDefault();
  options[nextIndex].focus();
});
elements.search.addEventListener("input", renderTracks);
elements.searchClear.addEventListener("click", () => {
  elements.search.value = "";
  renderTracks();
  elements.search.focus();
});
elements.addForm.addEventListener("submit", event => {
  event.preventDefault();
  const playlist = getSelectedPlaylist();
  if (!playlist) return;
  playlist.trackIds = Array.from(elements.availableTracks.querySelectorAll("input:checked"), input => input.value);
  if (!playlist.trackIds.includes(currentTrackId)) {
    currentTrackId = playlist.trackIds[0] ?? "";
    const track = tracks.find(item => item.src === currentTrackId);
    setAudioTrack(track);
    if (track) root.style.setProperty("--h", String(track.hue));
    renderCurrentTrack();
  }
  elements.addDialog.close();
  elements.status.textContent = "Playlist tracks updated.";
  renderPlaylistNavigation();
  renderTracks();
  persistPlaylists();
});
for (const closeButton of document.querySelectorAll("[data-close-dialog]")) {
  closeButton.addEventListener("click", () => closeButton.closest("dialog").close());
}
for (const dialog of [elements.createDialog, elements.renameDialog, elements.addDialog]) {
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
}
document.addEventListener("click", event => {
  if (!(event.target instanceof Element) || !event.target.closest(".playlist-menu-wrap")) closePlaylistMenus();
  if (!(event.target instanceof Element) || !event.target.closest(".sort-picker")) closeSortMenu();
});
elements.fileInput.addEventListener("change", () => {
  addLocalFiles(elements.fileInput.files);
  elements.fileInput.value = "";
});
audio.addEventListener("play", updatePlaybackState);
audio.addEventListener("pause", updatePlaybackState);
audio.addEventListener("ended", playNext);
audio.addEventListener("loadedmetadata", () => {
  const track = tracks.find(item => item.src === currentTrackId);
  if (track && audio.currentSrc === audio.src && Number.isFinite(audio.duration)) {
    track.duration = audio.duration;
    renderTracks();
  }
});
audio.addEventListener("error", () => {
  const track = tracks.find(item => item.src === currentTrackId);
  if (audio.currentSrc === audio.src && audio.error
    && !(track?.compatibilityRoot && audio.error.code === 4 && !window.auralAudioCompatibility.getFallback(track))) {
    elements.status.textContent = "This track could not be loaded or played.";
  }
});
document.addEventListener("keydown", event => {
  const target = event.target;
  const isTyping = target instanceof HTMLElement
    && (target.isContentEditable || ["BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
  if (event.key === "Escape") {
    if (document.activeElement === elements.search && elements.search.value) {
      elements.search.value = "";
      renderTracks();
      event.preventDefault();
    }
    closePlaylistMenus();
    closeSortMenu();
  } else if (event.key === "/" && !isTyping) {
    event.preventDefault();
    elements.search.focus();
  } else if (event.key === " " && !isTyping) {
    event.preventDefault();
    elements.play.click();
  } else if (event.key.toLowerCase() === "n" && !isTyping) {
    playNext();
  }
});
window.addEventListener("beforeunload", () => {
  for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl);
  window.auralRingtoneStore.release();
  window.auralAudioCompatibility.release();
});

void (async () => {
  try {
    await window.auralRingtoneStore.loadIntoLibrary(tracks);
  } catch (error) {
    elements.status.textContent = `Saved ringtones could not be loaded: ${error.message}`;
    console.error("Unable to load saved ringtones:", error);
  }

  playlists = [makeDefaultPlaylist()];
  loadSavedPlaylists();
  let ringtonePlaylist = playlists.find(playlist => playlist.id === "ringtones");
  if (!ringtonePlaylist) {
    ringtonePlaylist = { id: "ringtones", name: "Ringtones", trackIds: [] };
    playlists.push(ringtonePlaylist);
  }
  ringtonePlaylist.name = "Ringtones";
  ringtonePlaylist.trackIds = tracks.filter(track => track.src.startsWith("ringtone:")).map(track => track.src);
  try {
    const savedSortOrder = localStorage.getItem(sortStorageKey);
    if (["default", "alphabetical", "duration", "random", "added"].includes(savedSortOrder)) {
      songSortOrder = savedSortOrder;
    }
  } catch (error) {
    console.warn("Unable to load song order:", error);
  }
  if (songSortOrder === "random") shuffleTrackOrder();
  updateSortControl();
  if (playlists.length === 0) playlists = [makeDefaultPlaylist(), ringtonePlaylist];
  if (!selectedPlaylistId || !playlists.some(playlist => playlist.id === selectedPlaylistId)) {
    selectedPlaylistId = playlists[0].id;
  }
  const initialTrack = getDisplayedTracks()[0];
  currentTrackId = initialTrack?.src ?? "";
  renderPlaylistNavigation();
  renderCurrentTrack();
  renderTracks();
  setAudioTrack(initialTrack);
  updatePlaybackState();
})();
