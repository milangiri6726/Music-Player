(() => {
  const storageKey = "aural-theme";
  const root = document.documentElement;

  try {
    const savedTheme = localStorage.getItem(storageKey);
    if (savedTheme === "dark" || savedTheme === "light") {
      root.dataset.theme = savedTheme;
    }
  } catch (error) {
    console.warn("Could not read the saved theme preference:", error);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const themeToggle = document.querySelector("#theme-toggle");
    if (!themeToggle) return;

    themeToggle.addEventListener("click", () => {
      const isLight = root.dataset.theme === "light"
        || (!root.dataset.theme && window.matchMedia("(prefers-color-scheme: light)").matches);
      const theme = isLight ? "dark" : "light";
      root.dataset.theme = theme;

      try {
        localStorage.setItem(storageKey, theme);
      } catch (error) {
        console.warn("Could not save the theme preference:", error);
      }
    });
  });
})();
