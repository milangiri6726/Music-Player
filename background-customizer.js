"use strict";

const backgroundRoot = document.documentElement;
const backgroundInput = document.querySelector("#background-image-input");
const backgroundPicker = document.querySelector("#background-picker");
const backgroundReset = document.querySelector("#background-reset");
const backgroundToast = document.querySelector("#background-toast");
const backgroundStorageKey = "aural-custom-background";
let backgroundToastTimer;

function showBackgroundMessage(message) {
  backgroundToast.textContent = message;
  backgroundToast.hidden = false;
  clearTimeout(backgroundToastTimer);
  backgroundToastTimer = setTimeout(() => {
    backgroundToast.hidden = true;
  }, 3600);
}

function applyCustomBackground(imageData) {
  backgroundRoot.style.setProperty("--custom-background-image", `url("${imageData}")`);
  backgroundRoot.dataset.customBackground = "true";
  backgroundReset.hidden = false;
}

function resizeBackgroundImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, 1920 / image.naturalWidth, 1280 / image.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("This browser could not prepare the selected image."));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        canvas.width = 0;
        canvas.height = 0;
        if (!blob) {
          reject(new Error("The selected image could not be processed."));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("The processed image could not be read."));
        reader.readAsDataURL(blob);
      }, "image/jpeg", 0.8);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected file is not a readable image."));
    };
    image.src = objectUrl;
  });
}

backgroundPicker.addEventListener("click", () => backgroundInput.click());
backgroundInput.addEventListener("change", async () => {
  const [file] = backgroundInput.files;
  backgroundInput.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showBackgroundMessage("Choose a supported image file.");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    showBackgroundMessage("Choose an image smaller than 20 MB.");
    return;
  }
  try {
    const imageData = await resizeBackgroundImage(file);
    localStorage.setItem(backgroundStorageKey, imageData);
    applyCustomBackground(imageData);
    showBackgroundMessage("Custom background saved on this device.");
  } catch (error) {
    showBackgroundMessage(`Could not save this background: ${error.message}`);
    console.error("Unable to save the custom background:", error);
  }
});
backgroundReset.addEventListener("click", () => {
  try {
    localStorage.removeItem(backgroundStorageKey);
    backgroundRoot.style.removeProperty("--custom-background-image");
    delete backgroundRoot.dataset.customBackground;
    backgroundReset.hidden = true;
    showBackgroundMessage("Default background restored.");
  } catch (error) {
    showBackgroundMessage("Could not remove the saved background in this browser.");
    console.error("Unable to remove the custom background:", error);
  }
});

try {
  const savedBackground = localStorage.getItem(backgroundStorageKey);
  if (savedBackground?.startsWith("data:image/")) applyCustomBackground(savedBackground);
} catch (error) {
  console.warn("Unable to load the saved custom background:", error);
}
