"use strict";

(() => {
  const databaseName = "aural-ringtones";
  const storeName = "clips";
  const objectUrls = [];
  let databasePromise;

  function openDatabase() {
    if (!("indexedDB" in window)) {
      return Promise.reject(new Error("This browser does not support local ringtone storage."));
    }
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      let settled = false;
      const rejectOpen = error => {
        if (settled) return;
        settled = true;
        databasePromise = null;
        reject(error);
      };
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(storeName)) {
          database.createObjectStore(storeName, { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        if (settled) {
          request.result.close();
          return;
        }
        settled = true;
        request.result.onversionchange = () => {
          request.result.close();
          databasePromise = null;
        };
        resolve(request.result);
      };
      request.onerror = () => rejectOpen(request.error || new Error("Could not open ringtone storage."));
      request.onblocked = () => rejectOpen(new Error("Ringtone storage is blocked by another browser tab."));
    });
    return databasePromise;
  }

  function toTrack(record) {
    const playbackSrc = URL.createObjectURL(record.blob);
    objectUrls.push(playbackSrc);
    const hue = Number.isFinite(record.hue) ? record.hue : 266;
    return {
      title: record.title,
      artist: record.artist,
      src: `ringtone:${record.id}`,
      playbackSrc,
      fileExtension: record.blob.type.includes("ogg")
        ? "ogg"
        : record.blob.type.includes("wav") ? "wav" : "webm",
      cover: makeCover(hue, "RINGTONE", "YOUR CLIP"),
      hue,
      duration: record.duration,
      addedAt: record.createdAt
    };
  }

  async function getAll() {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readonly");
      const request = transaction.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not read saved ringtones."));
      transaction.onabort = () => reject(transaction.error || new Error("Reading saved ringtones was aborted."));
    });
  }

  async function save(record) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, "readwrite");
      transaction.objectStore(storeName).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Could not save the ringtone."));
      transaction.onabort = () => reject(transaction.error || new Error("Saving the ringtone was aborted."));
    });
  }

  async function loadIntoLibrary(tracks) {
    const records = await getAll();
    for (const record of records.sort((first, second) => first.createdAt - second.createdAt)) {
      if (!record
        || typeof record.id !== "string"
        || typeof record.title !== "string"
        || typeof record.artist !== "string"
        || !(record.blob instanceof Blob)
        || !Number.isFinite(record.duration)
        || tracks.some(track => track.src === `ringtone:${record.id}`)) continue;
      tracks.push(toTrack(record));
    }
  }

  async function addToLibrary(record, tracks) {
    await save(record);
    const track = toTrack(record);
    tracks.push(track);
    return track;
  }

  window.auralRingtoneStore = {
    addToLibrary,
    loadIntoLibrary,
    release() {
      for (const objectUrl of objectUrls) URL.revokeObjectURL(objectUrl);
      objectUrls.length = 0;
    }
  };
})();
